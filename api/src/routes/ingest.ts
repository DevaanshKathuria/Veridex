import { lookup } from "dns/promises";
import { NextFunction, Request, Response, Router } from "express";
import isLocalIp from "is-local-ip";
import { JSDOM } from "jsdom";
import multer from "multer";
import axios from "axios";
import { z } from "zod";

import DocumentModel, { DocumentInputType } from "../models/Document";
import { ingestRateLimiter } from "../middleware/rateLimiter";
import { validateRequest } from "../middleware/validateRequest";
import { ingestionQueue } from "../lib/queues";
import { AuthenticatedRequest } from "../types/auth";

const { Readability } = require("@mozilla/readability") as {
  Readability: new (document: unknown) => { parse: () => null | { title?: string; textContent?: string; byline?: string } };
};

const router = Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== "application/pdf") {
      callback(new Error("Only PDF uploads are allowed"));
      return;
    }
    callback(null, true);
  },
});

const normalizeMetadata = (value: unknown): Record<string, unknown> => {
  if (typeof value === "string" && value.trim()) {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

const inputTypes = [
  "raw_text",
  "article_url",
  "pdf_upload",
  "transcript_upload",
  "tweet_text",
  "product_claim",
] as const satisfies readonly DocumentInputType[];

const ingestBodySchema = z
  .object({
    inputType: z.enum(inputTypes),
    text: z.string().trim().optional(),
    url: z.string().url().optional(),
    metadata: z.preprocess(normalizeMetadata, z.record(z.string(), z.unknown()).default({})),
  })
  .superRefine((value, ctx) => {
    if (value.inputType === "article_url" && !value.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "A valid url is required for article_url ingestion",
      });
    }

    if (value.inputType !== "article_url" && value.inputType !== "pdf_upload" && !value.text?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["text"],
        message: "Text is required for this input type",
      });
    }
  });

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractHtmlMetadata(document: {
  querySelector: (selector: string) => { getAttribute: (name: string) => string | null; textContent: string | null } | null;
}): { title: string | null; author: string | null; date: string | null } {
  const queryMeta = (...selectors: string[]): string | null => {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const value = element?.getAttribute("content")?.trim() ?? element?.textContent?.trim();
      if (value) {
        return value;
      }
    }
    return null;
  };

  return {
    title: queryMeta("meta[property='og:title']", "meta[name='twitter:title']", "title"),
    author: queryMeta("meta[name='author']", "meta[property='article:author']", "meta[name='parsely-author']"),
    date: queryMeta(
      "meta[property='article:published_time']",
      "meta[name='pubdate']",
      "meta[name='publish-date']",
      "meta[name='date']",
      "time[datetime]",
    ),
  };
}

async function assertPublicUrl(targetUrl: string): Promise<void> {
  const parsed = new URL(targetUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP(S) URLs are allowed");
  }

  if (parsed.hostname === "localhost" || parsed.hostname.endsWith(".local")) {
    throw new Error("Local addresses are not allowed");
  }

  if (isLocalIp(parsed.hostname)) {
    throw new Error("Local addresses are not allowed");
  }

  const records = await lookup(parsed.hostname, { all: true, verbatim: true });
  if (records.some((record) => isLocalIp(record.address))) {
    throw new Error("Local addresses are not allowed");
  }
}

async function fetchArticle(url: string): Promise<{
  text: string;
  sourceTitle: string | null;
  sourceAuthor: string | null;
  sourceDate: string | null;
}> {
  await assertPublicUrl(url);

  const response = await axios.get<string>(url, {
    timeout: 10_000,
    responseType: "text",
    maxRedirects: 3,
    headers: {
      "User-Agent": "VeridexBot/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  const dom = new JSDOM(response.data, { url });
  const readability = new Readability(dom.window.document);
  const article = readability.parse();
  const metadata = extractHtmlMetadata(dom.window.document);

  const text = article?.textContent?.trim();
  if (!text) {
    throw new Error("Unable to extract readable article text");
  }

  return {
    text,
    sourceTitle: article?.title?.trim() || metadata.title,
    sourceAuthor: article?.byline?.trim() || metadata.author,
    sourceDate: metadata.date,
  };
}

function parsePdfMagicBytes(buffer: Buffer): boolean {
  return buffer.subarray(0, 4).toString("utf8") === "%PDF";
}

function normalizeRequestBody(req: Request, _res: Response, next: NextFunction): void {
  req.body = {
    ...req.body,
    metadata: normalizeMetadata(req.body?.metadata),
  };
  next();
}

router.post(
  "/",
  ingestRateLimiter,
  upload.single("file"),
  normalizeRequestBody,
  validateRequest(ingestBodySchema),
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { inputType, text, url, metadata } = req.body as z.infer<typeof ingestBodySchema>;
    const userId = authReq.user!.userId;

    let rawText = text?.trim() ?? "";
    let sourceUrl: string | null = null;
    let sourceTitle: string | null = null;
    let sourceAuthor: string | null = null;
    let sourceDate: Date | null = null;
    let ingestMetadata: Record<string, unknown> = { ...metadata };

    if (inputType === "article_url") {
      const article = await fetchArticle(url!);
      rawText = article.text;
      sourceUrl = url!;
      sourceTitle = article.sourceTitle;
      sourceAuthor = article.sourceAuthor;
      sourceDate = parseDate(article.sourceDate);
      ingestMetadata = {
        ...ingestMetadata,
        sourceUrl,
        sourceTitle,
        sourceAuthor,
        sourceDate: sourceDate?.toISOString() ?? null,
      };
    }

    if (inputType === "pdf_upload") {
      const file = req.file;
      if (!file) {
        res.status(400).json({ message: "A PDF file is required for pdf_upload" });
        return;
      }

      if (!parsePdfMagicBytes(file.buffer)) {
        res.status(400).json({ message: "Uploaded file is not a valid PDF" });
        return;
      }

      sourceTitle = typeof metadata.sourceTitle === "string" ? metadata.sourceTitle : file.originalname;
      sourceUrl = typeof metadata.sourceUrl === "string" ? metadata.sourceUrl : null;
      sourceAuthor = typeof metadata.sourceAuthor === "string" ? metadata.sourceAuthor : null;
      sourceDate = parseDate(metadata.sourceDate);
      ingestMetadata = {
        ...ingestMetadata,
        pdfBase64: file.buffer.toString("base64"),
        sourceUrl,
        sourceTitle,
        sourceAuthor,
        sourceDate: sourceDate?.toISOString() ?? null,
      };
    }

    const ingestPreview = await axios.post(`${ML_SERVICE_URL}/process/ingest`, {
      text: rawText,
      inputType,
      metadata: ingestMetadata,
    });

    const existingDocument = await DocumentModel.findOne({
      contentHash: ingestPreview.data.contentHash,
      userId,
    });

    if (existingDocument) {
      res.status(200).json({
        documentId: existingDocument._id,
        isDuplicate: true,
      });
      return;
    }

    const document = await DocumentModel.create({
      userId,
      inputType,
      rawText: inputType === "pdf_upload" ? ingestPreview.data.cleanedText : rawText,
      cleanedText: ingestPreview.data.cleanedText,
      sourceUrl,
      sourceTitle,
      sourceAuthor,
      sourceDate,
      language: ingestPreview.data.language,
      charCount: ingestPreview.data.charCount,
      sentenceCount: ingestPreview.data.sentenceCount,
      sentences: ingestPreview.data.sentences,
      status: "PENDING",
      contentHash: ingestPreview.data.contentHash,
      errorMessage: null,
    });

    await ingestionQueue.add(
      "ingestDocument",
      {
        documentId: String(document._id),
        userId,
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2_000,
        },
      },
    );

    res.status(201).json({
      documentId: document._id,
      isDuplicate: false,
    });
  },
);

export default router;

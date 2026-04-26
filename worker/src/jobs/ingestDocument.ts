import { Job } from "bullmq";

import axios from "axios";

import { emitToUser } from "../lib/emitToUser";
import Document, { DocumentStatus } from "../models/Document";
import IngestionLog from "../models/IngestionLog";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";

async function updateStatus(documentId: string, userId: string, status: DocumentStatus): Promise<void> {
  await Document.findByIdAndUpdate(documentId, {
    status,
    errorMessage: null,
  });

  await emitToUser(userId, "ingestion:status", {
    documentId,
    status,
  });
}

export async function processIngestionJob(job: Job): Promise<void> {
  const { documentId, userId } = job.data as { documentId: string; userId: string };
  const startTime = Date.now();
  let inputType = "unknown";

  try {
    await updateStatus(documentId, userId, "CLEANING");

    const doc = await Document.findById(documentId);
    if (!doc) {
      throw new Error("Document not found");
    }

    inputType = doc.inputType;

    const ingestResult = await axios.post(
      `${ML_SERVICE_URL}/process/ingest`,
      {
        text: doc.rawText,
        inputType: doc.inputType,
        metadata: {
          sourceUrl: doc.sourceUrl,
          sourceTitle: doc.sourceTitle,
          sourceAuthor: doc.sourceAuthor,
        },
      },
      { timeout: 30_000 },
    );

    await updateStatus(documentId, userId, "SEGMENTING");

    await Document.findByIdAndUpdate(documentId, {
      cleanedText: ingestResult.data.cleanedText,
      sentences: ingestResult.data.sentences,
      charCount: ingestResult.data.charCount,
      sentenceCount: ingestResult.data.sentenceCount,
      language: ingestResult.data.language,
      contentHash: ingestResult.data.contentHash,
    });

    await updateStatus(documentId, userId, "EXTRACTING_CLAIMS");

    const extractResult = await axios.post(
      `${ML_SERVICE_URL}/process/extract`,
      {
        documentId,
        cleanedText: ingestResult.data.cleanedText,
        sentences: ingestResult.data.sentences,
      },
      { timeout: 60_000 },
    );

    await updateStatus(documentId, userId, "READY");

    await IngestionLog.create({
      documentId,
      inputType: doc.inputType,
      status: "success",
      latencyMs: Date.now() - startTime,
      charCount: ingestResult.data.charCount,
      sentenceCount: ingestResult.data.sentenceCount,
    });

    await emitToUser(userId, "ingestion:complete", {
      documentId,
      claimsExtracted: Array.isArray(extractResult.data.claims) ? extractResult.data.claims.length : 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion error";

    await Document.findByIdAndUpdate(documentId, {
      status: "FAILED",
      errorMessage: message,
    });
    await IngestionLog.create({
      documentId,
      inputType,
      status: "failed",
      latencyMs: Date.now() - startTime,
      errorMessage: message,
    });
    await emitToUser(userId, "ingestion:failed", {
      documentId,
      error: message,
    });

    throw error;
  }
}

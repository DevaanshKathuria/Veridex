import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import axios from "axios";
import { z } from "zod";

import Analysis from "../models/Analysis";
import Document from "../models/Document";
import User from "../models/User";
import { authMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import { verificationQueue } from "../lib/queues";
import { AuthenticatedRequest } from "../types/auth";

const router = Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";

const analyzeRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthenticatedRequest).user?.userId ?? ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? ""),
});

const analyzeBodySchema = z.object({
  documentId: z.string().min(1),
});

const isSameDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate();

router.post(
  "/analyze",
  authMiddleware,
  analyzeRateLimiter,
  validateRequest(analyzeBodySchema),
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { documentId } = req.body as z.infer<typeof analyzeBodySchema>;
    const userId = authReq.user!.userId;

    const [document, user] = await Promise.all([
      Document.findOne({ _id: documentId, userId }),
      User.findById(userId),
    ]);

    if (!document) {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    if (document.status !== "READY") {
      res.status(400).json({ message: "Document is not ready for analysis" });
      return;
    }

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const now = new Date();
    const sameDay = isSameDay(user.lastAnalysisDate, now);
    const currentDailyUsage = sameDay ? user.dailyAnalysesUsed : 0;

    if (user.plan === "FREE" && currentDailyUsage >= 5) {
      res.status(429).json({ message: "Daily analysis limit reached for FREE plan" });
      return;
    }

    const extractResult = await axios.post(
      `${ML_SERVICE_URL}/process/extract`,
      {
        documentId: String(document._id),
        cleanedText: document.cleanedText,
        sentences: document.sentences,
      },
      { timeout: 60_000 },
    );

    const claims = Array.isArray(extractResult.data.claims) ? extractResult.data.claims : [];

    const analysis = await Analysis.create({
      userId,
      documentId: document._id,
      status: "QUEUED",
      claims,
      manipulationTactics: [],
      credibilityScore: null,
      confidenceBand: null,
      credibilityLabel: null,
      scoreBreakdown: null,
      summary: null,
      claimsCount: claims.length,
      verifiedCount: 0,
      disputedCount: 0,
      falseCount: 0,
      unsupportedCount: 0,
      insufficientCount: 0,
      avgConfidence: null,
      avgEvidenceQuality: null,
      processingTimeMs: null,
      pipelineVersion: process.env.PIPELINE_VERSION ?? "1.0.0",
      errorMessage: null,
      completedAt: null,
    });

    await User.findByIdAndUpdate(userId, {
      dailyAnalysesUsed: currentDailyUsage + 1,
      lastAnalysisDate: now,
      $inc: { analysesCount: 1 },
    });

    await verificationQueue.add(
      "verifyDocument",
      {
        analysisId: String(analysis._id),
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

    res.status(201).json({ analysisId: analysis._id });
  },
);

router.get("/analyses", authMiddleware, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.userId;
  const page = Math.max(Number(req.query.page ?? 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 50);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Analysis.find({ userId })
      .select("-claims -manipulationTactics")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Analysis.countDocuments({ userId }),
  ]);

  res.status(200).json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

router.get("/analyses/:id", authMiddleware, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.userId;

  const analysis = await Analysis.findOne({
    _id: req.params.id,
    userId,
  });

  if (!analysis) {
    res.status(404).json({ message: "Analysis not found" });
    return;
  }

  res.status(200).json(analysis);
});

export default router;

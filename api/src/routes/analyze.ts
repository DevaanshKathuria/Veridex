import { Router } from "express";
import axios from "axios";
import { z } from "zod";

import Analysis from "../models/Analysis";
import Document from "../models/Document";
import User from "../models/User";
import { analyzeRateLimiter } from "../middleware/rateLimiter";
import { validateRequest } from "../middleware/validateRequest";
import { verificationQueue } from "../lib/queues";
import { AuthenticatedRequest } from "../types/auth";

const router = Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";

const analyzeBodySchema = z.object({
  documentId: z.string().min(1),
});

const isSameDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate();

router.post(
  "/",
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

export default router;

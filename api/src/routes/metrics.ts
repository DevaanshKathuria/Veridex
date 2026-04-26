import { Router } from "express";

import { adminOnly } from "../middleware/adminOnly";
import { metricsRateLimiter } from "../middleware/rateLimiter";
import PerformanceLog from "../models/PerformanceLog";
import { AuthenticatedRequest } from "../types/auth";

const router = Router();

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

router.get("/", metricsRateLimiter, adminOnly, async (_req: AuthenticatedRequest, res) => {
  const recent = await PerformanceLog.find({})
    .sort({ createdAt: -1 })
    .limit(1000)
    .lean();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const last24h = recent.filter((item) => item.createdAt >= since);
  const totalLatencies = recent.map((item) => item.totalLatencyMs);
  const retrievalLatencies = recent.map((item) => item.retrievalLatencyMs);
  const cacheHitRate =
    last24h.length === 0
      ? 0
      : last24h.reduce((sum, item) => sum + item.cacheHitRate, 0) / last24h.length;
  const openaiTokensUsed = recent.reduce((sum, item) => sum + item.openaiTokensUsed, 0);

  res.status(200).json({
    totalLatencyMs: {
      p50: percentile(totalLatencies, 50),
      p95: percentile(totalLatencies, 95),
    },
    retrievalLatencyMs: {
      p50: percentile(retrievalLatencies, 50),
      p95: percentile(retrievalLatencies, 95),
    },
    cacheHitRate,
    estimatedCostUsd: Number((openaiTokensUsed * 0.000005).toFixed(4)),
    sampleSize: recent.length,
  });
});

export default router;

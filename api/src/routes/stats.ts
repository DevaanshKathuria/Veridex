import { Router } from "express";
import { Types } from "mongoose";

import Analysis from "../models/Analysis";
import { AuthenticatedRequest } from "../types/auth";

const router = Router();

router.get("/", async (req, res) => {
  const userId = new Types.ObjectId((req as AuthenticatedRequest).user!.userId);

  const [summary] = await Analysis.aggregate([
    { $match: { userId } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalAnalyses: { $sum: 1 },
              completedAnalyses: { $sum: { $cond: [{ $eq: ["$status", "COMPLETE"] }, 1, 0] } },
              avgCredibilityScore: { $avg: "$credibilityScore" },
              totalClaimsAnalyzed: { $sum: "$claimsCount" },
              verifiedTotal: { $sum: "$verifiedCount" },
              falseTotal: { $sum: "$falseCount" },
              disputedTotal: { $sum: "$disputedCount" },
              none: { $sum: { $cond: [{ $eq: [{ $size: "$manipulationTactics" }, 0] }, 1, 0] } },
              low: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gt: [{ $size: "$manipulationTactics" }, 0] },
                        { $lt: ["$credibilityScore", 1000] },
                      ],
                    },
                    0,
                    0,
                  ],
                },
              },
            },
          },
        ],
        manipulation: [
          {
            $project: {
              label: {
                $switch: {
                  branches: [
                    { case: { $eq: [{ $size: "$manipulationTactics" }, 0] }, then: "none" },
                    {
                      case: { $lt: [{ $avg: "$manipulationTactics.intensityScore" }, 0.3] },
                      then: "low",
                    },
                    {
                      case: { $lt: [{ $avg: "$manipulationTactics.intensityScore" }, 0.55] },
                      then: "moderate",
                    },
                    {
                      case: { $lt: [{ $avg: "$manipulationTactics.intensityScore" }, 0.75] },
                      then: "high",
                    },
                  ],
                  default: "severe",
                },
              },
            },
          },
          { $group: { _id: "$label", count: { $sum: 1 } } },
        ],
        trend: [
          { $match: { credibilityScore: { $ne: null } } },
          { $sort: { createdAt: -1 } },
          { $limit: 30 },
          { $project: { _id: 0, date: "$createdAt", score: "$credibilityScore" } },
          { $sort: { date: 1 } },
        ],
      },
    },
  ]);

  const totals = summary?.totals?.[0] ?? {};
  const manipulationRows = summary?.manipulation ?? [];
  const manipulationBreakdown = { none: 0, low: 0, moderate: 0, high: 0, severe: 0 };
  for (const row of manipulationRows) {
    if (row._id in manipulationBreakdown) {
      manipulationBreakdown[row._id as keyof typeof manipulationBreakdown] = row.count;
    }
  }

  res.status(200).json({
    totalAnalyses: totals.totalAnalyses ?? 0,
    completedAnalyses: totals.completedAnalyses ?? 0,
    avgCredibilityScore: totals.avgCredibilityScore ?? 0,
    totalClaimsAnalyzed: totals.totalClaimsAnalyzed ?? 0,
    verifiedTotal: totals.verifiedTotal ?? 0,
    falseTotal: totals.falseTotal ?? 0,
    disputedTotal: totals.disputedTotal ?? 0,
    manipulationBreakdown,
    credibilityTrend: summary?.trend ?? [],
  });
});

export default router;

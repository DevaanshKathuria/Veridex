import { Router } from "express";

import { authMiddleware } from "../middleware/auth";
import Analysis from "../models/Analysis";
import { AuthenticatedRequest } from "../types/auth";

const router = Router();

function pagination(query: { page?: unknown; limit?: unknown }) {
  const page = Math.max(Number(query.page ?? 1), 1);
  const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

router.get("/", authMiddleware, async (req, res) => {
  const userId = (req as AuthenticatedRequest).user!.userId;
  const { page, limit, skip } = pagination(req.query);
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const filter = status ? { userId, status } : { userId };

  const [analyses, total] = await Promise.all([
    Analysis.find(filter)
      .select("-claims -manipulationTactics")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Analysis.countDocuments(filter),
  ]);

  res.status(200).json({
    analyses: analyses.map((analysis) => ({
      ...analysis,
      counts: {
        claims: analysis.claimsCount,
        verified: analysis.verifiedCount,
        disputed: analysis.disputedCount,
        false: analysis.falseCount,
        unsupported: analysis.unsupportedCount,
        insufficient: analysis.insufficientCount,
      },
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

router.get("/:id/share", async (req, res) => {
  const analysis = await Analysis.findOne({ _id: req.params.id, status: "COMPLETE" }).lean();
  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.status(200).json(analysis);
});

router.get("/:id", authMiddleware, async (req, res) => {
  const userId = (req as AuthenticatedRequest).user!.userId;
  const analysis = await Analysis.findOne({ _id: req.params.id, userId }).lean();
  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.status(200).json(analysis);
});

router.delete("/:id", authMiddleware, async (req, res) => {
  const userId = (req as AuthenticatedRequest).user!.userId;
  const deleted = await Analysis.findOneAndDelete({ _id: req.params.id, userId }).lean();
  if (!deleted) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.status(200).json({ deleted: true });
});

export default router;

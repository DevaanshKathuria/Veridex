import { Router } from "express";

import Analysis from "../models/Analysis";
import Document from "../models/Document";
import { AuthenticatedRequest } from "../types/auth";

const router = Router();

function pagination(query: { page?: unknown; limit?: unknown }, defaultLimit = 20) {
  const page = Math.max(Number(query.page ?? 1), 1);
  const limit = Math.min(Math.max(Number(query.limit ?? defaultLimit), 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

router.get("/", async (req, res) => {
  const userId = (req as AuthenticatedRequest).user!.userId;
  const { page, limit, skip } = pagination(req.query);

  const [documents, total] = await Promise.all([
    Document.find({ userId })
      .select("-rawText -cleanedText -sentences")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Document.countDocuments({ userId }),
  ]);

  res.status(200).json({
    documents,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

router.get("/:id/status", async (req, res) => {
  const userId = (req as AuthenticatedRequest).user!.userId;
  const document = await Document.findOne({ _id: req.params.id, userId })
    .select("_id status sentenceCount charCount")
    .lean();

  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.status(200).json({
    documentId: String(document._id),
    status: document.status,
    sentenceCount: document.sentenceCount,
    charCount: document.charCount,
  });
});

router.get("/:id", async (req, res) => {
  const userId = (req as AuthenticatedRequest).user!.userId;
  const document = await Document.findOne({ _id: req.params.id, userId }).lean();
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.status(200).json(document);
});

router.delete("/:id", async (req, res) => {
  const userId = (req as AuthenticatedRequest).user!.userId;
  const deleted = await Document.findOneAndDelete({ _id: req.params.id, userId }).lean();
  if (!deleted) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  await Analysis.deleteMany({ documentId: deleted._id, userId });
  res.status(200).json({ deleted: true });
});

export default router;

import { Router } from "express";

import { adminOnly } from "../middleware/adminOnly";
import { ingestionQueue, verificationQueue } from "../lib/queues";
import DeadLetterLog from "../models/DeadLetterLog";
import { AuthenticatedRequest } from "../types/auth";

const router = Router();

router.post("/requeue/:jobId", adminOnly, async (req: AuthenticatedRequest, res) => {
  const deadLetter = await DeadLetterLog.findOne({ jobId: req.params.jobId });
  if (!deadLetter) {
    res.status(404).json({ error: "Dead letter job not found" });
    return;
  }

  const queue =
    deadLetter.queueName === "ingestion-jobs"
      ? ingestionQueue
      : deadLetter.queueName === "verification-jobs"
        ? verificationQueue
        : null;

  if (!queue) {
    res.status(400).json({ error: `Unsupported queue ${deadLetter.queueName}` });
    return;
  }

  const jobPayload = (deadLetter.jobData.jobData ?? deadLetter.jobData) as Record<string, unknown>;
  const job = await queue.add(`requeued:${deadLetter.jobId}`, jobPayload, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2_000,
    },
  });

  deadLetter.requeuedAt = new Date();
  deadLetter.requeuedJobId = String(job.id);
  await deadLetter.save();

  res.status(200).json({ requeued: true, newJobId: job.id });
});

export default router;

import { Queue, Worker } from "bullmq";
import axios from "axios";
import IORedis from "ioredis";
import pino from "pino";

import DeadLetterLog from "../models/DeadLetterLog";

const logger = pino({ name: "veridex-dead-letter-worker" });

const connection = new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
});

export const deadLetterQueue = new Queue("dead-letter", {
  connection,
});

export function createDeadLetterWorker(): Worker {
  return new Worker(
    "dead-letter",
    async (job) => {
      logger.error({ jobId: job.id, queue: job.data.originalQueue }, "Dead letter job received");

      await DeadLetterLog.create({
        queueName: job.data.originalQueue || "unknown",
        jobId: String(job.data.jobId || job.id),
        jobData: job.data,
        errorStack: job.data.errorStack || "Unknown error",
        failedAt: new Date(),
      });

      if (process.env.ALERT_WEBHOOK) {
        await axios
          .post(process.env.ALERT_WEBHOOK, {
            text: `Dead letter job in queue ${job.data.originalQueue}: ${job.data.errorStack?.slice(0, 200)}`,
          })
          .catch(() => undefined);
      }
    },
    { connection },
  );
}

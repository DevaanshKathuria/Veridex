import { Queue, Worker } from "bullmq";
import axios from "axios";
import IORedis from "ioredis";
import pino from "pino";

import DeadLetterLog from "../models/DeadLetterLog";

const logger = pino({ name: "veridex-dead-letter-worker" });

const connection = new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: null,
  retryStrategy: () => null,
});

let connectionWarningShown = false;
let queueWarningShown = false;
let workerWarningShown = false;

connection.on("error", (error) => {
  if (!connectionWarningShown) {
    logger.warn({ error: error.message }, "Dead-letter Redis connection unavailable");
    connectionWarningShown = true;
  }
});

export const deadLetterQueue = new Queue("dead-letter", {
  connection,
});

deadLetterQueue.on("error", (error) => {
  if (!queueWarningShown) {
    logger.warn({ error: error.message }, "Dead-letter queue unavailable");
    queueWarningShown = true;
  }
});

export function createDeadLetterWorker(): Worker {
  const worker = new Worker(
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
  worker.on("error", (error) => {
    if (!workerWarningShown) {
      logger.warn({ error: error.message }, "Dead-letter worker unavailable");
      workerWarningShown = true;
    }
  });
  return worker;
}

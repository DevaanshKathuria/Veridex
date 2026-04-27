import { Worker } from "bullmq";
import IORedis from "ioredis";
import mongoose from "mongoose";
import pino from "pino";

import "./lib/loadEnv";
import { processIngestionJob } from "./jobs/ingestDocument";
import { processVerificationJob } from "./jobs/verifyDocument";
import { createDeadLetterWorker, deadLetterQueue } from "./queues/deadLetterQueue";

const logger = pino({ name: "veridex-worker" });

const redisConnection = new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: null,
  retryStrategy: () => null,
});

const mongoUri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/veridex";
const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 3);
let redisWarningShown = false;

redisConnection.on("error", (error) => {
  if (!redisWarningShown) {
    logger.warn({ error: error.message }, "Redis unavailable; worker is waiting for Redis");
    redisWarningShown = true;
  }
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const connectToMongo = async (): Promise<void> => {
  let connected = false;

  while (!connected) {
    try {
      await mongoose.connect(mongoUri);
      connected = true;
      logger.info("MongoDB connected");
    } catch (error) {
      logger.error({ error }, "MongoDB connection failed, retrying in 5s");
      await wait(5000);
    }
  }
};

const connectToRedis = async (): Promise<void> => {
  while (redisConnection.status !== "ready") {
    try {
      await redisConnection.connect();
      logger.info("Redis connected");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Redis error";
      logger.warn({ error: message }, "Redis connection failed, retrying in 5s");
      await wait(5000);
    }
  }
};

const startWorkers = async (): Promise<void> => {
  await connectToMongo();
  await connectToRedis();

  const ingestionWorker = new Worker("ingestion-jobs", processIngestionJob, {
    connection: redisConnection,
    concurrency,
  });

  const verificationWorker = new Worker("verification-jobs", processVerificationJob, {
    connection: redisConnection,
    concurrency,
  });

  createDeadLetterWorker();

  ingestionWorker.on("failed", async (job, err) => {
    if (job && job.attemptsMade >= 3) {
      await deadLetterQueue
        .add("dead-letter", {
          originalQueue: "ingestion-jobs",
          jobId: job.id,
          jobData: job.data,
          errorStack: err.stack,
        })
        .catch((error) => logger.error({ error }, "Failed to enqueue ingestion dead letter"));
    }
  });

  verificationWorker.on("failed", async (job, err) => {
    if (job && job.attemptsMade >= 3) {
      await deadLetterQueue
        .add("dead-letter", {
          originalQueue: "verification-jobs",
          jobId: job.id,
          jobData: job.data,
          errorStack: err.stack,
        })
        .catch((error) => logger.error({ error }, "Failed to enqueue verification dead letter"));
    }
  });

  logger.info("worker started");
};

void startWorkers();

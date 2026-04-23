import { Worker } from "bullmq";
import IORedis from "ioredis";
import mongoose from "mongoose";
import pino from "pino";

import { processIngestionJob } from "./jobs/ingestDocument";
import { processVerificationJob } from "./jobs/verifyDocument";

const logger = pino({ name: "veridex-worker" });

const redisConnection = new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
});

const mongoUri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/veridex";
const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 3);

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

const startWorkers = async (): Promise<void> => {
  await connectToMongo();

  new Worker("ingestion-jobs", processIngestionJob, {
    connection: redisConnection,
    concurrency,
  });

  new Worker("verification-jobs", processVerificationJob, {
    connection: redisConnection,
    concurrency,
  });

  logger.info("worker started");
};

void startWorkers();

import { Queue } from "bullmq";
import IORedis from "ioredis";

const redisConnection = new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: null,
  retryStrategy: () => null,
});

redisConnection.on("error", (error) => {
  if (process.env.NODE_ENV !== "test") {
    console.warn(`Redis queue connection unavailable: ${error.message}`);
  }
});

export const ingestionQueue = new Queue("ingestion-jobs", {
  connection: redisConnection,
});

export const verificationQueue = new Queue("verification-jobs", {
  connection: redisConnection,
});

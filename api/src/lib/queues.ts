import { Queue } from "bullmq";
import IORedis from "ioredis";

const redisConnection = new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
});

export const ingestionQueue = new Queue("ingestion-jobs", {
  connection: redisConnection,
});

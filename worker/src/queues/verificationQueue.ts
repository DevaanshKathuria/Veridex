import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: null,
  retryStrategy: () => null,
});

connection.on("error", () => undefined);

export const verificationQueue = new Queue("verification-jobs", {
  connection,
});

verificationQueue.on("error", () => undefined);

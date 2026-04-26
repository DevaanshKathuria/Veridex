import { Queue } from "bullmq";
import IORedis from "ioredis";

const redisConnection = new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: null,
  retryStrategy: () => null,
});

let redisWarningShown = false;
let ingestionWarningShown = false;
let verificationWarningShown = false;

redisConnection.on("error", (error) => {
  if (process.env.NODE_ENV !== "test" && !redisWarningShown) {
    console.warn(`Redis queue connection unavailable: ${error.message}`);
    redisWarningShown = true;
  }
});

export const ingestionQueue = new Queue("ingestion-jobs", {
  connection: redisConnection,
});

export const verificationQueue = new Queue("verification-jobs", {
  connection: redisConnection,
});

ingestionQueue.on("error", (error) => {
  if (process.env.NODE_ENV !== "test" && !ingestionWarningShown) {
    console.warn(`Ingestion queue unavailable: ${error.message}`);
    ingestionWarningShown = true;
  }
});

verificationQueue.on("error", (error) => {
  if (process.env.NODE_ENV !== "test" && !verificationWarningShown) {
    console.warn(`Verification queue unavailable: ${error.message}`);
    verificationWarningShown = true;
  }
});

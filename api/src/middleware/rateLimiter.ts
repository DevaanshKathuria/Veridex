import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import IORedis from "ioredis";
import { RedisStore, RedisReply } from "rate-limit-redis";

import { AuthenticatedRequest } from "../types/auth";

const useRedisRateLimiter =
  process.env.REDIS_RATE_LIMITER === "redis" || process.env.NODE_ENV === "production";

const redisClient = useRedisRateLimiter
  ? new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryStrategy: () => null,
    })
  : null;

redisClient?.on("error", (error) => {
  if (process.env.NODE_ENV !== "test") console.warn(`Redis rate limiter unavailable: ${error.message}`);
});

function redisStore(prefix: string): RedisStore | undefined {
  if (!redisClient) return undefined;
  return new RedisStore({
    prefix,
    sendCommand: (command: string, ...args: string[]) =>
      redisClient.call(command, ...args) as Promise<RedisReply>,
  });
}

function keyGenerator(req: AuthenticatedRequest): string {
  return req.user?.userId ?? ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "");
}

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore("rl:auth:"),
  passOnStoreError: true,
  keyGenerator,
});

export const analyzeRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore("rl:analyze:"),
  passOnStoreError: true,
  keyGenerator,
});

export const ingestRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore("rl:ingest:"),
  passOnStoreError: true,
  keyGenerator,
});

export const metricsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore("rl:metrics:"),
  passOnStoreError: true,
  keyGenerator,
});

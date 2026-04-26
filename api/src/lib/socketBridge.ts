import IORedis from "ioredis";

import { emitToUser } from "./socket";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const SOCKET_EVENT_CHANNEL = "socket-events";

let started = false;
let warningShown = false;

const subscriber = new IORedis(REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: null,
  retryStrategy: () => null,
});

function warn(error: unknown): void {
  if (warningShown || process.env.NODE_ENV === "test") {
    return;
  }
  const message = error instanceof Error ? error.message : "Unknown Redis error";
  console.warn(`Redis socket bridge unavailable: ${message}`);
  warningShown = true;
}

subscriber.on("error", warn);

export async function startSocketBridge(): Promise<void> {
  if (started) {
    return;
  }

  try {
    await subscriber.subscribe(SOCKET_EVENT_CHANNEL);
  } catch (error) {
    warn(error);
    return;
  }

  subscriber.on("message", (_channel, message) => {
    try {
      const { userId, event, data } = JSON.parse(message) as {
        userId: string;
        event: string;
        data: object;
      };
      emitToUser(userId, event, data);
    } catch (error) {
      console.error("Failed to process socket bridge event", error);
    }
  });

  started = true;
}

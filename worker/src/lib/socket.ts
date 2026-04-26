import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const SOCKET_EVENT_CHANNEL = "socket-events";

const publisher = new IORedis(REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: null,
  retryStrategy: () => null,
});

publisher.on("error", () => undefined);

export async function emitToUser(
  userId: string,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (publisher.status === "wait") {
    await publisher.connect();
  }
  await publisher.publish(
    SOCKET_EVENT_CHANNEL,
    JSON.stringify({
      userId,
      event,
      data,
    }),
  );
}

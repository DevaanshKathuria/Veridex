import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const SOCKET_EVENT_CHANNEL = "socket:user-events";

const publisher = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export async function emitToUser(
  userId: string,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  await publisher.publish(
    SOCKET_EVENT_CHANNEL,
    JSON.stringify({
      userId,
      event,
      data,
    }),
  );
}

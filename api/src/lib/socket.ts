import { createServer, Server as HTTPServer } from "http";

import IORedis from "ioredis";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Server as SocketIOServer } from "socket.io";

const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:3000";
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "change_me_access";
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const SOCKET_EVENT_CHANNEL = "socket:user-events";

const publisher = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const subscriber = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

let io: SocketIOServer | null = null;
let subscribed = false;

type SocketPayload = {
  userId: string;
  event: string;
  data: Record<string, unknown>;
};

type SocketJwtPayload = JwtPayload & {
  sub?: string;
  userId?: string;
  id?: string;
};

function extractToken(value?: string): string | null {
  if (!value) {
    return null;
  }

  return value.startsWith("Bearer ") ? value.slice("Bearer ".length).trim() : value.trim();
}

function getUserIdFromToken(token: string): string {
  const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as SocketJwtPayload | string;
  if (typeof decoded === "string") {
    throw new Error("Invalid JWT payload");
  }

  const userId = decoded.userId ?? decoded.sub ?? decoded.id;
  if (!userId) {
    throw new Error("Missing user id in JWT payload");
  }

  return String(userId);
}

async function ensureSubscriber(): Promise<void> {
  if (subscribed) {
    return;
  }

  await subscriber.subscribe(SOCKET_EVENT_CHANNEL);
  subscriber.on("message", (channel, message) => {
    if (channel !== SOCKET_EVENT_CHANNEL || !io) {
      return;
    }

    try {
      const payload = JSON.parse(message) as SocketPayload;
      io.to(payload.userId).emit(payload.event, payload.data);
    } catch (error) {
      console.error("Failed to process socket event payload", error);
    }
  });
  subscribed = true;
}

export function initSocket(server: HTTPServer): SocketIOServer {
  if (io) {
    return io;
  }

  io = new SocketIOServer(server, {
    cors: {
      origin: CLIENT_URL,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const authToken = typeof socket.handshake.auth.token === "string" ? socket.handshake.auth.token : undefined;
      const headerToken =
        typeof socket.handshake.headers.authorization === "string"
          ? socket.handshake.headers.authorization
          : undefined;
      const token = extractToken(authToken) ?? extractToken(headerToken);
      if (!token) {
        next(new Error("Missing auth token"));
        return;
      }

      socket.data.userId = getUserIdFromToken(token);
      next();
    } catch (error) {
      next(error as Error);
    }
  });

  io.on("connection", (socket) => {
    const userId = String(socket.data.userId);
    socket.join(userId);
  });

  void ensureSubscriber();

  return io;
}

export async function emitToUser(userId: string, event: string, data: Record<string, unknown>): Promise<void> {
  const payload: SocketPayload = { userId, event, data };
  await publisher.publish(SOCKET_EVENT_CHANNEL, JSON.stringify(payload));
}

export { createServer };

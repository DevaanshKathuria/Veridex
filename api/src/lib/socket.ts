import { Server as HTTPServer } from "http";

import jwt, { JwtPayload } from "jsonwebtoken";
import { Server } from "socket.io";

const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:3000";
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "change_me_access";

let io: Server | null = null;

type SocketJwtPayload = JwtPayload & {
  userId?: string;
  sub?: string;
  id?: string;
};

export function initSocket(httpServer: HTTPServer): Server {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    cors: { origin: CLIENT_URL, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || !token.trim()) {
      next(new Error("Unauthorized"));
      return;
    }

    try {
      const decoded = jwt.verify(token.replace(/^Bearer\s+/i, ""), JWT_ACCESS_SECRET) as SocketJwtPayload | string;
      if (typeof decoded === "string") {
        next(new Error("Invalid token"));
        return;
      }

      const userId = decoded.userId ?? decoded.sub ?? decoded.id;
      if (!userId) {
        next(new Error("Invalid token"));
        return;
      }
      socket.data.userId = String(userId);
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);
    socket.on("disconnect", () => undefined);
  });

  return io;
}

export function emitToUser(userId: string, event: string, data: object): void {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

import { AuthenticatedRequest } from "../types/auth";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "change_me_access";

type AuthPayload = JwtPayload & {
  sub?: string;
  userId?: string;
  id?: string;
  email?: string;
};

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as AuthPayload | string;
    if (typeof decoded === "string") {
      res.status(401).json({ message: "Invalid token payload" });
      return;
    }

    const userId = decoded.userId ?? decoded.sub ?? decoded.id;
    if (!userId) {
      res.status(401).json({ message: "Invalid token payload" });
      return;
    }

    req.user = {
      userId: String(userId),
      email: decoded.email,
    };
    next();
  } catch (_error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

import User from "../models/User";
import { AuthenticatedRequest } from "../types/auth";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "change_me_access";

type AuthPayload = JwtPayload & {
  sub?: string;
  userId?: string;
  id?: string;
  email?: string;
};

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as AuthPayload | string;
    if (typeof decoded === "string") {
      res.status(401).json({ error: "Invalid token payload" });
      return;
    }

    const userId = decoded.userId ?? decoded.sub ?? decoded.id;
    if (!userId) {
      res.status(401).json({ error: "Invalid token payload" });
      return;
    }

    const user = await User.findById(userId).select("-passwordHash").lean();
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    req.user = {
      userId: String(user._id),
      id: String(user._id),
      name: user.name,
      email: user.email,
      plan: user.plan,
      analysesCount: user.analysesCount,
      dailyAnalysesUsed: user.dailyAnalysesUsed,
    };
    next();
  } catch (_error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

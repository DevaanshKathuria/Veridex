import { NextFunction, Response } from "express";

import { AuthenticatedRequest } from "../types/auth";

export function isAdmin(req: AuthenticatedRequest): boolean {
  const emails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return req.user?.plan === "PRO" || (req.user?.email ? emails.includes(req.user.email.toLowerCase()) : false);
}

export function adminOnly(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!isAdmin(req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}

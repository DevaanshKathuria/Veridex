import crypto from "crypto";

import bcrypt from "bcryptjs";
import { Response, Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { authMiddleware } from "../middleware/auth";
import { authRateLimiter } from "../middleware/rateLimiter";
import { validateRequest } from "../middleware/validateRequest";
import RefreshToken from "../models/RefreshToken";
import User from "../models/User";
import { AuthenticatedRequest } from "../types/auth";

const router = Router();

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "change_me_access";
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_COOKIE = "refreshToken";

const authSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8),
});

const registerSchema = authSchema.extend({
  name: z.string().trim().min(1).max(120),
});

function signAccessToken(user: { _id: unknown; email: string; plan: "FREE" | "PRO" }): string {
  return jwt.sign(
    {
      userId: String(user._id),
      email: user.email,
      plan: user.plan,
    },
    JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL },
  );
}

function newRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

function refreshExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    expires: refreshExpiry(),
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

async function createRefreshToken(userId: unknown): Promise<string> {
  const token = newRefreshToken();
  await RefreshToken.create({
    userId,
    token,
    expiresAt: refreshExpiry(),
  });
  return token;
}

function publicUser(user: { _id: unknown; name: string; email: string; plan: "FREE" | "PRO" }) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    plan: user.plan,
  };
}

router.post("/register", authRateLimiter, validateRequest(registerSchema), async (req, res) => {
  const { name, email, password } = req.body as z.infer<typeof registerSchema>;
  const existing = await User.findOne({ email });
  if (existing) {
    res.status(409).json({ error: "Email is already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name,
    email,
    passwordHash,
    plan: "FREE",
    analysesCount: 0,
    dailyAnalysesUsed: 0,
    lastAnalysisDate: new Date(0),
  });

  const accessToken = signAccessToken(user);
  const refreshToken = await createRefreshToken(user._id);
  setRefreshCookie(res, refreshToken);

  res.status(201).json({ accessToken, user: publicUser(user) });
});

router.post("/login", authRateLimiter, validateRequest(authSchema.omit({ name: true })), async (req, res) => {
  const { email, password } = req.body as z.infer<typeof authSchema>;
  const user = await User.findOne({ email });
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  await RefreshToken.deleteMany({ userId: user._id });
  const accessToken = signAccessToken(user);
  const refreshToken = await createRefreshToken(user._id);
  setRefreshCookie(res, refreshToken);

  res.status(200).json({ accessToken, user: publicUser(user) });
});

router.post("/refresh", authRateLimiter, async (req, res) => {
  const token = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (!token) {
    res.status(401).json({ error: "Missing refresh token" });
    return;
  }

  const stored = await RefreshToken.findOne({
    token,
    expiresAt: { $gt: new Date() },
  });
  if (!stored) {
    clearRefreshCookie(res);
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }

  const user = await User.findById(stored.userId);
  if (!user) {
    await RefreshToken.deleteOne({ _id: stored._id });
    clearRefreshCookie(res);
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.status(200).json({ accessToken: signAccessToken(user) });
});

router.post("/logout", async (req, res) => {
  const token = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (token) {
    await RefreshToken.deleteOne({ token });
  }
  clearRefreshCookie(res);
  res.status(200).json({ success: true });
});

router.get("/me", authMiddleware, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const user = await User.findById(authReq.user!.userId).select("-passwordHash").lean();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.status(200).json({
    id: String(user._id),
    name: user.name,
    email: user.email,
    plan: user.plan,
    analysesCount: user.analysesCount,
    dailyAnalysesUsed: user.dailyAnalysesUsed,
  });
});

export default router;

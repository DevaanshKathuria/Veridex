import { Request } from "express";

export type RequestUser = {
  userId: string;
  id?: string;
  name?: string;
  email: string;
  plan: "FREE" | "PRO";
  analysesCount?: number;
  dailyAnalysesUsed?: number;
  [key: string]: unknown;
};

export type AuthenticatedRequest = Request & {
  user?: RequestUser;
};

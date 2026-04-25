import { Request } from "express";

export type RequestUser = {
  userId: string;
  email?: string;
  [key: string]: unknown;
};

export type AuthenticatedRequest = Request & {
  user?: RequestUser;
};

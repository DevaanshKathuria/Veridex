declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        id?: string;
        name?: string;
        email: string;
        plan: "FREE" | "PRO";
        analysesCount?: number;
        dailyAnalysesUsed?: number;
        [key: string]: unknown;
      };
    }
  }
}

export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email?: string;
        [key: string]: unknown;
      };
    }
  }
}

export {};

import { createServer, Server as HTTPServer } from "http";

import cookieParser from "cookie-parser";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import morgan from "morgan";

import "./lib/loadEnv";
import adminRouter from "./routes/admin";
import analysesRouter from "./routes/analyses";
import analyzeRouter from "./routes/analyze";
import authRouter from "./routes/auth";
import documentsRouter from "./routes/documents";
import ingestRouter from "./routes/ingest";
import metricsRouter from "./routes/metrics";
import rootRouter from "./routes";
import statsRouter from "./routes/stats";
import { authMiddleware } from "./middleware/auth";
import { initSocket } from "./lib/socket";
import { startSocketBridge } from "./lib/socketBridge";

export const app = express();

const validateEnv = (): void => {
  const required = ["MONGODB_URI", "REDIS_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "ML_SERVICE_URL"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required env var${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
  }
};

const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:3000";
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/veridex";

let server: HTTPServer | null = null;

app.use(helmet());
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);
app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date(),
  });
});

app.use("/api/auth", authRouter);
app.use("/api/ingest", authMiddleware, ingestRouter);
app.use("/api/documents", authMiddleware, documentsRouter);
app.use("/api/analyze", authMiddleware, analyzeRouter);
app.use("/api/analyses", analysesRouter);
app.use("/api/stats", authMiddleware, statsRouter);
app.use("/api/admin", authMiddleware, adminRouter);
app.use("/api/metrics", authMiddleware, metricsRouter);
app.use("/api", rootRouter);

app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const connectToMongo = async (): Promise<void> => {
  let connected = false;

  while (!connected) {
    try {
      await mongoose.connect(MONGODB_URI);
      connected = true;
      console.log("MongoDB connected");
    } catch (error) {
      console.error("MongoDB connection failed, retrying in 5s", error);
      await wait(5000);
    }
  }
};

const startServer = async (): Promise<void> => {
  try {
    validateEnv();
    await connectToMongo();

    server = createServer(app);
    initSocket(server);
    await startSocketBridge();

    server.listen(PORT, () => {
      console.log(`API listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start API", error);
    process.exit(1);
  }
};

void startServer();

import { Server as HTTPServer } from "http";

import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import morgan from "morgan";

import routes from "./routes";
import { createServer, initSocket } from "./lib/socket";

export const app = express();

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
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api", routes);

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date(),
  });
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
    await connectToMongo();

    server = createServer(app);
    initSocket(server);

    server.listen(PORT, () => {
      console.log(`API listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start API", error);
    process.exit(1);
  }
};

void startServer();

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function normalizeHostLocalEnv(): void {
  if (existsSync("/.dockerenv")) return;
  const replacements: Record<string, [string, string]> = {
    MONGODB_URI: ["mongodb://mongodb:", "mongodb://127.0.0.1:"],
    REDIS_URL: ["redis://redis:", "redis://127.0.0.1:"],
    ML_SERVICE_URL: ["http://ml:", "http://127.0.0.1:"],
    ELASTICSEARCH_URL: ["http://elasticsearch:", "http://127.0.0.1:"],
  };
  for (const [key, [from, to]] of Object.entries(replacements)) {
    const value = process.env[key];
    if (value?.startsWith(from)) {
      process.env[key] = value.replace(from, to);
    }
  }
}

export function loadEnv(): void {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    const contents = readFileSync(filePath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...parts] = trimmed.split("=");
      if (process.env[key] === undefined) {
        process.env[key] = parts.join("=").replace(/^['"]|['"]$/g, "");
      }
    }
  }
  normalizeHostLocalEnv();
}

loadEnv();

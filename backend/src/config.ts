import dotenv from "dotenv";
import path from "path";

const isProduction = process.env.NODE_ENV === "production";
if (!isProduction) {
  dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
  dotenv.config();
}

function normalizeUrl(input: string, fallback: string): string {
  const value = input.trim();
  if (!value) return fallback;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function resolveWebAppUrl(): string {
  const productionFallback = "https://diplomatic-communication-production-6b54.up.railway.app";
  const raw = process.env.WEBAPP_URL ?? "";
  const normalized = normalizeUrl(raw, isProduction ? productionFallback : "http://localhost:5173");
  if (isProduction && /ngrok-free\.dev/i.test(normalized)) {
    return productionFallback;
  }
  return normalized;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  botToken: process.env.BOT_TOKEN ?? "",
  webAppUrl: resolveWebAppUrl(),
  backendUrl: normalizeUrl(process.env.BACKEND_URL ?? "", "http://localhost:3001"),
  seedDemoData: process.env.SEED_DEMO_DATA === "true" || process.env.NODE_ENV !== "production",
  adminTelegramIds: (process.env.ADMIN_TELEGRAM_IDS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
};

export const uploadsDir = path.resolve(process.cwd(), "src", "uploads");

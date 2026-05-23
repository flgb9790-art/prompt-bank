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
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || process.env.BOT_TOKEN?.trim() || "",
  telegramChannelId: process.env.TELEGRAM_CHANNEL_ID?.trim() || "",
  webAppUrl: resolveWebAppUrl(),
  backendUrl: normalizeUrl(process.env.BACKEND_URL ?? "", "http://localhost:3001"),
  publicSiteUrl: normalizeUrl(
    process.env.PUBLIC_SITE_URL ?? process.env.WEBAPP_URL ?? "",
    isProduction ? "https://diplomatic-communication-production-6b54.up.railway.app" : "http://localhost:5173"
  ),
  publicBackendUrl: normalizeUrl(
    process.env.PUBLIC_BACKEND_URL ?? process.env.MEDIA_PUBLIC_URL ?? process.env.BACKEND_URL ?? "",
    "http://localhost:3001"
  ),
  seedDemoData: process.env.SEED_DEMO_DATA === "true",
  adminTelegramIds: (process.env.ADMIN_TELEGRAM_IDS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  supabaseUrl: normalizeUrl(process.env.SUPABASE_URL ?? "", ""),
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "uploads",
  mediaPublicUrl: normalizeUrl(
    process.env.MEDIA_PUBLIC_URL ?? process.env.PUBLIC_BACKEND_URL ?? process.env.VITE_MEDIA_CDN_URL ?? process.env.BACKEND_URL ?? "",
    ""
  )
};

export const uploadsDir = process.env.UPLOADS_DIR?.trim()
  ? path.resolve(process.env.UPLOADS_DIR.trim())
  : path.resolve(process.cwd(), "src", "uploads");

export function isSupabaseStorageEnabled() {
  return Boolean(config.supabaseUrl && config.supabaseServiceKey && config.supabaseStorageBucket);
}

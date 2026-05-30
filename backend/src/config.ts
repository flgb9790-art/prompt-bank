import dotenv from "dotenv";
import path from "path";
import { isSamePublicHost, urlHostname } from "./utils/telegramWebContent";

const isProduction = process.env.NODE_ENV === "production";
if (!isProduction) {
  dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
  dotenv.config();
}

/** Railway: mini app (статика, HTML). */
const PRODUCTION_MINIAPP_URL = "https://diplomatic-communication-production-6b54.up.railway.app";
/** Railway: Express API + /uploads. */
const PRODUCTION_BACKEND_URL = "https://prompt-bank-production.up.railway.app";

function normalizeUrl(input: string, fallback: string): string {
  const value = input.trim();
  if (!value) return fallback.replace(/\/$/, "");
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/$/, "");
}

function resolveWebAppUrl(): string {
  const raw = process.env.WEBAPP_URL ?? "";
  let url = normalizeUrl(raw, isProduction ? PRODUCTION_MINIAPP_URL : "http://localhost:5173");

  if (isProduction && /ngrok-free\.dev/i.test(url)) {
    url = PRODUCTION_MINIAPP_URL;
  }

  if (isProduction && isSamePublicHost(url, PRODUCTION_BACKEND_URL)) {
    console.warn(
      "[config] WEBAPP_URL указывает на backend API; подставляем URL mini app:",
      PRODUCTION_MINIAPP_URL
    );
    url = PRODUCTION_MINIAPP_URL;
  }

  return url;
}

function resolvePublicBackendUrl(webAppUrl: string): string {
  const raw =
    process.env.PUBLIC_BACKEND_URL?.trim() ||
    process.env.MEDIA_PUBLIC_URL?.trim() ||
    process.env.BACKEND_URL?.trim() ||
    "";

  let url = normalizeUrl(raw, isProduction ? PRODUCTION_BACKEND_URL : "http://localhost:3001");

  if (isProduction && isSamePublicHost(url, webAppUrl)) {
    console.warn(
      "[config] PUBLIC_BACKEND_URL/BACKEND_URL указывает на mini app; подставляем API:",
      PRODUCTION_BACKEND_URL
    );
    url = PRODUCTION_BACKEND_URL;
  }

  return url;
}

const webAppUrl = resolveWebAppUrl();
const publicBackendUrl = resolvePublicBackendUrl(webAppUrl);

export const config = {
  port: Number(process.env.PORT ?? 3001),
  botToken: process.env.BOT_TOKEN ?? "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || process.env.BOT_TOKEN?.trim() || "",
  telegramBotUsername: (process.env.TELEGRAM_BOT_USERNAME ?? "prmtb_bot").trim().replace(/^@/, ""),
  telegramChannelId: process.env.TELEGRAM_CHANNEL_ID?.trim() || "",
  telegramChannelUrl: process.env.TELEGRAM_CHANNEL_URL?.trim() || "",
  pinterestAccessToken: process.env.PINTEREST_ACCESS_TOKEN?.trim() || "",
  pinterestBoardId: process.env.PINTEREST_BOARD_ID?.trim() || "",
  pinterestApiBaseUrl: normalizeUrl(
    process.env.PINTEREST_API_BASE_URL ?? "",
    "https://api.pinterest.com/v5"
  ),
  webAppUrl,
  backendUrl: normalizeUrl(process.env.BACKEND_URL ?? "", isProduction ? publicBackendUrl : "http://localhost:3001"),
  publicSiteUrl: normalizeUrl(
    process.env.PUBLIC_SITE_URL ?? process.env.WEBAPP_URL ?? "",
    webAppUrl
  ),
  publicBackendUrl,
  seedDemoData: process.env.SEED_DEMO_DATA === "true",
  adminTelegramIds: (process.env.ADMIN_TELEGRAM_IDS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  supabaseUrl: normalizeUrl(process.env.SUPABASE_URL ?? "", ""),
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "uploads",
  mediaPublicUrl: normalizeUrl(
    process.env.MEDIA_PUBLIC_URL?.trim() || publicBackendUrl,
    publicBackendUrl
  )
};

export const uploadsDir = process.env.UPLOADS_DIR?.trim()
  ? path.resolve(process.env.UPLOADS_DIR.trim())
  : path.resolve(process.cwd(), "src", "uploads");

export function isSupabaseStorageEnabled() {
  return Boolean(config.supabaseUrl && config.supabaseServiceKey && config.supabaseStorageBucket);
}

export function logResolvedPublicUrls() {
  console.info("[config] WEBAPP_URL (mini app):", config.webAppUrl);
  console.info("[config] PUBLIC_BACKEND_URL (media API):", config.publicBackendUrl);
  if (isProduction && urlHostname(config.webAppUrl) === urlHostname(config.publicBackendUrl)) {
    console.warn("[config] WEBAPP_URL и PUBLIC_BACKEND_URL на одном хосте — проверьте переменные Railway");
  }
}

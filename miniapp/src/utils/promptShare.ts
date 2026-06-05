import { isTelegramMiniAppContext } from "../telegram";
import { buildPromptPublicPath, buildPromptPublicUrl } from "./siteUrl";

const PROMPT_START_PARAM_PREFIX = "prompt_";
const DEFAULT_TELEGRAM_BOT_USERNAME = "prmtb_bot";

function resolveTelegramBotUsername(): string {
  const fromEnv = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined)?.trim().replace(/^@/, "");
  return fromEnv || DEFAULT_TELEGRAM_BOT_USERNAME;
}

export function buildPromptShareUrl(promptId: number): string {
  if (isTelegramMiniAppContext() || isTelegramInAppBrowser()) {
    return buildTelegramMiniAppPromptLink(promptId, resolveTelegramBotUsername());
  }

  return buildPromptPublicUrl(promptId);
}

export function buildPromptStartParam(promptId: number): string {
  return `${PROMPT_START_PARAM_PREFIX}${promptId}`;
}

export function parsePromptStartParam(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^prompt_(\d+)$/.exec(value.trim());
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function parsePromptIdFromPathname(pathname = window.location.pathname): number | null {
  const match = /^\/p\/(\d+)\/?$/.exec(pathname);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function parsePromptIdFromLocation(): number | null {
  const fromPath = parsePromptIdFromPathname();
  if (fromPath) return fromPath;

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("prompt");
  if (fromQuery) {
    const id = Number(fromQuery);
    if (Number.isFinite(id) && id > 0) return id;
  }

  const fromStartParam = parsePromptStartParam(params.get("tgWebAppStartParam"));
  if (fromStartParam) return fromStartParam;

  const unsafeStartParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
  return parsePromptStartParam(typeof unsafeStartParam === "string" ? unsafeStartParam : null);
}

export function buildTelegramMiniAppPromptLink(promptId: number, botUsername: string): string {
  const username = botUsername.replace(/^@/, "").trim();
  const startParam = buildPromptStartParam(promptId);
  return `https://t.me/${username}?startapp=${encodeURIComponent(startParam)}`;
}

export function isTelegramInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  if (isTelegramMiniAppContext()) return false;
  return /Telegram/i.test(navigator.userAgent);
}

export function maybeRedirectTelegramBrowserToMiniApp(botUsername?: string | null): boolean {
  if (isTelegramMiniAppContext()) return false;

  const promptId = parsePromptIdFromLocation();
  if (!promptId || !isTelegramInAppBrowser()) return false;

  const username = botUsername?.replace(/^@/, "").trim() || resolveTelegramBotUsername();
  window.location.replace(buildTelegramMiniAppPromptLink(promptId, username));
  return true;
}

export function clearPromptShareUrl(): void {
  const url = new URL(window.location.href);
  const hadQueryPrompt = url.searchParams.has("prompt");
  const hadPromptPath = Boolean(parsePromptIdFromPathname(url.pathname));
  if (!hadQueryPrompt && !hadPromptPath) return;
  url.searchParams.delete("prompt");
  if (hadPromptPath) {
    url.pathname = "/";
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}

export function setPromptShareUrl(promptId: number, replace = false): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("prompt");
  url.pathname = buildPromptPublicPath(promptId);
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (replace) {
    window.history.replaceState({}, "", next);
  } else {
    window.history.pushState({}, "", next);
  }
}

export function migrateLegacyPromptQueryToPath(): boolean {
  const url = new URL(window.location.href);
  const legacy = url.searchParams.get("prompt");
  if (!legacy || !/^\d+$/.test(legacy)) return false;
  url.searchParams.delete("prompt");
  url.pathname = buildPromptPublicPath(Number(legacy));
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  return true;
}

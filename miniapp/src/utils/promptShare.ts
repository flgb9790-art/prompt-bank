import { isTelegramMiniAppContext } from "../telegram";

const PROMPT_START_PARAM_PREFIX = "prompt_";

function resolveTelegramBotUsername(): string | null {
  const fromEnv = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined)?.trim().replace(/^@/, "");
  return fromEnv || null;
}

export function buildPromptShareUrl(promptId: number): string {
  const botUsername = resolveTelegramBotUsername();
  if (botUsername && (isTelegramMiniAppContext() || isTelegramInAppBrowser())) {
    return buildTelegramMiniAppPromptLink(promptId, botUsername);
  }

  const url = new URL(window.location.href);
  url.searchParams.set("prompt", String(promptId));
  return url.toString();
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

export function parsePromptIdFromLocation(): number | null {
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
  if (window.Telegram?.WebApp?.initData?.trim()) return false;

  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (
    params.has("tgWebAppData") ||
    params.has("tgWebAppVersion") ||
    hashParams.has("tgWebAppData") ||
    hashParams.has("tgWebAppVersion")
  ) {
    return false;
  }

  return /Telegram/i.test(navigator.userAgent);
}

export function maybeRedirectTelegramBrowserToMiniApp(botUsername?: string | null): boolean {
  const username = botUsername?.replace(/^@/, "").trim();
  if (!username) return false;

  const promptId = parsePromptIdFromLocation();
  if (!promptId || !isTelegramInAppBrowser()) return false;

  window.location.replace(buildTelegramMiniAppPromptLink(promptId, username));
  return true;
}

export function clearPromptShareUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("prompt")) return;
  url.searchParams.delete("prompt");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}

export function setPromptShareUrl(promptId: number, replace = false): void {
  const url = new URL(window.location.href);
  url.searchParams.set("prompt", String(promptId));
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (replace) {
    window.history.replaceState({}, "", next);
  } else {
    window.history.pushState({}, "", next);
  }
}

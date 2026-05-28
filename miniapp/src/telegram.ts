import type { TelegramUser } from "./types";

export const mockTelegramUser: TelegramUser = {
  id: 1,
  username: "mock_user",
  first_name: "Mock",
  last_name: "User"
};

export type TelegramViewportChangedHandler = () => void;

export type TelegramBackButton = {
  show: () => void;
  hide: () => void;
  onClick: (handler: () => void) => void;
  offClick: (handler: () => void) => void;
};

export type TelegramWebApp = {
  ready?: () => void;
  expand?: () => void;
  requestFullscreen?: () => void;
  disableVerticalSwipes?: () => void;
  enableVerticalSwipes?: () => void;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  onEvent?: (eventType: "viewportChanged", handler: TelegramViewportChangedHandler) => void;
  offEvent?: (eventType: "viewportChanged", handler: TelegramViewportChangedHandler) => void;
  BackButton?: TelegramBackButton;
  isExpanded?: boolean;
  initData?: string;
  initDataUnsafe?: { user?: TelegramUser; start_param?: string };
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

function parseUserFromInitData(rawInitData?: string): TelegramUser | null {
  if (!rawInitData) return null;
  try {
    const params = new URLSearchParams(rawInitData);
    const rawUser = params.get("user");
    if (!rawUser) return null;
    const parsed = JSON.parse(rawUser) as TelegramUser;
    if (parsed?.id) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function hasTelegramWebAppUrlHints(): boolean {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return (
    params.has("tgWebAppData") ||
    params.has("tgWebAppVersion") ||
    params.has("tgWebAppStartParam") ||
    hashParams.has("tgWebAppData") ||
    hashParams.has("tgWebAppVersion") ||
    hashParams.has("tgWebAppStartParam")
  );
}

export function isTelegramMiniAppContext(): boolean {
  const webApp = window.Telegram?.WebApp;
  if (webApp) {
    if (webApp.initData?.trim()) return true;
    if (webApp.initDataUnsafe?.user?.id) return true;
    if (webApp.initDataUnsafe?.start_param?.trim()) return true;

    const platform = (webApp as { platform?: string }).platform;
    if (platform && platform !== "unknown" && platform !== "web") return true;
  }

  return hasTelegramWebAppUrlHints();
}

export function resolveTelegramUser(): TelegramUser | null {
  const direct = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (direct?.id) {
    return direct;
  }

  const fromWebAppInitData = parseUserFromInitData(window.Telegram?.WebApp?.initData);
  if (fromWebAppInitData?.id) {
    return fromWebAppInitData;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const rawFromUrl = searchParams.get("tgWebAppData");
  if (rawFromUrl) {
    const decoded = decodeURIComponent(rawFromUrl);
    const fromUrl = parseUserFromInitData(decoded) ?? parseUserFromInitData(rawFromUrl);
    if (fromUrl?.id) {
      return fromUrl;
    }
  }

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const rawFromHash = hashParams.get("tgWebAppData");
  if (rawFromHash) {
    const decoded = decodeURIComponent(rawFromHash);
    const fromHash = parseUserFromInitData(decoded) ?? parseUserFromInitData(rawFromHash);
    if (fromHash?.id) {
      return fromHash;
    }
  }

  return null;
}

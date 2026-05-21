import type { TelegramUser } from "./types";

export const mockTelegramUser: TelegramUser = {
  id: 1,
  username: "mock_user",
  first_name: "Mock",
  last_name: "User"
};

export type TelegramViewportChangedHandler = () => void;

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
  isExpanded?: boolean;
  initData?: string;
  initDataUnsafe?: { user?: TelegramUser };
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

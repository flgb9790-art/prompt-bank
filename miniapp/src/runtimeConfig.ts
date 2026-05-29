export type PromptBankRuntimeConfig = {
  backendUrl?: string;
  mediaCdnUrl?: string;
};

declare global {
  interface Window {
    __PROMPT_BANK_CONFIG__?: PromptBankRuntimeConfig;
  }
}

function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/$/, "");
}

export function getBackendBaseUrl(): string {
  const runtime = typeof window !== "undefined" ? window.__PROMPT_BANK_CONFIG__?.backendUrl : "";
  if (runtime?.trim()) {
    return normalizeOrigin(runtime);
  }

  const baked = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
  if (baked) {
    return normalizeOrigin(baked);
  }

  if (import.meta.env.DEV) {
    return "http://localhost:3001";
  }

  return "";
}

export function getMediaCdnBaseUrl(): string {
  const runtime = typeof window !== "undefined" ? window.__PROMPT_BANK_CONFIG__?.mediaCdnUrl : "";
  if (runtime?.trim()) {
    return normalizeOrigin(runtime);
  }

  const baked = (import.meta.env.VITE_MEDIA_CDN_URL as string | undefined)?.trim();
  if (baked) {
    return normalizeOrigin(baked);
  }

  return getBackendBaseUrl();
}

export function isBackendConfigured(): boolean {
  return Boolean(getBackendBaseUrl());
}

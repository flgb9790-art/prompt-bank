const DEFAULT_SITE_URL = "https://prompt-bank.one";

export function getSiteOrigin(): string {
  const fromEnv = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      // ignore invalid env
    }
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return DEFAULT_SITE_URL;
}

export function buildPromptPublicPath(promptId: number): string {
  return `/p/${promptId}`;
}

export function buildPromptPublicUrl(promptId: number): string {
  return `${getSiteOrigin()}${buildPromptPublicPath(promptId)}`;
}

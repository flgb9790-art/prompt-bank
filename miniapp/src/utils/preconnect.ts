import { getBackendBaseUrl, getMediaCdnBaseUrl } from "../runtimeConfig";

function appendOriginHint(origin: string, marker: string) {
  if (document.querySelector(`link[data-preconnect="${marker}"]`)) return;

  const preconnect = document.createElement("link");
  preconnect.rel = "preconnect";
  preconnect.href = origin;
  preconnect.crossOrigin = "anonymous";
  preconnect.dataset.preconnect = marker;

  const dnsPrefetch = document.createElement("link");
  dnsPrefetch.rel = "dns-prefetch";
  dnsPrefetch.href = origin;
  dnsPrefetch.dataset.preconnect = marker;

  document.head.append(preconnect, dnsPrefetch);
}

function collectMediaOrigins(): string[] {
  const seen = new Set<string>();
  const candidates = [
    getMediaCdnBaseUrl(),
    getBackendBaseUrl(),
    (import.meta.env.VITE_MEDIA_CDN_URL as string | undefined)?.trim(),
    (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim()
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    try {
      seen.add(new URL(raw).origin);
    } catch {
      // ignore invalid URL
    }
  }

  return [...seen];
}

export function setupApiPreconnect() {
  const origins = collectMediaOrigins();
  origins.forEach((origin, index) => {
    appendOriginHint(origin, index === 0 ? "api" : `media-${index}`);
  });
}

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

export function setupApiPreconnect() {
  const apiUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
  const mediaUrl = (import.meta.env.VITE_MEDIA_CDN_URL as string | undefined)?.trim();

  try {
    if (apiUrl) appendOriginHint(new URL(apiUrl).origin, "api");
    if (mediaUrl) {
      const mediaOrigin = new URL(mediaUrl).origin;
      if (!apiUrl || mediaOrigin !== new URL(apiUrl).origin) {
        appendOriginHint(mediaOrigin, "media");
      }
    }
  } catch {
    // ignore invalid URL
  }
}

export function setupApiPreconnect() {
  const raw = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
  if (!raw) return;

  try {
    const origin = new URL(raw).origin;
    const existing = document.querySelector(`link[data-api-preconnect="1"]`);
    if (existing) return;

    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = origin;
    preconnect.crossOrigin = "anonymous";
    preconnect.dataset.apiPreconnect = "1";

    const dnsPrefetch = document.createElement("link");
    dnsPrefetch.rel = "dns-prefetch";
    dnsPrefetch.href = origin;
    dnsPrefetch.dataset.apiPreconnect = "1";

    document.head.append(preconnect, dnsPrefetch);
  } catch {
    // ignore invalid URL
  }
}

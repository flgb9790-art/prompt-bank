export function buildPromptShareUrl(promptId: number): string {
  const url = new URL(window.location.href);
  url.searchParams.set("prompt", String(promptId));
  return url.toString();
}

export function parsePromptIdFromLocation(): number | null {
  const value = new URLSearchParams(window.location.search).get("prompt");
  if (!value) return null;
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
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

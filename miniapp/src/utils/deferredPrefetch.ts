const PREFETCH_DELAY_MS = 2000;

export function runDeferred(task: () => void, delayMs = PREFETCH_DELAY_MS) {
  if (typeof window === "undefined") return;
  window.setTimeout(task, delayMs);
}

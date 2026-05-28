const VIEWPORT_LOCKED =
  "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content";

let pinchBlockCount = 0;
let pinchListenerAttached = false;

function onDocumentTouchMove(event: TouchEvent) {
  if (event.touches.length < 2 || !event.cancelable) return;
  const target = event.target;
  if (target instanceof Element && target.closest(".media-lightbox-image")) return;
  event.preventDefault();
}

export function lockTelegramViewport() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (meta) {
    meta.setAttribute("content", VIEWPORT_LOCKED);
  }

  document.documentElement.style.touchAction = "manipulation";
  document.body.style.touchAction = "manipulation";
}

export function setTelegramPagePinchBlocked(blocked: boolean) {
  if (blocked) {
    pinchBlockCount += 1;
  } else {
    pinchBlockCount = Math.max(0, pinchBlockCount - 1);
  }

  if (pinchBlockCount > 0 && !pinchListenerAttached) {
    document.addEventListener("touchmove", onDocumentTouchMove, { passive: false, capture: true });
    pinchListenerAttached = true;
    return;
  }

  if (pinchBlockCount === 0 && pinchListenerAttached) {
    document.removeEventListener("touchmove", onDocumentTouchMove, { capture: true });
    pinchListenerAttached = false;
  }
}

export async function clearStaleServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    // ignore
  }
}

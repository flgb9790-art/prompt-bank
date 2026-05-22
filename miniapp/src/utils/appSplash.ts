declare global {
  interface Window {
    __APP_SPLASH_AT?: number;
    __hideAppSplash?: () => void;
  }
}

const MIN_VISIBLE_MS = 300;

export function markAppSplashVisible() {
  if (!window.__APP_SPLASH_AT) {
    window.__APP_SPLASH_AT = Date.now();
  }
}

export function hideAppSplash() {
  if (typeof window.__hideAppSplash === "function") {
    window.__hideAppSplash();
    return;
  }

  const splash = document.getElementById("app-splash");
  if (!splash) return;

  const shownAt = window.__APP_SPLASH_AT ?? Date.now();
  const delay = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt));
  window.setTimeout(() => {
    splash.remove();
    document.documentElement.classList.remove("app-booting");
  }, delay);
}

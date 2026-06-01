export function registerWebPwa() {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const inTelegram =
    Boolean(window.Telegram?.WebApp?.initData) ||
    params.has("tgWebAppData") ||
    hashParams.has("tgWebAppData");

  if (inTelegram) return;

  const register = () => {
    void import("virtual:pwa-register").then(({ registerSW }) => {
      registerSW({ immediate: false });
    });
  };

  const schedule =
    typeof window.requestIdleCallback === "function"
      ? (cb: () => void) => window.requestIdleCallback(cb, { timeout: 5000 })
      : (cb: () => void) => window.setTimeout(cb, 3000);

  schedule(register);
}

export function registerWebPwa() {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const inTelegram =
    Boolean(window.Telegram?.WebApp?.initData) ||
    params.has("tgWebAppData") ||
    hashParams.has("tgWebAppData");

  if (inTelegram) return;

  void import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}

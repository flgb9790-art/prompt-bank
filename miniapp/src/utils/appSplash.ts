const MIN_VISIBLE_MS = 450;

let shownAt = 0;

export function noteAppSplashShown() {
  if (!shownAt) {
    shownAt = Date.now();
  }
}

export function hideAppSplash() {
  const remove = () => {
    document.getElementById("app-splash")?.remove();
    document.documentElement.classList.remove("app-booting");
  };

  const elapsed = shownAt ? Date.now() - shownAt : MIN_VISIBLE_MS;
  const delay = Math.max(0, MIN_VISIBLE_MS - elapsed);

  window.setTimeout(remove, delay);
}

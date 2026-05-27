export type ViewMode = "grid" | "list" | "pinterest";

export const VIEW_MODE_STORAGE_KEY = "promptBankViewMode";
export const PINTEREST_PAGE_SIZE = 12;

const VALID_MODES: ViewMode[] = ["grid", "list", "pinterest"];

export function readViewMode(defaultMode: ViewMode = "grid"): ViewMode {
  if (typeof window === "undefined") return defaultMode;
  try {
    const raw = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (raw && VALID_MODES.includes(raw as ViewMode)) {
      return raw as ViewMode;
    }
  } catch {
    // ignore storage errors
  }
  return defaultMode;
}

export function saveViewMode(mode: ViewMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
}

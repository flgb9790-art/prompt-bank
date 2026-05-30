export type ViewMode = "grid" | "list" | "pinterest";
export type MiniAppViewMode = "grid" | "list";

export const VIEW_MODE_STORAGE_KEY = "promptBankViewMode";
export const PINTEREST_PAGE_SIZE = 12;
export const MINI_APP_PAGE_SIZE = 12;

const VALID_MODES: ViewMode[] = ["grid", "list", "pinterest"];
const MINI_APP_MODES: MiniAppViewMode[] = ["grid", "list"];

export function readViewMode(defaultMode: ViewMode = "pinterest"): ViewMode {
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

export function readMiniAppViewMode(defaultMode: MiniAppViewMode = "grid"): MiniAppViewMode {
  const mode = readViewMode(defaultMode);
  if (MINI_APP_MODES.includes(mode as MiniAppViewMode)) {
    return mode as MiniAppViewMode;
  }
  return "grid";
}

export function saveMiniAppViewMode(mode: MiniAppViewMode): void {
  saveViewMode(mode);
}

export function computePagedHasMore(
  loadedCount: number,
  total: number,
  lastBatchSize: number,
  pageSize: number
): boolean {
  if (loadedCount < total) return true;
  return lastBatchSize >= pageSize;
}

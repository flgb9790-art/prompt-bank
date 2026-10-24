export type ReadingSize = "compact" | "default" | "large";
const KEY = "prompt-bank-reading-size";

export function readReadingSize(): ReadingSize {
  try {
    const value = localStorage.getItem(KEY);
    if (value === "compact" || value === "large") return value;
  } catch { /* Private browsing can disable storage. */ }
  return "default";
}

export function applyReadingSize(value = readReadingSize()) {
  document.documentElement.dataset.readingSize = value;
}

export function saveReadingSize(value: ReadingSize) {
  try { localStorage.setItem(KEY, value); } catch { /* The preference still works for this session. */ }
  applyReadingSize(value);
}

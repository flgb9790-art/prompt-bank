import type { Prompt } from "../types";
import { resolvePostMedia } from "./resolvePostMedia";

export function estimatePinterestCardHeight(prompt: Prompt): number {
  const media = resolvePostMedia(prompt);
  const metaHeight = 0;

  if (!media) {
    return 320 + metaHeight;
  }

  if (media.type === "video") {
    return 300 + metaHeight;
  }

  const aspectBucket = prompt.id % 4;
  const aspectRatios = [1.25, 1.55, 0.85, 1.1];
  return Math.round(PINTEREST_COLUMN_WIDTH_WEB * aspectRatios[aspectBucket]) + metaHeight;
}

export const PINTEREST_COLUMN_GAP = 18;
export const PINTEREST_COLUMN_GAP_MINI = 14;
export const PINTEREST_COLUMN_WIDTH_WEB = 280;
export const PINTEREST_COLUMN_WIDTH_MINI = 280;

export function resolveColumnCountForWidth(containerWidth: number, miniAppSingleColumn = false): number {
  if (containerWidth <= 0) return 1;

  const gap = miniAppSingleColumn ? PINTEREST_COLUMN_GAP_MINI : PINTEREST_COLUMN_GAP;
  const colWidth = miniAppSingleColumn ? PINTEREST_COLUMN_WIDTH_MINI : PINTEREST_COLUMN_WIDTH_WEB;
  const fit = Math.floor((containerWidth + gap) / (colWidth + gap));

  if (miniAppSingleColumn && containerWidth < 480) {
    return 1;
  }

  const maxColumns = miniAppSingleColumn ? 2 : 5;
  return Math.max(1, Math.min(fit, maxColumns));
}

/** Колонок для раскладки: не больше, чем карточек (1–2 в избранном не растягиваются). */
export function resolveDistributionColumnCount(fitColumns: number, itemCount: number): number {
  if (itemCount <= 0) return 1;
  return Math.max(1, Math.min(fitColumns, itemCount));
}

export function distributeToMasonryColumns<T>(
  items: T[],
  columnCount: number,
  estimateHeight: (item: T) => number,
  columnGap = PINTEREST_COLUMN_GAP
): T[][] {
  const count = Math.max(1, columnCount);
  const columns: T[][] = Array.from({ length: count }, () => []);
  const heights = Array.from({ length: count }, () => 0);

  for (const item of items) {
    let target = 0;
    for (let index = 1; index < count; index += 1) {
      if (heights[index] < heights[target]) target = index;
    }
    columns[target].push(item);
    heights[target] += estimateHeight(item) + columnGap;
  }

  return columns;
}

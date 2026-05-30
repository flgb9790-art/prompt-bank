import type { Prompt } from "../types";
import { resolvePostMedia } from "./resolvePostMedia";

export function estimatePinterestCardHeight(prompt: Prompt, columnWidthPx?: number): number {
  const media = resolvePostMedia(prompt);
  const metaHeight = 0;

  if (!media) {
    return 320 + metaHeight;
  }

  if (media.type === "video") {
    return 300 + metaHeight;
  }

  const aspectBucket = prompt.id % 5;
  const aspectRatios = [1.35, 1.55, 0.72, 1.05, 0.82];
  const columnWidth = columnWidthPx ?? PINTEREST_MIN_COLUMN_WIDTH_WEB;
  return Math.round(columnWidth * aspectRatios[aspectBucket]) + metaHeight;
}

export const PINTEREST_COLUMN_GAP = 18;
export const PINTEREST_COLUMN_GAP_MINI = 14;
export const PINTEREST_MIN_COLUMN_WIDTH_WEB = 200;
export const PINTEREST_MIN_COLUMN_WIDTH_MINI = 160;
export const PINTEREST_MAX_COLUMNS_WEB = 8;
export const PINTEREST_MAX_COLUMNS_MINI = 2;

/** @deprecated use PINTEREST_MIN_COLUMN_WIDTH_WEB */
export const PINTEREST_COLUMN_WIDTH_WEB = PINTEREST_MIN_COLUMN_WIDTH_WEB;
export const PINTEREST_COLUMN_WIDTH_MINI = PINTEREST_MIN_COLUMN_WIDTH_MINI;

export function resolveColumnCountForWidth(
  containerWidth: number,
  miniAppSingleColumn = false,
  webMobileTwoColumns = false
): number {
  if (containerWidth <= 0) return 1;

  if (webMobileTwoColumns) {
    return containerWidth < 300 ? 1 : 2;
  }

  const gap = miniAppSingleColumn ? PINTEREST_COLUMN_GAP_MINI : PINTEREST_COLUMN_GAP;
  const minWidth = miniAppSingleColumn ? PINTEREST_MIN_COLUMN_WIDTH_MINI : PINTEREST_MIN_COLUMN_WIDTH_WEB;
  const fit = Math.floor((containerWidth + gap) / (minWidth + gap));

  if (miniAppSingleColumn && containerWidth < 480) {
    return 1;
  }

  const maxColumns = miniAppSingleColumn ? PINTEREST_MAX_COLUMNS_MINI : PINTEREST_MAX_COLUMNS_WEB;
  return Math.max(1, Math.min(fit, maxColumns));
}

/** Ширина колонки, чтобы N колонок + зазоры заняли всю ширину контейнера. */
export function resolvePinterestColumnWidth(
  containerWidth: number,
  columnCount: number,
  miniAppSingleColumn = false
): number {
  const count = Math.max(1, columnCount);
  const gap = miniAppSingleColumn ? PINTEREST_COLUMN_GAP_MINI : PINTEREST_COLUMN_GAP;
  const minWidth = miniAppSingleColumn ? PINTEREST_MIN_COLUMN_WIDTH_MINI : PINTEREST_MIN_COLUMN_WIDTH_WEB;

  if (containerWidth <= 0) return minWidth;

  return Math.max(1, Math.floor((containerWidth - gap * (count - 1)) / count));
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
    let minHeight = heights[0];
    for (let index = 1; index < count; index += 1) {
      if (heights[index] < minHeight) {
        minHeight = heights[index];
        target = index;
      }
    }
    columns[target].push(item);
    heights[target] += estimateHeight(item) + columnGap;
  }

  return columns;
}


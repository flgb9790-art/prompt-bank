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
  const imageHeights = [240, 300, 380, 460];
  return imageHeights[aspectBucket] + metaHeight;
}

export const PINTEREST_COLUMN_GAP = 18;

/** Не создаём больше колонок, чем карточек — иначе пустые flex-колонки и «дыры» в сетке. */
export function resolveEffectiveColumnCount(requested: number, itemCount: number): number {
  if (itemCount <= 0) return 1;
  return Math.max(1, Math.min(requested, itemCount));
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

import type { Prompt } from "../types";
import { resolvePostMedia } from "./resolvePostMedia";

export function estimatePinterestCardHeight(prompt: Prompt): number {
  const media = resolvePostMedia(prompt);
  const titleHeight = Math.min(2, Math.ceil(prompt.title.length / 22)) * 22;
  const tagsHeight = prompt.keywords.length > 0 ? 54 : 0;
  const metaHeight = 90 + titleHeight + tagsHeight;

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

export function distributeToMasonryColumns<T>(
  items: T[],
  columnCount: number,
  estimateHeight: (item: T) => number
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
    heights[target] += estimateHeight(item);
  }

  return columns;
}

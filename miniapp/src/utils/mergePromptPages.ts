import type { Prompt } from "../types";

export function mergePromptPages(existing: Prompt[], incoming: Prompt[]): Prompt[] {
  if (!incoming.length) return existing;
  const seen = new Set(existing.map((item) => item.id));
  const unique = incoming.filter((item) => !seen.has(item.id));
  if (!unique.length) return existing;
  return [...existing, ...unique];
}

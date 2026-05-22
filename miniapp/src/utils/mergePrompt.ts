import type { Prompt } from "../types";

export function mergePromptUpdate(existing: Prompt, patch: Prompt): Prompt {
  return {
    ...existing,
    ...patch,
    category: patch.category ?? existing.category,
    keywords: patch.keywords?.length ? patch.keywords : existing.keywords,
    examples: patch.examples ?? existing.examples ?? []
  };
}

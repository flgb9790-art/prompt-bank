import type { Prompt } from "../types";
import { getPromptExcerpt } from "./promptContent";
import { buildShortPromptTitle, isShortPromptTitle } from "./shortPromptTitle";

export function derivePromptTitle(content: string): string {
  return buildShortPromptTitle(content);
}

export function getPromptLabel(prompt: Pick<Prompt, "content" | "contentExcerpt" | "title">): string {
  if (isShortPromptTitle(prompt.title)) return prompt.title.trim();
  const text = getPromptExcerpt(prompt) || prompt.title || "";
  return derivePromptTitle(text);
}

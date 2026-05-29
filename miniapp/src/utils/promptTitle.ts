import type { Prompt } from "../types";
import { getPromptExcerpt } from "./promptContent";

export function derivePromptTitle(content: string, maxLength = 100): string {
  const firstLine =
    content
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? "";
  const collapsed = firstLine.replace(/\s+/g, " ").trim();
  if (!collapsed) return "Промпт";
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength - 1)}…`;
}

export function getPromptLabel(prompt: Pick<Prompt, "content" | "contentExcerpt" | "title">): string {
  const text = getPromptExcerpt(prompt) || prompt.title || "";
  return derivePromptTitle(text);
}

import type { Prompt } from "../types";
import { buildShortPromptTitle, resolvePromptTitle } from "./shortPromptTitle";

export function derivePromptTitle(content: string): string {
  return buildShortPromptTitle(content);
}

export function getPromptLabel(prompt: Pick<Prompt, "content" | "contentExcerpt" | "title">): string {
  const hasFullContent = typeof prompt.content === "string";
  return resolvePromptTitle({
    title: prompt.title,
    content: (hasFullContent ? prompt.content : prompt.contentExcerpt) || prompt.title || "",
    contentIsExcerpt: !hasFullContent
  });
}

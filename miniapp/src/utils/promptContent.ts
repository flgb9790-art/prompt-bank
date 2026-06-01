import type { Prompt } from "../types";
import { normalizePromptFromApi } from "./promptFavorite";

export function mapPromptsFromApi(items: Prompt[]): Prompt[] {
  return items.map(normalizePromptFromApi);
}

export function getPromptExcerpt(prompt: Pick<Prompt, "content" | "contentExcerpt">): string {
  return prompt.contentExcerpt ?? prompt.content ?? "";
}

export function hasFullPromptContent(prompt: Pick<Prompt, "content">): boolean {
  return typeof prompt.content === "string";
}

export function hasFullPromptDetails(prompt: Prompt): boolean {
  return hasFullPromptContent(prompt) && prompt.detailLoaded === true;
}

export function withPromptDetails(prompt: Prompt): Prompt {
  return { ...prompt, detailLoaded: true };
}

export function getPromptSearchText(prompt: Prompt): string {
  const tags = prompt.keywords.map((keyword) => keyword.keyword.name).join(" ");
  return `${getPromptExcerpt(prompt)} ${prompt.category.name} ${tags}`.toLowerCase();
}

export async function ensurePromptWithContent(
  prompt: Prompt,
  fetchFull: (id: number) => Promise<Prompt>
): Promise<Prompt> {
  if (hasFullPromptContent(prompt)) {
    return prompt;
  }
  return withPromptDetails(await fetchFull(prompt.id));
}

import type { Prompt } from "../types";

export function mapPromptsFromApi(items: Prompt[]): Prompt[] {
  return items.map((prompt) => ({ ...prompt, examples: prompt.examples ?? [] }));
}

export function getPromptExcerpt(prompt: Pick<Prompt, "content" | "contentExcerpt">): string {
  return prompt.contentExcerpt ?? prompt.content ?? "";
}

export function hasFullPromptContent(prompt: Pick<Prompt, "content">): boolean {
  return typeof prompt.content === "string";
}

export function getPromptSearchText(prompt: Prompt): string {
  const tags = prompt.keywords.map((keyword) => keyword.keyword.name).join(" ");
  return `${prompt.title} ${getPromptExcerpt(prompt)} ${prompt.category.name} ${tags}`.toLowerCase();
}

export async function ensurePromptWithContent(
  prompt: Prompt,
  fetchFull: (id: number) => Promise<Prompt>
): Promise<Prompt> {
  if (hasFullPromptContent(prompt)) {
    return prompt;
  }
  return fetchFull(prompt.id);
}

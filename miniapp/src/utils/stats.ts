import type { Prompt } from "../types";

export function countCategoriesWithPrompts(prompts: Prompt[]): number {
  const slugs = new Set<string>();
  for (const prompt of prompts) {
    if (prompt.category?.slug) {
      slugs.add(prompt.category.slug);
    }
  }
  return slugs.size;
}

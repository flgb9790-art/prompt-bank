import type { Category, Prompt } from "../types";

export function countCategoriesWithPromptCount(categories: Category[]): number {
  return categories.filter((category) => (category.promptCount ?? 0) > 0).length;
}

export function countCategoriesWithPrompts(prompts: Prompt[]): number {
  const slugs = new Set<string>();
  for (const prompt of prompts) {
    if (prompt.category?.slug) {
      slugs.add(prompt.category.slug);
    }
  }
  return slugs.size;
}

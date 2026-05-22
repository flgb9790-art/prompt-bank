import type { Prompt } from "../types";

export function createPromptLoadingShell(promptId: number): Prompt {
  return {
    id: promptId,
    title: "Загрузка промпта…",
    categoryId: 0,
    category: {
      id: 0,
      name: "…",
      slug: "loading",
      sortOrder: 0
    },
    keywords: [],
    examples: [],
    isFavorite: false,
    usageCount: 0,
    userId: 0,
    createdAt: "",
    updatedAt: ""
  };
}

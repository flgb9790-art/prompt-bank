import type { Prompt } from "../types";
import { readFavoritesCache } from "./favoritesCache";

export function normalizePromptFromApi(prompt: Prompt): Prompt {
  return {
    ...prompt,
    keywords: prompt.keywords ?? [],
    examples: prompt.examples ?? [],
    isFavorite: Boolean(prompt.isFavorite)
  };
}

export function favoriteIdsFromPrompts(prompts: Iterable<Prompt>): Set<number> {
  const ids = new Set<number>();
  for (const prompt of prompts) {
    if (prompt.isFavorite) ids.add(prompt.id);
  }
  return ids;
}

export function favoriteIdsFromCache(): Set<number> {
  const cached = readFavoritesCache();
  if (!cached?.length) return new Set();
  return new Set(cached.map((prompt) => prompt.id));
}

export function mergeFavoriteIds(...sources: Iterable<number>[]): Set<number> {
  const ids = new Set<number>();
  for (const source of sources) {
    for (const id of source) ids.add(id);
  }
  return ids;
}

export function applyFavoriteIds(prompt: Prompt, favoriteIds: Set<number>): Prompt {
  const isFavorite = favoriteIds.has(prompt.id) || Boolean(prompt.isFavorite);
  return isFavorite === prompt.isFavorite ? prompt : { ...prompt, isFavorite };
}

export function applyFavoriteIdsToList(prompts: Prompt[], favoriteIds: Set<number>): Prompt[] {
  if (!favoriteIds.size) {
    return prompts.map(normalizePromptFromApi);
  }
  return prompts.map((prompt) => applyFavoriteIds(normalizePromptFromApi(prompt), favoriteIds));
}

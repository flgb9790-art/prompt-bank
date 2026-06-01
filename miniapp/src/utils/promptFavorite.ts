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
  if (!cached?.items.length) return new Set();
  return new Set(cached.items.map((prompt) => prompt.id));
}

export function favoritesTotalFromCache(): number {
  return readFavoritesCache()?.total ?? 0;
}

export function hydrateFavoritesFromBootstrap(favorites: Prompt[] | undefined, total?: number) {
  const mapped = (favorites ?? []).map(normalizePromptFromApi);
  const resolvedTotal = typeof total === "number" && total >= 0 ? total : mapped.length;
  if (!mapped.length && resolvedTotal <= 0) {
    return { ids: favoriteIdsFromCache(), total: favoritesTotalFromCache() };
  }
  return { ids: favoriteIdsFromPrompts(mapped), total: resolvedTotal, items: mapped };
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

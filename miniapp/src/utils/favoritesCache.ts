import type { Prompt } from "../types";
import { readReferenceCache, removeReferenceCache, writeReferenceCache } from "./referenceCache";

const FAVORITES_CACHE_KEY = "prompt-bank-favorites";

export type FavoritesCachePayload = {
  items: Prompt[];
  total: number;
};

function normalizeCachePayload(data: FavoritesCachePayload | Prompt[] | null | undefined): FavoritesCachePayload | null {
  if (!data) return null;
  if (Array.isArray(data)) {
    if (!data.length) return null;
    return { items: data, total: data.length };
  }
  if (!data.items?.length && !(data.total > 0)) return null;
  return {
    items: data.items ?? [],
    total: data.total > 0 ? data.total : data.items.length
  };
}

export function readFavoritesCache(): FavoritesCachePayload | null {
  return normalizeCachePayload(readReferenceCache<FavoritesCachePayload | Prompt[]>(FAVORITES_CACHE_KEY));
}

export function writeFavoritesCache(items: Prompt[], total?: number) {
  writeReferenceCache(FAVORITES_CACHE_KEY, {
    items,
    total: typeof total === "number" && total >= 0 ? total : items.length
  });
}

export function invalidateFavoritesCache() {
  removeReferenceCache(FAVORITES_CACHE_KEY);
}

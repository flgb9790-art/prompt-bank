import type { Prompt } from "../types";
import { readReferenceCache, removeReferenceCache, writeReferenceCache } from "./referenceCache";

const FAVORITES_CACHE_KEY = "prompt-bank-favorites";

export function readFavoritesCache(): Prompt[] | null {
  const data = readReferenceCache<Prompt[]>(FAVORITES_CACHE_KEY);
  return data?.length ? data : data === null ? null : [];
}

export function writeFavoritesCache(prompts: Prompt[]) {
  writeReferenceCache(FAVORITES_CACHE_KEY, prompts);
}

export function invalidateFavoritesCache() {
  removeReferenceCache(FAVORITES_CACHE_KEY);
}

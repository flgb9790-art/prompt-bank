import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Prompt } from "../types";

type FavoriteIdsContextValue = {
  isFavorite: (promptId: number) => boolean;
};

const FavoriteIdsContext = createContext<FavoriteIdsContextValue | null>(null);

export function FavoriteIdsProvider({
  favoriteIds,
  children
}: {
  favoriteIds: Set<number>;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      isFavorite: (promptId: number) => favoriteIds.has(promptId)
    }),
    [favoriteIds]
  );

  return <FavoriteIdsContext.Provider value={value}>{children}</FavoriteIdsContext.Provider>;
}

export function usePromptFavorite(prompt: Pick<Prompt, "id" | "isFavorite">): boolean {
  const context = useContext(FavoriteIdsContext);
  if (context) return context.isFavorite(prompt.id);
  return Boolean(prompt.isFavorite);
}

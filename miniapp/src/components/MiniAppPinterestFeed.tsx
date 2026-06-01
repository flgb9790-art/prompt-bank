import type { ReactNode } from "react";
import type { Prompt } from "../types";
import { PinterestMasonryGrid } from "./PinterestMasonryGrid";

type Props = {
  prompts: Prompt[];
  loading?: boolean;
  skeletonCount?: number;
  emptyState?: ReactNode;
  onOpen: (prompt: Prompt) => void;
  onCopy: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onTagClick?: (tag: string) => void;
};

export function MiniAppPinterestFeed({
  prompts,
  loading = false,
  skeletonCount = 6,
  emptyState,
  onOpen,
  onCopy,
  onToggleFavorite,
  onTagClick
}: Props) {
  const grid = (
    <PinterestMasonryGrid
      prompts={prompts}
      loading={loading}
      scrollRootSelector=".mobile-frame"
      miniAppTwoColumns
      skeletonCount={skeletonCount}
      emptyState={emptyState}
      onOpen={onOpen}
      onCopy={onCopy}
      onToggleFavorite={onToggleFavorite}
      onTagClick={onTagClick}
    />
  );

  if (loading && prompts.length) {
    return <div className="mini-list-loading">{grid}</div>;
  }

  return grid;
}

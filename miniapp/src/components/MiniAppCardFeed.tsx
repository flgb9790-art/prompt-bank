import type { ReactNode } from "react";
import type { Prompt } from "../types";
import { MobilePromptFeed } from "./MobilePromptFeed";
import { MobilePromptPostCard } from "./MobilePromptPostCard";

type Props = {
  prompts: Prompt[];
  loading?: boolean;
  paginated?: boolean;
  skeletonCount?: number;
  emptyState?: ReactNode;
  onOpen: (prompt: Prompt) => void;
  onCopy: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onTagClick?: (tag: string) => void;
};

function CardSkeleton() {
  return <div className="mobile-post-card skeleton mobile-post-card-skeleton mobile-post-card-skeleton--grid" />;
}

export function MiniAppCardFeed({
  prompts,
  loading = false,
  paginated = false,
  skeletonCount = 4,
  emptyState,
  onOpen,
  onCopy,
  onToggleFavorite,
  onTagClick
}: Props) {
  if (loading && !prompts.length) {
    return (
      <MobilePromptFeed className="mobile-prompt-feed--two-col" paginated={paginated}>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <CardSkeleton key={`skeleton-${index}`} />
        ))}
      </MobilePromptFeed>
    );
  }

  if (!prompts.length) {
    return emptyState ?? null;
  }

  const feed = (
    <MobilePromptFeed className="mobile-prompt-feed--two-col" paginated={paginated}>
      {prompts.map((prompt, index) => (
        <MobilePromptPostCard
          key={prompt.id}
          prompt={prompt}
          imagePriority={index < 4}
          onOpen={onOpen}
          onCopy={onCopy}
          onToggleFavorite={onToggleFavorite}
          onTagClick={onTagClick}
        />
      ))}
    </MobilePromptFeed>
  );

  if (loading) {
    return <div className="mini-list-loading">{feed}</div>;
  }

  return feed;
}

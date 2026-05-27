import type { ReactNode } from "react";
import type { Prompt } from "../types";
import { useLoadMoreOnScroll } from "../hooks/useLoadMoreOnScroll";
import { PinterestPromptCard } from "./PinterestPromptCard";

const SKELETON_HEIGHTS = [180, 240, 300, 220];

type Props = {
  prompts: Prompt[];
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onOpen: (prompt: Prompt) => void;
  onCopy: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onTagClick?: (tag: string) => void;
  scrollRootSelector?: string;
  miniAppSingleColumn?: boolean;
  emptyState?: ReactNode;
  skeletonCount?: number;
};

function PinterestSkeletonCards({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="pinterest-item">
          <div className="pinterest-card pinterest-card-skeleton">
            <div
              className="pinterest-skeleton-media"
              style={{ height: `${SKELETON_HEIGHTS[index % SKELETON_HEIGHTS.length]}px` }}
            />
            <div className="pinterest-content">
              <div className="pinterest-skeleton-line pinterest-skeleton-line--wide" />
              <div className="pinterest-skeleton-line pinterest-skeleton-line--short" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

export function PinterestMasonryGrid({
  prompts,
  loading = false,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  onOpen,
  onCopy,
  onToggleFavorite,
  onTagClick,
  miniAppSingleColumn = false,
  emptyState,
  skeletonCount = 8
}: Props) {
  const sentinelRef = useLoadMoreOnScroll({
    enabled: Boolean(onLoadMore) && !loading && prompts.length > 0,
    loading: Boolean(loadingMore),
    hasMore: Boolean(hasMore && onLoadMore),
    onLoadMore: () => onLoadMore?.(),
    rootMargin: "600px"
  });

  if (loading && !prompts.length) {
    return (
      <div className={`pinterest-grid ${miniAppSingleColumn ? "pinterest-grid--mini-app" : ""}`.trim()}>
        <PinterestSkeletonCards count={skeletonCount} />
      </div>
    );
  }

  if (!prompts.length) {
    return (
      <>
        {emptyState ?? (
          <div className="surface-card empty-state mt-5">
            <p className="text-base font-medium text-[var(--text)]">Промпты не найдены</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Измените фильтры или добавьте новый промпт.</p>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className={`pinterest-grid ${miniAppSingleColumn ? "pinterest-grid--mini-app" : ""}`.trim()}>
        {prompts.map((prompt, index) => (
          <div key={prompt.id} className="pinterest-item">
            <PinterestPromptCard
              prompt={prompt}
              imagePriority={index < 4}
              onOpen={onOpen}
              onCopy={onCopy}
              onToggleFavorite={onToggleFavorite}
              onTagClick={onTagClick}
            />
          </div>
        ))}
        {loadingMore ? <PinterestSkeletonCards count={4} /> : null}
      </div>

      {hasMore && onLoadMore ? (
        <div ref={sentinelRef} className="pinterest-sentinel" aria-hidden>
          {loadingMore ? <span className="pinterest-loading-more">Загружаем ещё...</span> : null}
        </div>
      ) : null}

      {!hasMore && prompts.length > 0 ? <p className="pinterest-end">Вы посмотрели все промпты</p> : null}
    </>
  );
}

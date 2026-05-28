import { useMemo, type ReactNode } from "react";
import type { Prompt } from "../types";
import { useLoadMoreOnScroll } from "../hooks/useLoadMoreOnScroll";
import { usePinterestColumnCount } from "../hooks/usePinterestColumnCount";
import { distributeToMasonryColumns, estimatePinterestCardHeight } from "../utils/masonryColumns";
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

function PinterestSkeletonCard({ height }: { height: number }) {
  return (
    <div className="pinterest-item">
      <div className="pinterest-card pinterest-card-skeleton">
        <div className="pinterest-skeleton-media" style={{ height: `${height}px` }} />
        <div className="pinterest-content">
          <div className="pinterest-skeleton-line pinterest-skeleton-line--wide" />
          <div className="pinterest-skeleton-line pinterest-skeleton-line--short" />
        </div>
      </div>
    </div>
  );
}

function PinterestSkeletonColumns({ count, columnCount }: { count: number; columnCount: number }) {
  const skeletons = Array.from({ length: count }, (_, index) => ({
    id: index,
    height: SKELETON_HEIGHTS[index % SKELETON_HEIGHTS.length]
  }));
  const columns = distributeToMasonryColumns(
    skeletons,
    columnCount,
    (item) => item.height
  );

  return (
    <div className="pinterest-masonry">
      {columns.map((column, columnIndex) => (
        <div key={`skeleton-col-${columnIndex}`} className="pinterest-masonry-column">
          {column.map((item) => (
            <PinterestSkeletonCard key={item.id} height={item.height} />
          ))}
        </div>
      ))}
    </div>
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
  scrollRootSelector = ".prompt-scroll-root",
  miniAppSingleColumn = false,
  emptyState,
  skeletonCount = 8
}: Props) {
  const columnCount = usePinterestColumnCount(miniAppSingleColumn);
  const columns = useMemo(
    () => distributeToMasonryColumns(prompts, columnCount, estimatePinterestCardHeight),
    [prompts, columnCount]
  );

  const sentinelRef = useLoadMoreOnScroll({
    enabled: Boolean(onLoadMore) && !loading && prompts.length > 0,
    loading: Boolean(loadingMore),
    hasMore: Boolean(hasMore && onLoadMore),
    onLoadMore: () => onLoadMore?.(),
    rootMargin: "1200px",
    scrollRootSelector,
    itemCount: prompts.length
  });

  if (loading && !prompts.length) {
    return <PinterestSkeletonColumns count={skeletonCount} columnCount={columnCount} />;
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

  let cardIndex = 0;

  return (
    <>
      <div className={`pinterest-masonry ${miniAppSingleColumn ? "pinterest-masonry--mini-app" : ""}`.trim()}>
        {columns.map((column, columnIndex) => (
          <div key={`pinterest-col-${columnIndex}`} className="pinterest-masonry-column">
            {column.map((prompt) => {
              const index = cardIndex;
              cardIndex += 1;
              return (
                <div key={prompt.id} className="pinterest-item">
                  <PinterestPromptCard
                    prompt={prompt}
                    imagePriority={index < columnCount * 2}
                    onOpen={onOpen}
                    onCopy={onCopy}
                    onToggleFavorite={onToggleFavorite}
                    onTagClick={onTagClick}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {loadingMore ? <PinterestSkeletonColumns count={4} columnCount={columnCount} /> : null}

      {hasMore && onLoadMore ? (
        <div ref={sentinelRef} className="pinterest-sentinel-wrap" aria-hidden>
          <div className="pinterest-sentinel">
            {loadingMore ? <span className="pinterest-loading-more">Загружаем ещё...</span> : null}
          </div>
        </div>
      ) : null}

      {!hasMore && prompts.length > 0 ? <p className="pinterest-end">Вы посмотрели все промпты</p> : null}
    </>
  );
}

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Prompt } from "../types";
import { useLoadMoreOnScroll } from "../hooks/useLoadMoreOnScroll";
import { usePinterestColumnCount } from "../hooks/usePinterestColumnCount";
import {
  distributeToMasonryColumns,
  estimatePinterestCardHeight,
  PINTEREST_COLUMN_GAP,
  PINTEREST_COLUMN_GAP_MINI,
  resolveDistributionColumnCount,
  resolvePinterestColumnWidth
} from "../utils/masonryColumns";
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

function pinterestMasonryStyle(
  containerWidth: number,
  fitColumns: number,
  miniAppSingleColumn?: boolean
): CSSProperties | undefined {
  if (containerWidth <= 0 || fitColumns <= 0) return undefined;

  const gap = miniAppSingleColumn ? PINTEREST_COLUMN_GAP_MINI : PINTEREST_COLUMN_GAP;
  const columnWidth = resolvePinterestColumnWidth(containerWidth, fitColumns, miniAppSingleColumn);

  return {
    "--pinterest-col-width": `${columnWidth}px`,
    "--pinterest-col-gap": `${gap}px`
  } as CSSProperties;
}

function PinterestSkeletonColumns({
  count,
  fitColumns,
  containerWidth,
  miniAppSingleColumn
}: {
  count: number;
  fitColumns: number;
  containerWidth: number;
  miniAppSingleColumn?: boolean;
}) {
  const skeletons = Array.from({ length: count }, (_, index) => ({
    id: index,
    height: SKELETON_HEIGHTS[index % SKELETON_HEIGHTS.length]
  }));
  const distributionColumns = resolveDistributionColumnCount(fitColumns, skeletons.length);
  const columns = distributeToMasonryColumns(skeletons, distributionColumns, (item) => item.height);

  return (
    <div className={`pinterest-masonry ${miniAppSingleColumn ? "pinterest-masonry--mini-app" : ""}`.trim()} aria-hidden>
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
  const masonryRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const node = masonryRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(Math.floor(width));
    });

    observer.observe(node);
    setContainerWidth(Math.floor(node.getBoundingClientRect().width));

    return () => observer.disconnect();
  }, [loading, prompts.length]);

  const fitColumns = usePinterestColumnCount(containerWidth, miniAppSingleColumn);
  const columnWidth = resolvePinterestColumnWidth(containerWidth, fitColumns, miniAppSingleColumn);
  const columnWidthRef = useRef(columnWidth);
  columnWidthRef.current = columnWidth;
  const distributionColumns = resolveDistributionColumnCount(fitColumns, prompts.length);
  const masonryStyle = pinterestMasonryStyle(containerWidth, fitColumns, miniAppSingleColumn);
  const layoutReady = containerWidth > 0;

  const layoutKey = useMemo(
    () => `${distributionColumns}:${prompts.map((prompt) => prompt.id).join(",")}`,
    [prompts, distributionColumns]
  );

  const columns = useMemo(
    () =>
      distributeToMasonryColumns(prompts, distributionColumns, (prompt) =>
        estimatePinterestCardHeight(prompt, columnWidthRef.current)
      ),
    [layoutKey, prompts, distributionColumns]
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

  const masonryClass = `pinterest-masonry ${miniAppSingleColumn ? "pinterest-masonry--mini-app" : ""}`.trim();

  if (loading && !prompts.length) {
    return (
      <div ref={masonryRef} className={masonryClass} style={masonryStyle}>
        <PinterestSkeletonColumns
          count={skeletonCount}
          fitColumns={fitColumns || 2}
          containerWidth={containerWidth}
          miniAppSingleColumn={miniAppSingleColumn}
        />
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

  if (!layoutReady) {
    return <div ref={masonryRef} className={masonryClass} style={{ width: "100%", minHeight: 120 }} aria-busy="true" />;
  }

  let cardIndex = 0;

  return (
    <>
      <div ref={masonryRef} className={masonryClass} style={masonryStyle}>
        {columns.map((column, columnIndex) => (
          <div key={`pinterest-col-${columnIndex}`} className="pinterest-masonry-column">
            {column.map((prompt) => {
              const index = cardIndex;
              cardIndex += 1;
              return (
                <div key={prompt.id} className="pinterest-item">
                  <PinterestPromptCard
                    prompt={prompt}
                    imagePriority={index < fitColumns * 2}
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

      {loadingMore ? (
        <PinterestSkeletonColumns
          count={4}
          fitColumns={fitColumns || 2}
          containerWidth={containerWidth}
          miniAppSingleColumn={miniAppSingleColumn}
        />
      ) : null}

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

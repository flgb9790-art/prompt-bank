import { useEffect, useRef } from "react";

type Options = {
  enabled: boolean;
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
};

export function useLoadMoreOnScroll({ enabled, loading, hasMore, onLoadMore, rootMargin = "240px" }: Options) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    if (!enabled || !hasMore) return;

    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || loading) return;
        onLoadMoreRef.current();
      },
      { root: null, rootMargin, threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, hasMore, loading]);

  return sentinelRef;
}

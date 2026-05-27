import { useEffect, useRef } from "react";

type Options = {
  enabled: boolean;
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
  scrollRootSelector?: string;
};

function resolveScrollRoot(selector?: string): HTMLElement | null {
  if (!selector) return null;

  const nodes = document.querySelectorAll<HTMLElement>(selector);
  for (const node of nodes) {
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") continue;
    if (node.clientHeight <= 0) continue;
    return node;
  }

  return nodes[0] ?? null;
}

export function useLoadMoreOnScroll({
  enabled,
  loading,
  hasMore,
  onLoadMore,
  rootMargin = "240px",
  scrollRootSelector
}: Options) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const loadingRef = useRef(loading);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (!enabled || !hasMore) return;

    let observer: IntersectionObserver | null = null;
    let cancelled = false;
    let attempts = 0;

    const setup = () => {
      if (cancelled) return;

      const node = sentinelRef.current;
      if (!node) {
        if (attempts < 24) {
          attempts += 1;
          requestAnimationFrame(setup);
        }
        return;
      }

      const root = resolveScrollRoot(scrollRootSelector);
      observer?.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry?.isIntersecting || loadingRef.current) return;
          onLoadMoreRef.current();
        },
        { root, rootMargin, threshold: 0 }
      );

      observer.observe(node);
    };

    setup();

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [enabled, hasMore, rootMargin, scrollRootSelector]);

  return sentinelRef;
}

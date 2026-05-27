import { useCallback, useEffect, useRef } from "react";

type Options = {
  enabled: boolean;
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
  scrollRootSelector?: string;
  itemCount?: number;
};

function parseRootMarginPx(rootMargin: string): number {
  const match = /(-?\d+(?:\.\d+)?)px/.exec(rootMargin);
  return match ? Number(match[1]) : 800;
}

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
  rootMargin = "800px",
  scrollRootSelector,
  itemCount = 0
}: Options) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const loadingRef = useRef(loading);
  const hasMoreRef = useRef(hasMore);
  const enabledRef = useRef(enabled);
  const pendingRef = useRef(false);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    loadingRef.current = loading;
    if (!loading) {
      pendingRef.current = false;
    }
  }, [loading]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const requestLoad = useCallback(() => {
    if (!enabledRef.current || !hasMoreRef.current || loadingRef.current || pendingRef.current) {
      return false;
    }

    pendingRef.current = true;
    onLoadMoreRef.current();

    window.requestAnimationFrame(() => {
      if (!loadingRef.current) {
        pendingRef.current = false;
      }
    });

    return true;
  }, []);

  const checkAndLoad = useCallback(() => {
    if (!enabledRef.current || !hasMoreRef.current || loadingRef.current || pendingRef.current) return;

    const root = resolveScrollRoot(scrollRootSelector);
    const sentinel = sentinelRef.current;
    const margin = parseRootMarginPx(rootMargin);

    if (root) {
      if (root.scrollHeight <= root.clientHeight + margin) {
        requestLoad();
        return;
      }

      if (!sentinel) return;

      const rootRect = root.getBoundingClientRect();
      const sentinelRect = sentinel.getBoundingClientRect();
      if (sentinelRect.top <= rootRect.bottom + margin) {
        requestLoad();
      }
      return;
    }

    if (!sentinel) return;

    if (document.documentElement.scrollHeight <= window.innerHeight + margin) {
      requestLoad();
      return;
    }

    const rect = sentinel.getBoundingClientRect();
    if (rect.top <= window.innerHeight + margin) {
      requestLoad();
    }
  }, [rootMargin, scrollRootSelector, requestLoad]);

  useEffect(() => {
    if (!enabled || !hasMore) return;

    let cancelled = false;
    let scrollTarget: HTMLElement | Window | null = null;
    let observer: IntersectionObserver | null = null;

    const attach = () => {
      const root = resolveScrollRoot(scrollRootSelector);
      scrollTarget = root ?? window;
      scrollTarget.addEventListener("scroll", checkAndLoad, { passive: true });

      const sentinel = sentinelRef.current;
      if (sentinel && typeof IntersectionObserver !== "undefined") {
        observer = new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
              checkAndLoad();
            }
          },
          {
            root,
            rootMargin,
            threshold: 0
          }
        );
        observer.observe(sentinel);
      }

      window.requestAnimationFrame(checkAndLoad);
    };

    let attempts = 0;
    const tryAttach = () => {
      if (cancelled) return;
      const root = resolveScrollRoot(scrollRootSelector);
      const sentinel = sentinelRef.current;
      if ((!root || !sentinel) && attempts < 60) {
        attempts += 1;
        window.requestAnimationFrame(tryAttach);
        return;
      }
      attach();
    };

    tryAttach();

    return () => {
      cancelled = true;
      scrollTarget?.removeEventListener("scroll", checkAndLoad);
      observer?.disconnect();
    };
  }, [enabled, hasMore, scrollRootSelector, rootMargin, checkAndLoad]);

  useEffect(() => {
    if (!enabled || !hasMore || loading) return;
    const frame = window.requestAnimationFrame(() => {
      checkAndLoad();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [enabled, hasMore, loading, itemCount, checkAndLoad]);

  useEffect(() => {
    if (!enabled || !hasMore) return;

    const root = resolveScrollRoot(scrollRootSelector);
    if (!root) return;

    const observer = new ResizeObserver(() => {
      checkAndLoad();
    });

    observer.observe(root);
    const sentinel = sentinelRef.current;
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => observer.disconnect();
  }, [enabled, hasMore, scrollRootSelector, itemCount, checkAndLoad]);

  return sentinelRef;
}

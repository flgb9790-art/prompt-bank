import { useEffect, useState, type RefObject } from "react";

type Options = {
  enabled?: boolean;
  root?: Element | null;
  rootSelector?: string;
  rootMargin?: string;
};

export function useNearViewport(ref: RefObject<Element | null>, options: Options = {}) {
  const { enabled = true, root, rootSelector = ".prompt-scroll-root", rootMargin = "320px 0px" } = options;
  const [near, setNear] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setNear(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }

    const scrollRoot =
      root ?? (rootSelector ? document.querySelector<Element>(rootSelector) : null);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { root: scrollRoot, rootMargin, threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, ref, root, rootSelector, rootMargin]);

  return near;
}

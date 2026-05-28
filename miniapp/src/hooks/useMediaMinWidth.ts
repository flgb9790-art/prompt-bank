import { useEffect, useState } from "react";

export function useMediaMinWidth(minWidthPx: number, enabled = true) {
  const query = `(min-width: ${minWidthPx}px)`;
  const [matches, setMatches] = useState(
    () => enabled && typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    if (!enabled) {
      setMatches(false);
      return;
    }
    const media = window.matchMedia(query);
    const sync = () => setMatches(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [enabled, query]);

  return matches;
}

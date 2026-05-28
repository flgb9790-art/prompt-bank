import { useEffect, useState } from "react";

function resolveColumnCount(miniAppSingleColumn: boolean) {
  if (typeof window === "undefined") return 1;

  if (miniAppSingleColumn) {
    if (window.matchMedia("(min-width: 480px)").matches) return 2;
    return 1;
  }

  if (window.matchMedia("(min-width: 1440px)").matches) return 5;
  if (window.matchMedia("(min-width: 1200px)").matches) return 3;
  if (window.matchMedia("(min-width: 480px)").matches) return 2;
  return 1;
}

export function usePinterestColumnCount(miniAppSingleColumn = false) {
  const [columnCount, setColumnCount] = useState(() => resolveColumnCount(miniAppSingleColumn));

  useEffect(() => {
    const queries = [
      window.matchMedia("(min-width: 1440px)"),
      window.matchMedia("(min-width: 1200px)"),
      window.matchMedia("(min-width: 768px)"),
      window.matchMedia("(min-width: 480px)")
    ];

    const sync = () => setColumnCount(resolveColumnCount(miniAppSingleColumn));
    sync();

    for (const query of queries) {
      query.addEventListener("change", sync);
    }
    return () => {
      for (const query of queries) {
        query.removeEventListener("change", sync);
      }
    };
  }, [miniAppSingleColumn]);

  return columnCount;
}

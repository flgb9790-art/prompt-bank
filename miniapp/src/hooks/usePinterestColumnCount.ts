import { useEffect, useState } from "react";
import {
  PINTEREST_COLUMN_GAP,
  PINTEREST_COLUMN_WIDTH_MINI,
  PINTEREST_COLUMN_WIDTH_WEB,
  resolveColumnCountForWidth
} from "../utils/masonryColumns";

export function usePinterestColumnCount(containerWidth: number, miniAppSingleColumn = false) {
  const [columnCount, setColumnCount] = useState(() =>
    resolveColumnCountForWidth(containerWidth, miniAppSingleColumn)
  );

  useEffect(() => {
    setColumnCount(resolveColumnCountForWidth(containerWidth, miniAppSingleColumn));
  }, [containerWidth, miniAppSingleColumn]);

  return columnCount;
}

export { PINTEREST_COLUMN_GAP, PINTEREST_COLUMN_WIDTH_MINI, PINTEREST_COLUMN_WIDTH_WEB };

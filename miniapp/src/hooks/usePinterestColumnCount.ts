import { useEffect, useState } from "react";
import {
  PINTEREST_COLUMN_GAP,
  PINTEREST_COLUMN_WIDTH_MINI,
  PINTEREST_COLUMN_WIDTH_WEB,
  resolveColumnCountForWidth
} from "../utils/masonryColumns";

export function usePinterestColumnCount(
  containerWidth: number,
  miniAppSingleColumn = false,
  webMobileTwoColumns = false,
  miniAppTwoColumns = false
) {
  const [columnCount, setColumnCount] = useState(() =>
    resolveColumnCountForWidth(containerWidth, miniAppSingleColumn, webMobileTwoColumns, miniAppTwoColumns)
  );

  useEffect(() => {
    setColumnCount(
      resolveColumnCountForWidth(containerWidth, miniAppSingleColumn, webMobileTwoColumns, miniAppTwoColumns)
    );
  }, [containerWidth, miniAppSingleColumn, webMobileTwoColumns, miniAppTwoColumns]);

  return columnCount;
}

export { PINTEREST_COLUMN_GAP, PINTEREST_COLUMN_WIDTH_MINI, PINTEREST_COLUMN_WIDTH_WEB };

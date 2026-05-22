import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PromptCard } from "./PromptCard";
import { useGridColumns } from "../hooks/useGridColumns";
import type { Prompt } from "../types";

const VIRTUALIZE_MIN_ITEMS = 18;
const ROW_GAP = 20;
const ROW_ESTIMATE = 340;

type Props = {
  prompts: Prompt[];
  scrollSelector: string;
  footer?: ReactNode;
  onOpenPrompt: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onCopyPrompt: (prompt: Prompt) => void;
  onTagClick?: (tag: string) => void;
};

function chunkRows(items: Prompt[], columns: number) {
  const rows: Prompt[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }
  return rows;
}

export function VirtualPromptGrid({
  prompts,
  scrollSelector,
  footer,
  onOpenPrompt,
  onToggleFavorite,
  onCopyPrompt,
  onTagClick
}: Props) {
  const columns = useGridColumns();
  const rows = useMemo(() => chunkRows(prompts, columns), [prompts, columns]);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const tryResolve = () => {
      if (cancelled || attempts > 20) return;
      attempts += 1;
      const element = document.querySelector<HTMLElement>(scrollSelector);
      if (element) {
        setScrollElement(element);
        return;
      }
      requestAnimationFrame(tryResolve);
    };

    tryResolve();
    return () => {
      cancelled = true;
    };
  }, [scrollSelector]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => ROW_ESTIMATE,
    gap: ROW_GAP,
    overscan: 2
  });

  const gridClass =
    columns === 3 ? "grid-cols-3" : columns === 2 ? "grid-cols-2" : "grid-cols-1";

  if (!scrollElement || prompts.length < VIRTUALIZE_MIN_ITEMS) {
    return (
      <div className={`mt-4 grid gap-5 ${gridClass}`}>
        {prompts.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            variant="desktop"
            onOpen={onOpenPrompt}
            onToggleFavorite={onToggleFavorite}
            onCopy={onCopyPrompt}
            onTagClick={onTagClick}
          />
        ))}
        {footer}
      </div>
    );
  }

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div className="virtual-prompt-grid mt-4">
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualRows.map((row) => {
          const rowPrompts = rows[row.index];
          if (!rowPrompts) return null;
          return (
            <div
              key={row.index}
              ref={virtualizer.measureElement}
              data-index={row.index}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${row.start}px)` }}
            >
              <div className={`grid gap-5 ${gridClass}`}>
                {rowPrompts.map((prompt) => (
                  <PromptCard
                    key={prompt.id}
                    prompt={prompt}
                    variant="desktop"
                    onOpen={onOpenPrompt}
                    onToggleFavorite={onToggleFavorite}
                    onCopy={onCopyPrompt}
                    onTagClick={onTagClick}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {footer}
    </div>
  );
}

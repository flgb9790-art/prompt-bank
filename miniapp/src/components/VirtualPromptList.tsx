import { useEffect, useState, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PromptCard } from "./PromptCard";
import type { Prompt } from "../types";

const VIRTUALIZE_MIN = 14;
const DEFAULT_GAP = 12;

type Props = {
  prompts: Prompt[];
  variant: "mobile" | "list" | "desktop";
  scrollSelector: string;
  estimateSize?: number;
  footer?: ReactNode;
  onOpenPrompt: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onCopyPrompt: (prompt: Prompt) => void;
  onTagClick?: (tag: string) => void;
};

export function VirtualPromptList({
  prompts,
  variant,
  scrollSelector,
  estimateSize = variant === "list" ? 132 : 184,
  footer,
  onOpenPrompt,
  onToggleFavorite,
  onCopyPrompt,
  onTagClick
}: Props) {
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
    count: prompts.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => estimateSize,
    gap: DEFAULT_GAP,
    overscan: 5
  });

  if (!scrollElement || prompts.length < VIRTUALIZE_MIN) {
    return (
      <div className="flex flex-col gap-3">
        {prompts.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            variant={variant}
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

  const items = virtualizer.getVirtualItems();

  return (
    <div className="virtual-prompt-list">
      <div
        className="relative w-full"
        style={{
          height: `${virtualizer.getTotalSize()}px`
        }}
      >
        {items.map((row) => {
          const prompt = prompts[row.index];
          if (!prompt) return null;
          return (
            <div
              key={prompt.id}
              ref={virtualizer.measureElement}
              data-index={row.index}
              className="absolute left-0 top-0 w-full"
              style={{
                transform: `translateY(${row.start}px)`
              }}
            >
              <PromptCard
                prompt={prompt}
                variant={variant}
                onOpen={onOpenPrompt}
                onToggleFavorite={onToggleFavorite}
                onCopy={onCopyPrompt}
                onTagClick={onTagClick}
              />
            </div>
          );
        })}
      </div>
      {footer}
    </div>
  );
}

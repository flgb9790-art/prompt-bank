import { useEffect, useState, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MobilePromptPostCard } from "./MobilePromptPostCard";
import { MobilePromptFeed } from "./MobilePromptFeed";
import { PromptCard } from "./PromptCard";
import type { Prompt } from "../types";

const VIRTUALIZE_MIN = 14;
const FEED_GAP = 18;
const FEED_ESTIMATE_SIZE = 520;

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
  getMetaLabel?: (prompt: Prompt, index: number) => string | undefined;
};

export function VirtualPromptList({
  prompts,
  variant,
  scrollSelector,
  estimateSize,
  footer,
  onOpenPrompt,
  onToggleFavorite,
  onCopyPrompt,
  onTagClick,
  getMetaLabel
}: Props) {
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const isFeed = variant === "mobile";
  const resolvedEstimate = estimateSize ?? (variant === "list" ? 132 : isFeed ? FEED_ESTIMATE_SIZE : 184);
  const listGap = isFeed ? FEED_GAP : 12;

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
    estimateSize: () => resolvedEstimate,
    gap: listGap,
    overscan: 3
  });

  function renderCard(prompt: Prompt, index: number) {
    if (isFeed) {
      return (
        <MobilePromptPostCard
          prompt={prompt}
          imagePriority={index < 2}
          metaLabel={getMetaLabel?.(prompt, index)}
          onOpen={onOpenPrompt}
          onToggleFavorite={onToggleFavorite}
          onCopy={onCopyPrompt}
          onTagClick={onTagClick}
        />
      );
    }

    return (
      <PromptCard
        prompt={prompt}
        variant={variant}
        imagePriority={index < 2}
        onOpen={onOpenPrompt}
        onToggleFavorite={onToggleFavorite}
        onCopy={onCopyPrompt}
        onTagClick={onTagClick}
      />
    );
  }

  if (!scrollElement || prompts.length < VIRTUALIZE_MIN) {
    const body = prompts.map((prompt, index) => <div key={prompt.id}>{renderCard(prompt, index)}</div>);

    if (isFeed) {
      return (
        <MobilePromptFeed>
          {body}
          {footer}
        </MobilePromptFeed>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {body}
        {footer}
      </div>
    );
  }

  const items = virtualizer.getVirtualItems();

  const virtualBody = (
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
            {renderCard(prompt, row.index)}
          </div>
        );
      })}
    </div>
  );

  if (isFeed) {
    return (
      <MobilePromptFeed>
        {virtualBody}
        {footer}
      </MobilePromptFeed>
    );
  }

  return (
    <div className="virtual-prompt-list">
      {virtualBody}
      {footer}
    </div>
  );
}

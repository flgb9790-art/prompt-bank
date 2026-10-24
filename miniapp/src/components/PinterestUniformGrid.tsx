import type { Prompt } from "../types";
import { PinterestPromptCard } from "./PinterestPromptCard";
import { useMediaMinWidth } from "../hooks/useMediaMinWidth";

type Props = {
  prompts: Prompt[];
  loading?: boolean;
  skeletonCount?: number;
  onOpen: (prompt: Prompt) => void;
  onCopy: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onTagClick?: (tag: string) => void;
};

function PinterestSkeletonCard() {
  return (
    <div className="pinterest-uniform-item">
      <div className="pinterest-card pinterest-card-skeleton pinterest-card--uniform">
        <div className="pinterest-skeleton-media pinterest-media--uniform" />
      </div>
    </div>
  );
}

export function PinterestUniformGrid({
  prompts,
  loading = false,
  skeletonCount = 12,
  onOpen,
  onCopy,
  onToggleFavorite,
  onTagClick
}: Props) {
  const desktop = useMediaMinWidth(1024);
  if (loading && !prompts.length) {
    return (
      <div className="pinterest-uniform-grid" aria-busy="true">
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <PinterestSkeletonCard key={`skeleton-${index}`} />
        ))}
      </div>
    );
  }

  if (!prompts.length) {
    return (
      <div className="surface-card empty-state mt-5">
        <p className="text-base font-medium text-[var(--text)]">Промпты не найдены</p>
        <p className="mt-1 text-sm text-[var(--muted)]">Измените фильтры или добавьте новый промпт.</p>
      </div>
    );
  }

  return (
    <div className="pinterest-uniform-grid">
      {prompts.map((prompt, index) => (
        <div key={prompt.id} className="pinterest-uniform-item">
          <PinterestPromptCard
            prompt={prompt}
            uniformAspect
            imagePriority={index < (desktop ? 4 : 2)}
            onOpen={onOpen}
            onCopy={onCopy}
            onToggleFavorite={onToggleFavorite}
            onTagClick={onTagClick}
          />
        </div>
      ))}
    </div>
  );
}

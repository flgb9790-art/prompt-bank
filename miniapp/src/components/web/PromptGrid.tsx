import { VirtualPromptGrid } from "../VirtualPromptGrid";
import { VirtualPromptList } from "../VirtualPromptList";
import { PinterestUniformGrid } from "../PinterestUniformGrid";
import type { Prompt } from "../../types";
import type { ViewMode } from "../../utils/viewMode";

type Props = {
  prompts: Prompt[];
  view: ViewMode;
  onOpenPrompt: (prompt: Prompt) => void;
  onCopyPrompt: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onTagClick?: (tag: string) => void;
  pinterestLoading?: boolean;
  pinterestPageSize?: number;
};

export function PromptGrid({
  prompts,
  view,
  onOpenPrompt,
  onCopyPrompt,
  onToggleFavorite,
  onTagClick,
  pinterestLoading = false,
  pinterestPageSize = 18
}: Props) {
  if (!prompts.length && view !== "pinterest") {
    return (
      <div className="surface-card empty-state mt-5">
        <p className="text-base font-medium text-[var(--text)]">Промпты не найдены</p>
        <p className="mt-1 text-sm text-[var(--muted)]">Измените фильтры или добавьте новый промпт.</p>
      </div>
    );
  }

  if (view === "pinterest") {
    return (
      <div className="pinterest-uniform-grid-outer mt-4">
        <PinterestUniformGrid
          prompts={prompts}
          loading={pinterestLoading}
          skeletonCount={pinterestPageSize}
          onOpen={onOpenPrompt}
          onCopy={onCopyPrompt}
          onToggleFavorite={onToggleFavorite}
          onTagClick={onTagClick}
        />
      </div>
    );
  }

  if (view === "list") {
    return (
      <div className="prompt-list mt-4">
        <VirtualPromptList
          prompts={prompts}
          variant="list"
          scrollSelector=".web-app-main"
          estimateSize={128}
          onOpenPrompt={onOpenPrompt}
          onToggleFavorite={onToggleFavorite}
          onCopyPrompt={onCopyPrompt}
          onTagClick={onTagClick}
        />
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <VirtualPromptGrid
          prompts={prompts}
          scrollSelector=".web-app-main"
          onOpenPrompt={onOpenPrompt}
          onToggleFavorite={onToggleFavorite}
          onCopyPrompt={onCopyPrompt}
          onTagClick={onTagClick}
        />
      </div>
      <div className="mt-4 md:hidden">
        <VirtualPromptList
          prompts={prompts}
          variant="mobile"
          scrollSelector=".web-app-main"
          onOpenPrompt={onOpenPrompt}
          onToggleFavorite={onToggleFavorite}
          onCopyPrompt={onCopyPrompt}
          onTagClick={onTagClick}
        />
      </div>
    </>
  );
}

import type { Prompt } from "../types";
import type { ViewMode } from "../utils/viewMode";
import { VirtualPromptList } from "../components/VirtualPromptList";
import { PinterestMasonryGrid } from "../components/PinterestMasonryGrid";
import { ViewModeSwitcher } from "../components/web/ViewModeSwitcher";

type Props = {
  prompts: Prompt[];
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenPrompt: (prompt: Prompt) => void;
  onCopyPrompt: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onTagClick?: (tag: string) => void;
};

export function FavoritesPage({
  prompts,
  loading = false,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  viewMode,
  onViewModeChange,
  onOpenPrompt,
  onCopyPrompt,
  onToggleFavorite,
  onTagClick
}: Props) {
  if (loading && !prompts.length) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--text)]">Избранное</h2>
          <ViewModeSwitcher value={viewMode} onChange={onViewModeChange} />
        </div>
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="mobile-post-card skeleton mobile-post-card-skeleton" />
        ))}
      </div>
    );
  }

  if (!prompts.length) {
    return (
      <div className="surface-card empty-state mt-8">
        <h2 className="text-lg font-semibold text-[var(--text)]">Пока нет избранных промптов</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Нажмите ⭐ на карточке, чтобы сохранить лучшие промпты.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--text)]">Избранное</h2>
        <ViewModeSwitcher value={viewMode} onChange={onViewModeChange} />
      </div>

      {viewMode === "pinterest" ? (
        <PinterestMasonryGrid
          prompts={prompts}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          onLoadMore={onLoadMore}
          scrollRootSelector=".mobile-frame"
          miniAppSingleColumn
          onOpen={onOpenPrompt}
          onCopy={onCopyPrompt}
          onToggleFavorite={onToggleFavorite}
          onTagClick={onTagClick}
        />
      ) : viewMode === "list" ? (
        <VirtualPromptList
          prompts={prompts}
          variant="list"
          scrollSelector=".mobile-frame"
          onOpenPrompt={onOpenPrompt}
          onToggleFavorite={onToggleFavorite}
          onCopyPrompt={onCopyPrompt}
          onTagClick={onTagClick}
        />
      ) : (
        <VirtualPromptList
          prompts={prompts}
          variant="mobile"
          scrollSelector=".mobile-frame"
          onOpenPrompt={onOpenPrompt}
          onToggleFavorite={onToggleFavorite}
          onCopyPrompt={onCopyPrompt}
          onTagClick={onTagClick}
        />
      )}
    </div>
  );
}

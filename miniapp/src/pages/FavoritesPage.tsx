import type { Prompt } from "../types";
import type { MiniAppViewMode, ViewMode } from "../utils/viewMode";
import { VirtualPromptList } from "../components/VirtualPromptList";
import { ViewModeSwitcher } from "../components/web/ViewModeSwitcher";
import { Pagination } from "../components/web/Pagination";

type Props = {
  prompts: Prompt[];
  loading?: boolean;
  viewMode: MiniAppViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onOpenPrompt: (prompt: Prompt) => void;
  onCopyPrompt: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onTagClick?: (tag: string) => void;
};

export function FavoritesPage({
  prompts,
  loading = false,
  viewMode,
  onViewModeChange,
  page,
  totalItems,
  pageSize,
  onPageChange,
  onOpenPrompt,
  onCopyPrompt,
  onToggleFavorite,
  onTagClick
}: Props) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (loading && !prompts.length) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--text)]">Избранное</h2>
          <ViewModeSwitcher value={viewMode} onChange={onViewModeChange} hidePinterest />
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
        <ViewModeSwitcher value={viewMode} onChange={onViewModeChange} hidePinterest />
      </div>

      {viewMode === "list" ? (
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

      <Pagination
        variant="mini"
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
    </div>
  );
}

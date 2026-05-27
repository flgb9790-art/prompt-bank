import { VirtualPromptList } from "../components/VirtualPromptList";
import { SearchBar } from "../components/SearchBar";
import { ViewModeSwitcher } from "../components/web/ViewModeSwitcher";
import type { Prompt } from "../types";
import type { MiniAppViewMode, ViewMode } from "../utils/viewMode";

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  quickTags: string[];
  results: Prompt[];
  loading: boolean;
  viewMode: MiniAppViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenPrompt: (prompt: Prompt) => void;
  onCopyPrompt: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onTagClick?: (tag: string) => void;
};

export function SearchPage({
  query,
  onQueryChange,
  quickTags,
  results,
  loading,
  viewMode,
  onViewModeChange,
  onOpenPrompt,
  onCopyPrompt,
  onToggleFavorite,
  onTagClick
}: Props) {
  const trimmed = query.trim();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--text)]">Поиск</h2>
        <ViewModeSwitcher value={viewMode} onChange={onViewModeChange} hidePinterest />
      </div>

      <SearchBar value={query} onChange={onQueryChange} placeholder="Введите слово, тег или часть названия..." />
      <div className="flex flex-wrap gap-2">
        {quickTags.map((tag) => (
          <button key={tag} type="button" className="chip" onClick={() => onQueryChange(tag)}>
            {tag}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="mobile-post-card skeleton mobile-post-card-skeleton" />
          ))}
        </div>
      ) : trimmed.length < 2 ? (
        <p className="text-sm text-[var(--muted)]">Введите минимум 2 символа для поиска по всей базе.</p>
      ) : !results.length ? (
        <div className="surface-card empty-state">
          <p className="text-base font-medium text-[var(--text)]">Ничего не найдено</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Попробуйте другое слово или тег.</p>
        </div>
      ) : viewMode === "list" ? (
        <VirtualPromptList
          prompts={results}
          variant="list"
          scrollSelector=".mobile-frame"
          onOpenPrompt={onOpenPrompt}
          onToggleFavorite={onToggleFavorite}
          onCopyPrompt={onCopyPrompt}
          onTagClick={onTagClick}
        />
      ) : (
        <VirtualPromptList
          prompts={results}
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

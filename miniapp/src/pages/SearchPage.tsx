import { SearchBar } from "../components/SearchBar";
import { MiniAppPinterestFeed } from "../components/MiniAppPinterestFeed";
import type { Prompt } from "../types";

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  quickTags: string[];
  results: Prompt[];
  loading: boolean;
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
  onOpenPrompt,
  onCopyPrompt,
  onToggleFavorite,
  onTagClick
}: Props) {
  const trimmed = query.trim();

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-[var(--text)]">Поиск</h2>

      <SearchBar value={query} onChange={onQueryChange} placeholder="Введите слово, тег или часть текста..." />
      <div className="flex flex-wrap gap-2">
        {quickTags.map((tag) => (
          <button key={tag} type="button" className="chip" onClick={() => onQueryChange(tag)}>
            {tag}
          </button>
        ))}
      </div>

      {trimmed.length < 2 ? (
        <p className="text-sm text-[var(--muted)]">Введите минимум 2 символа для поиска по всей базе.</p>
      ) : (
        <MiniAppPinterestFeed
          prompts={results}
          loading={loading}
          emptyState={
            <div className="surface-card empty-state">
              <p className="text-base font-medium text-[var(--text)]">Ничего не найдено</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Попробуйте другое слово или тег.</p>
            </div>
          }
          onOpen={onOpenPrompt}
          onCopy={onCopyPrompt}
          onToggleFavorite={onToggleFavorite}
          onTagClick={onTagClick}
        />
      )}
    </div>
  );
}

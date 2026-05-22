import { useEffect, useMemo, useState } from "react";
import { useLoadMoreOnScroll } from "../hooks/useLoadMoreOnScroll";
import type { Category, Prompt } from "../types";
import { SearchBar } from "../components/SearchBar";
import { CategoryTabs } from "../components/CategoryTabs";
import { VirtualPromptList } from "../components/VirtualPromptList";
import { promptHasTag } from "../utils/tagFilter";
import { getPromptSearchText } from "../utils/promptContent";

type Props = {
  prompts: Prompt[];
  categories: Category[];
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  error: string;
  onOpenPrompt: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onCopyPrompt: (prompt: Prompt) => void;
  onTagClick?: (tag: string) => void;
  activeTag?: string;
  onClearTag?: () => void;
};

type SortMode = "new" | "old" | "usage" | "favorites";

export function PromptsPage({
  prompts,
  categories,
  loading,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  error,
  onOpenPrompt,
  onToggleFavorite,
  onCopyPrompt,
  onTagClick,
  activeTag,
  onClearTag
}: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>();
  const [sort, setSort] = useState<SortMode>("new");

  useEffect(() => {
    if (!activeTag) return;
    setQuery("");
    setCategory(undefined);
  }, [activeTag]);

  const categoriesWithPrompts = useMemo(() => {
    const counts = prompts.reduce<Record<string, number>>((acc, prompt) => {
      acc[prompt.category.slug] = (acc[prompt.category.slug] ?? 0) + 1;
      return acc;
    }, {});
    return categories.filter((item) => (counts[item.slug] ?? 0) > 0);
  }, [categories, prompts]);

  const filtered = useMemo(() => {
    let list = [...prompts];
    if (query) {
      const low = query.toLowerCase();
      list = list.filter((item) => getPromptSearchText(item).includes(low));
    }
    if (category) {
      list = list.filter((item) => item.category.slug === category);
    }
    if (activeTag) {
      list = list.filter((item) => promptHasTag(item, activeTag));
    }
    if (sort === "new") list.sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));
    if (sort === "old") list.sort((a, b) => Number(new Date(a.createdAt)) - Number(new Date(b.createdAt)));
    if (sort === "usage") list.sort((a, b) => b.usageCount - a.usageCount);
    if (sort === "favorites") list = list.filter((item) => item.isFavorite);
    return list;
  }, [prompts, query, category, sort, activeTag]);

  const loadMoreRef = useLoadMoreOnScroll({
    enabled: !loading && !error && filtered.length > 0,
    loading: Boolean(loadingMore),
    hasMore: Boolean(hasMore && onLoadMore),
    onLoadMore: () => onLoadMore?.()
  });

  return (
    <div className="space-y-3 pb-1">
      {activeTag ? (
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-[var(--text)]">
            Тег: {activeTag}
            <span className="ml-2 text-sm font-normal text-[var(--muted)]">({filtered.length})</span>
          </h2>
          <button type="button" className="chip active" onClick={onClearTag}>
            Сбросить фильтр ×
          </button>
        </div>
      ) : null}
      <SearchBar value={query} onChange={setQuery} placeholder="Поиск по названию, тексту, тегам..." />
      {!activeTag ? <CategoryTabs categories={categoriesWithPrompts} active={category} onSelect={setCategory} /> : null}

      <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="form-select">
        <option value="new">Новые</option>
        <option value="old">Старые</option>
        <option value="usage">Часто используемые</option>
        <option value="favorites">Избранные</option>
      </select>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="skeleton h-36" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-[var(--red)]">{error}</p>
      ) : !filtered.length ? (
        <div className="surface-card empty-state">
          <p className="text-base font-medium text-[var(--text)]">Ничего не найдено</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Попробуйте другой запрос или категорию.</p>
        </div>
      ) : (
        <VirtualPromptList
          prompts={filtered}
          variant="mobile"
          scrollSelector=".mobile-frame"
          onOpenPrompt={onOpenPrompt}
          onToggleFavorite={onToggleFavorite}
          onCopyPrompt={onCopyPrompt}
          onTagClick={onTagClick}
          footer={
            <div ref={loadMoreRef} className="flex min-h-8 items-center justify-center py-2">
              {loadingMore ? <span className="text-xs text-[var(--muted)]">Загрузка...</span> : null}
            </div>
          }
        />
      )}
    </div>
  );
}

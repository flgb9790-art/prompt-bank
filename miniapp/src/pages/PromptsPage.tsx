import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, Prompt } from "../types";
import type { MiniAppViewMode, ViewMode } from "../utils/viewMode";
import { SearchBar } from "../components/SearchBar";
import { CategoryTabs } from "../components/CategoryTabs";
import { VirtualPromptList } from "../components/VirtualPromptList";
import { ViewModeSwitcher } from "../components/web/ViewModeSwitcher";
import { Pagination } from "../components/web/Pagination";
import { promptHasTag } from "../utils/tagFilter";
import { getPromptSearchText } from "../utils/promptContent";

type SortMode = "new" | "old" | "usage" | "favorites";

type ListFilters = {
  search: string;
  category?: string;
  sort: SortMode;
};

type Props = {
  prompts: Prompt[];
  categories: Category[];
  loading: boolean;
  error: string;
  viewMode: MiniAppViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onOpenPrompt: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onCopyPrompt: (prompt: Prompt) => void;
  onTagClick?: (tag: string) => void;
  activeTag?: string;
  onClearTag?: () => void;
  onFiltersChange?: (filters: ListFilters) => void;
  filterDebounceMs?: number;
};

export function PromptsPage({
  prompts,
  categories,
  loading,
  error,
  viewMode,
  onViewModeChange,
  page,
  totalItems,
  pageSize,
  onPageChange,
  onOpenPrompt,
  onToggleFavorite,
  onCopyPrompt,
  onTagClick,
  activeTag,
  onClearTag,
  onFiltersChange,
  filterDebounceMs = 350
}: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>();
  const [sort, setSort] = useState<SortMode>("new");
  const serverFilters = Boolean(onFiltersChange);
  const filtersBootstrappedRef = useRef(false);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (!activeTag) return;
    setQuery("");
    setCategory(undefined);
  }, [activeTag]);

  useEffect(() => {
    if (!onFiltersChange) return;
    if (!filtersBootstrappedRef.current) {
      filtersBootstrappedRef.current = true;
      return;
    }
    const timer = setTimeout(() => {
      onFiltersChange({ search: query, category, sort });
    }, filterDebounceMs);
    return () => clearTimeout(timer);
  }, [query, category, sort, onFiltersChange, filterDebounceMs]);

  const categoriesWithPrompts = useMemo(() => {
    const counts = prompts.reduce<Record<string, number>>((acc, prompt) => {
      acc[prompt.category.slug] = (acc[prompt.category.slug] ?? 0) + 1;
      return acc;
    }, {});
    return categories.filter((item) => (counts[item.slug] ?? 0) > 0);
  }, [categories, prompts]);

  const filtered = useMemo(() => {
    if (serverFilters) {
      return prompts;
    }
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
  }, [prompts, query, category, sort, activeTag, serverFilters]);

  function renderPrompts() {
    if (loading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="mobile-post-card skeleton mobile-post-card-skeleton" />
          ))}
        </div>
      );
    }

    if (error) {
      return <p className="text-sm text-[var(--red)]">{error}</p>;
    }

    if (!filtered.length) {
      return (
        <div className="surface-card empty-state">
          <p className="text-base font-medium text-[var(--text)]">Ничего не найдено</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Попробуйте другой запрос или категорию.</p>
        </div>
      );
    }

    if (viewMode === "list") {
      return (
        <VirtualPromptList
          prompts={filtered}
          variant="list"
          scrollSelector=".mobile-frame"
          onOpenPrompt={onOpenPrompt}
          onToggleFavorite={onToggleFavorite}
          onCopyPrompt={onCopyPrompt}
          onTagClick={onTagClick}
        />
      );
    }

    return (
      <VirtualPromptList
        prompts={filtered}
        variant="mobile"
        scrollSelector=".mobile-frame"
        onOpenPrompt={onOpenPrompt}
        onToggleFavorite={onToggleFavorite}
        onCopyPrompt={onCopyPrompt}
        onTagClick={onTagClick}
      />
    );
  }

  return (
    <div className="space-y-3 pb-1">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--text)]">Все промпты</h2>
        <ViewModeSwitcher value={viewMode} onChange={onViewModeChange} hidePinterest />
      </div>

      {activeTag ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--text)]">
            Тег: {activeTag}
            <span className="ml-2 text-sm font-normal text-[var(--muted)]">({totalItems})</span>
          </h3>
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

      {renderPrompts()}

      {!loading && !error && totalItems > 0 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={onPageChange}
        />
      ) : null}
    </div>
  );
}

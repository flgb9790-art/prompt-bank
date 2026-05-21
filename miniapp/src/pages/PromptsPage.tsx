import { useMemo, useState } from "react";
import type { Category, Prompt } from "../types";
import { SearchBar } from "../components/SearchBar";
import { CategoryTabs } from "../components/CategoryTabs";
import { PromptCard } from "../components/PromptCard";

type Props = {
  prompts: Prompt[];
  categories: Category[];
  loading: boolean;
  error: string;
  onOpenPrompt: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onCopyPrompt: (prompt: Prompt) => void;
};

type SortMode = "new" | "old" | "usage" | "favorites";

export function PromptsPage({ prompts, categories, loading, error, onOpenPrompt, onToggleFavorite, onCopyPrompt }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>();
  const [sort, setSort] = useState<SortMode>("new");

  const filtered = useMemo(() => {
    let list = [...prompts];
    if (query) {
      const low = query.toLowerCase();
      list = list.filter((item) => {
        const keywords = item.keywords.map((k) => k.keyword.name).join(" ");
        return `${item.title} ${item.content} ${item.category.name} ${keywords}`.toLowerCase().includes(low);
      });
    }
    if (category) {
      list = list.filter((item) => item.category.slug === category);
    }
    if (sort === "new") list.sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));
    if (sort === "old") list.sort((a, b) => Number(new Date(a.createdAt)) - Number(new Date(b.createdAt)));
    if (sort === "usage") list.sort((a, b) => b.usageCount - a.usageCount);
    if (sort === "favorites") list = list.filter((item) => item.isFavorite);
    return list;
  }, [prompts, query, category, sort]);

  return (
    <div className="space-y-3 pb-1">
      <SearchBar value={query} onChange={setQuery} placeholder="Поиск по названию, тексту, тегам..." />
      <CategoryTabs categories={categories} active={category} onSelect={setCategory} />

      <select
        value={sort}
        onChange={(event) => setSort(event.target.value as SortMode)}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm"
      >
        <option value="new">Новые</option>
        <option value="old">Старые</option>
        <option value="usage">Часто используемые</option>
        <option value="favorites">Избранные</option>
      </select>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="glass-card skeleton h-28" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : !filtered.length ? (
        <div className="glass-card empty-state">
          <p className="text-base font-medium text-slate-100">Ничего не найдено</p>
          <p className="mt-1 text-sm text-muted">Попробуйте другой запрос или категорию.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} onOpen={onOpenPrompt} onToggleFavorite={onToggleFavorite} onCopy={onCopyPrompt} />
          ))}
        </div>
      )}
    </div>
  );
}

import type { Category } from "../types";

type Props = {
  categories: Category[];
  active?: string;
  onSelect: (slug: string | undefined) => void;
};

export function CategoryTabs({ categories, active, onSelect }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      <button
        type="button"
        onClick={() => onSelect(undefined)}
        className={`chip whitespace-nowrap ${!active ? "active" : ""}`}
      >
        Все
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.slug)}
          className={`chip whitespace-nowrap ${active === category.slug ? "active" : ""}`}
        >
          {category.icon ?? "📂"} {category.name}
        </button>
      ))}
    </div>
  );
}

import { FolderTree, Hash, Heart, Home, LayoutGrid, Plus, Settings, Timer } from "lucide-react";
import type { Category } from "../../types";

type RouteKey = "/" | "/prompts" | "/favorites" | "/recent" | "/categories" | "/tags" | "/settings";

type Props = {
  currentPath: string;
  categories: Category[];
  categoryCounts: Record<string, number>;
  activeCategory?: string;
  isAuthenticated: boolean;
  onNavigate: (path: RouteKey) => void;
  onSelectCategory: (slug?: string) => void;
  onLogin: () => void;
};

const navItems: Array<{ path: RouteKey; label: string; icon: typeof Home }> = [
  { path: "/", label: "Главная", icon: Home },
  { path: "/prompts", label: "Все промпты", icon: LayoutGrid },
  { path: "/favorites", label: "Избранное", icon: Heart },
  { path: "/recent", label: "Последние", icon: Timer },
  { path: "/tags", label: "Теги", icon: Hash }
];

export function Sidebar({
  currentPath,
  categories,
  categoryCounts,
  activeCategory,
  isAuthenticated,
  onNavigate,
  onSelectCategory,
  onLogin
}: Props) {
  return (
    <div className="flex h-full flex-col">
      <button type="button" onClick={() => onNavigate("/")} className="flex h-12 items-center gap-3 text-left">
        <div className="brand-logo-icon">P</div>
        <span className="brand-logo-text">Prompt Bank</span>
      </button>

      <nav className="mt-7 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentPath === item.path;
          return (
            <button key={item.path} type="button" onClick={() => onNavigate(item.path)} className={`nav-item ${active ? "active" : ""}`}>
              <Icon size={20} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <span className="categories-label">Категории</span>
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-lg text-[var(--muted)] transition hover:bg-[#f2f4f7]"
            onClick={() => onNavigate("/categories")}
            aria-label="Все категории"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="no-scrollbar max-h-[280px] space-y-0.5 overflow-y-auto">
          {categories.map((category) => {
            const isActive = activeCategory === category.slug;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  onSelectCategory(category.slug);
                  onNavigate("/prompts");
                }}
                className={`category-item ${isActive ? "active" : ""}`}
              >
                <span className="category-item-icon">{category.icon ?? "•"}</span>
                <span className="truncate">{category.name}</span>
                <span className="ml-auto text-[13px] text-[var(--muted)]">{categoryCounts[category.slug] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 pb-4">
        {isAuthenticated ? (
          <button type="button" onClick={() => onNavigate("/settings")} className="settings-btn flex h-12 w-full items-center gap-3 rounded-[14px] border border-[var(--border)] bg-white px-4 text-[15px] text-[var(--text-soft)]">
            <Settings size={18} />
            Настройки
          </button>
        ) : (
          <button type="button" onClick={onLogin} className="btn-secondary h-12 w-full">
            Войти
          </button>
        )}
      </div>
    </div>
  );
}

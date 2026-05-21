import { ChevronDown, FolderTree, Hash, Heart, Home, LayoutGrid, Settings, Timer } from "lucide-react";
import { useState } from "react";
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
  const [categoriesOpen, setCategoriesOpen] = useState(currentPath === "/categories");

  return (
    <div className="flex h-full flex-col p-4">
      <button type="button" onClick={() => onNavigate("/")} className="flex items-center gap-3 px-2 text-left">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--blue)] font-bold">P</div>
        <div>
          <p className="text-xl font-bold">Prompt Bank</p>
        </div>
      </button>

      <nav className="mt-8 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentPath === item.path;
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={`flex h-[42px] w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] transition ${
                active
                  ? "bg-gradient-to-r from-[rgba(109,93,252,0.22)] to-[rgba(139,92,246,0.1)] text-[#a78bfa]"
                  : "text-[#a4adbd] hover:bg-white/5"
              }`}
              type="button"
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => {
            setCategoriesOpen((prev) => !prev);
          }}
          className={`mt-1 flex h-[42px] w-full items-center justify-between rounded-xl px-3 text-left text-[15px] transition ${
            currentPath === "/categories"
              ? "bg-gradient-to-r from-[rgba(109,93,252,0.22)] to-[rgba(139,92,246,0.1)] text-[#a78bfa]"
              : "text-[#a4adbd] hover:bg-white/5"
          }`}
        >
          <span className="flex items-center gap-3">
            <FolderTree size={18} />
            Категории
          </span>
          <ChevronDown
            size={16}
            className={`transition-transform ${categoriesOpen ? "rotate-180" : ""}`}
          />
        </button>

        {categoriesOpen ? (
          <div className="no-scrollbar mt-2 max-h-[280px] space-y-1 overflow-y-auto pl-2 pr-1">
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
                  className={`flex h-[34px] w-full items-center justify-between rounded-lg px-2 text-sm ${
                    isActive ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="grid h-5 w-5 place-items-center rounded bg-white/10 text-xs">
                      {category.icon ?? "•"}
                    </span>
                    <span className="truncate">{category.name}</span>
                  </span>
                  <span className="text-xs text-[#8a93a5]">{categoryCounts[category.slug] ?? 0}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </nav>

      <div className="mt-auto space-y-2 p-2">
        {isAuthenticated ? (
          <button
            type="button"
            onClick={() => onNavigate("/settings")}
            className="flex h-[42px] w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-200"
          >
            <Settings size={18} />
            Настройки
          </button>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-xs text-muted">Войдите, чтобы добавлять свои промпты</p>
            <button type="button" onClick={onLogin} className="mt-2 w-full rounded-lg bg-white/10 py-2 text-sm">
              Войти
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import { Home, LayoutGrid, Plus, Search, Star, User, X } from "lucide-react";
import type { ReactNode } from "react";
import { BrandLogo } from "../BrandLogo";

type RouteKey = "/" | "/prompts" | "/favorites" | "/recent" | "/tags" | "/categories" | "/settings" | "/copied" | "/viewed";

type Props = {
  currentPath: RouteKey;
  search: string;
  onSearchChange: (value: string) => void;
  onNavigate: (path: RouteKey) => void;
  canCreate?: boolean;
  onCreatePrompt: () => void;
  headerRight: ReactNode;
  children: ReactNode;
};

const tabs: Array<{ path: RouteKey; label: string; icon: typeof Home }> = [
  { path: "/", label: "Главная", icon: Home },
  { path: "/prompts", label: "Промпты", icon: LayoutGrid },
  { path: "/favorites", label: "Избранное", icon: Star },
  { path: "/tags", label: "Теги", icon: Search },
  { path: "/settings", label: "Профиль", icon: User }
];

export function MobileWebShell({
  currentPath,
  search,
  onSearchChange,
  onNavigate,
  canCreate = false,
  onCreatePrompt,
  headerRight,
  children
}: Props) {
  return (
    <div className="mobile-web-shell flex min-h-dvh flex-col lg:hidden">
      <header className="mobile-web-header px-4 pt-[18px]">
        <div className="flex items-center justify-between gap-3">
          <BrandLogo size={36} textClassName="text-[22px] font-[760] text-[var(--text)]" />
          {headerRight}
        </div>
        {currentPath === "/prompts" || currentPath === "/" ? (
          <div className="mobile-search search-field">
          <Search size={18} aria-hidden />
          <input
            type="search"
            aria-label="Поиск промптов"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Поиск промптов..."
          />
          {search ? <button type="button" className="search-clear" aria-label="Очистить поиск" onClick={() => onSearchChange("")}><X size={17} /></button> : null}
          </div>
        ) : null}
      </header>

      <main className="prompt-scroll-root flex-1 overflow-y-auto px-4 pb-28 pt-4">{children}</main>

      {canCreate && currentPath !== "/settings" ? (
        <button type="button" onClick={onCreatePrompt} className="cta-button mx-0 mb-[88px]">
          <Plus size={20} className="cta-button-icon" strokeWidth={2.5} />
          Новый промпт
        </button>
      ) : null}

      <nav className="bottom-nav" aria-label="Основная навигация">
        <div className="bottom-nav-inner">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = currentPath === tab.path;
            return (
              <button key={tab.path} type="button" aria-current={active ? "page" : undefined} onClick={() => onNavigate(tab.path)} className={`bottom-nav-item ${active ? "active" : ""}`}>
                <Icon size={24} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

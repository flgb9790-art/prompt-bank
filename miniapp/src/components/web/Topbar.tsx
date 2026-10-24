import { Menu, Plus, Search, X } from "lucide-react";
import { useEffect, useRef } from "react";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  isAuthenticated?: boolean;
  canCreate?: boolean;
  onCreatePrompt: () => void;
  onLoginTelegram: () => void;
  onMenuClick?: () => void;
};

export function Topbar({
  search,
  onSearchChange,
  isAuthenticated = false,
  canCreate = false,
  onCreatePrompt,
  onLoginTelegram,
  onMenuClick
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);
  return (
    <div className="flex h-[72px] items-center justify-between gap-4 px-4 lg:px-7">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {onMenuClick ? (
          <button type="button" className="btn-ghost-icon lg:hidden" onClick={onMenuClick} aria-label="Меню">
            <Menu size={20} />
          </button>
        ) : null}
        <div className="search-field w-full max-w-[520px] lg:max-w-[520px]">
          <Search size={18} className="mr-2 shrink-0 text-[var(--muted)]" />
          <input
            ref={searchRef}
            type="search"
            aria-label="Поиск промптов"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Поиск промптов..."
          />
          {search ? <button type="button" className="search-clear" aria-label="Очистить поиск" onClick={() => { onSearchChange(""); searchRef.current?.focus(); }}><X size={16} /></button>
            : <kbd className="search-shortcut">Ctrl / ⌘ K</kbd>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {canCreate ? (
          <button type="button" onClick={onCreatePrompt} className="btn-primary hidden md:inline-flex">
            <Plus size={16} />
            <span className="hidden lg:inline">Новый промпт</span>
            <span className="lg:hidden">Новый</span>
          </button>
        ) : null}
        {!isAuthenticated ? (
          <button type="button" onClick={onLoginTelegram} className="btn-secondary">
            Войти
          </button>
        ) : null}
      </div>
    </div>
  );
}

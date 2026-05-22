import { Menu, Plus, Search } from "lucide-react";
import type { TelegramUser } from "../../types";
import { AuthButton } from "./AuthButton";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  user: TelegramUser | null;
  onCreatePrompt: () => void;
  onLoginTelegram: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onMenuClick?: () => void;
};

export function Topbar({
  search,
  onSearchChange,
  user,
  onCreatePrompt,
  onLoginTelegram,
  onOpenSettings,
  onLogout,
  onMenuClick
}: Props) {
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
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Поиск промптов..."
          />
          <span className="hidden text-[13px] text-[var(--muted-light)] md:inline">⌘ K</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button type="button" onClick={onCreatePrompt} className="btn-primary hidden md:inline-flex">
          <Plus size={16} />
          <span className="hidden lg:inline">Новый промпт</span>
          <span className="lg:hidden">Новый</span>
        </button>
        <AuthButton user={user} onLoginTelegram={onLoginTelegram} onOpenSettings={onOpenSettings} onLogout={onLogout} />
      </div>
    </div>
  );
}

import { Plus, Search } from "lucide-react";
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
};

export function Topbar({
  search,
  onSearchChange,
  user,
  onCreatePrompt,
  onLoginTelegram,
  onOpenSettings,
  onLogout
}: Props) {
  return (
    <div className="flex h-[72px] items-center justify-between gap-3 px-4 lg:px-7">
      <div className="relative w-full max-w-[520px]">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Поиск промптов..."
          className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm outline-none ring-[var(--primary)]/30 focus:ring"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCreatePrompt}
          className="hidden h-11 items-center gap-2 rounded-[10px] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] px-5 text-sm font-medium md:flex"
        >
          <Plus size={16} />
          Новый промпт
        </button>
        <AuthButton
          user={user}
          onLoginTelegram={onLoginTelegram}
          onOpenSettings={onOpenSettings}
          onLogout={onLogout}
        />
      </div>
    </div>
  );
}

import { LogOut, Settings } from "lucide-react";
import { useState } from "react";
import type { TelegramUser } from "../../types";

type Props = {
  user: TelegramUser | null;
  onLoginTelegram: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
};

export function AuthButton({ user, onLoginTelegram, onOpenSettings, onLogout }: Props) {
  const [open, setOpen] = useState(false);

  if (!user) {
    return (
      <button
        type="button"
        onClick={onLoginTelegram}
        className="h-10 rounded-[10px] border border-white/10 bg-white/10 px-4 text-sm text-white hover:bg-white/15"
      >
        Войти
      </button>
    );
  }

  const avatarLetter = (user.first_name?.[0] ?? user.username?.[0] ?? "U").toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="grid h-[42px] w-[42px] place-items-center rounded-full border border-white/15 bg-gradient-to-br from-[var(--primary)] to-[var(--blue)] font-semibold"
      >
        {avatarLetter}
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-white/10 bg-[#0d1324] p-2 shadow-xl">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{user.first_name ?? "User"}</p>
            <p className="text-xs text-muted">@{user.username ?? "telegram"}</p>
          </div>
          <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-white/5" onClick={onOpenSettings}>
            <Settings size={16} />
            Настройки
          </button>
          <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-300 hover:bg-red-500/10" onClick={onLogout}>
            <LogOut size={16} />
            Выйти
          </button>
        </div>
      ) : null}
    </div>
  );
}

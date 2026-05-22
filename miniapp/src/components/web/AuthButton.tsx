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
      <button type="button" onClick={onLoginTelegram} className="btn-secondary">
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
        className="grid h-[42px] w-[42px] place-items-center rounded-full border-2 border-white bg-gradient-to-br from-[var(--primary)] to-[var(--purple)] text-sm font-semibold text-white shadow-[0_6px_16px_rgba(16,24,40,0.10)]"
      >
        {avatarLetter}
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-[var(--border)] bg-white p-2 shadow-hover">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium text-[var(--text)]">{user.first_name ?? "User"}</p>
            <p className="text-xs text-[var(--muted)]">@{user.username ?? "telegram"}</p>
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-[var(--text-soft)] hover:bg-[#f5f6fb]"
            onClick={onOpenSettings}
          >
            <Settings size={16} />
            Настройки
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-[var(--red)] hover:bg-[var(--red-soft)]"
            onClick={onLogout}
          >
            <LogOut size={16} />
            Выйти
          </button>
        </div>
      ) : null}
    </div>
  );
}

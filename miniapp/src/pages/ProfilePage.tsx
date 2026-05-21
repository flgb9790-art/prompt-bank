import type { TelegramUser } from "../types";

type Props = {
  user: TelegramUser;
  promptsCount: number;
  favoritesCount: number;
};

export function ProfilePage({ user, promptsCount, favoritesCount }: Props) {
  return (
    <div className="space-y-3">
      <div className="glass-card p-4">
        <h2 className="text-lg font-semibold">Профиль</h2>
        <p className="mt-2 text-sm text-muted">ID: {user.id}</p>
        <p className="text-sm text-muted">Username: {user.username ?? "—"}</p>
        <p className="text-sm text-muted">
          Имя: {[user.first_name, user.last_name].filter(Boolean).join(" ") || "—"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="glass-card p-3">
          <p className="text-xs text-muted">Промптов</p>
          <p className="text-xl font-semibold">{promptsCount}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-xs text-muted">Избранных</p>
          <p className="text-xl font-semibold">{favoritesCount}</p>
        </div>
      </div>
      <div className="glass-card p-4 text-sm text-muted">
        <p className="font-medium text-slate-200">О проекте</p>
        <p className="mt-1">
          Prompt Bank MVP: Telegram-бот + Mini App для хранения, поиска, копирования и управления промптами.
        </p>
      </div>
    </div>
  );
}

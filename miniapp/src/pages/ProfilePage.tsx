import type { TelegramUser } from "../types";

type Props = {
  user: TelegramUser;
  promptsCount: number;
  favoritesCount: number;
};

export function ProfilePage({ user, promptsCount, favoritesCount }: Props) {
  return (
    <div className="space-y-3">
      <div className="surface-card p-4">
        <h2 className="text-lg font-semibold text-[var(--text)]">Профиль</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">ID: {user.id}</p>
        <p className="text-sm text-[var(--muted)]">Username: {user.username ?? "—"}</p>
        <p className="text-sm text-[var(--muted)]">Имя: {[user.first_name, user.last_name].filter(Boolean).join(" ") || "—"}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card-mobile">
          <div>
            <p className="stat-value-mobile">{promptsCount}</p>
            <p className="stat-label-mobile">Промптов</p>
          </div>
        </div>
        <div className="stat-card-mobile">
          <div>
            <p className="stat-value-mobile">{favoritesCount}</p>
            <p className="stat-label-mobile">Избранных</p>
          </div>
        </div>
      </div>
      <div className="surface-card p-4 text-sm text-[var(--muted)]">
        <p className="font-medium text-[var(--text)]">О проекте</p>
        <p className="mt-1">Prompt Bank — библиотека промптов для AI: хранение, поиск, копирование и управление.</p>
      </div>
    </div>
  );
}

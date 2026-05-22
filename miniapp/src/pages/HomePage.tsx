import { BarChart3, Heart, Layers, Plus, Sparkles } from "lucide-react";
import type { Prompt } from "../types";
import { PromptCard } from "../components/PromptCard";

type Props = {
  recentPrompts: Prompt[];
  recentLoading?: boolean;
  stats: { total: number; favorites: number; categories: number; usage: number };
  onOpenPrompt: (prompt: Prompt) => void;
  onCopyPrompt: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onTagClick?: (tag: string) => void;
  onCreate?: () => void;
  onViewAll?: () => void;
  showCreateButton?: boolean;
  isAdmin?: boolean;
};

export function HomePage({
  recentPrompts,
  recentLoading = false,
  stats,
  onOpenPrompt,
  onCopyPrompt,
  onToggleFavorite,
  onTagClick,
  onCreate,
  onViewAll,
  showCreateButton = true,
  isAdmin = false
}: Props) {
  const welcomeText = isAdmin
    ? "Здесь хранятся все промпты банка. Легко находите, копируйте и управляйте контентом."
    : "Готовые промпты для работы. Ищите по категориям и тегам, копируйте и сохраняйте в избранное.";

  return (
    <div className="space-y-4 pb-4">
      <section>
        <h1 className="mobile-welcome-title">Добро пожаловать! 👋</h1>
        <p className="welcome-subtitle">{welcomeText}</p>
      </section>

      <section className="grid grid-cols-2 gap-2.5">
        <div className="stat-tile-mobile">
          <p className="stat-tile-value">{stats.total}</p>
          <p className="stat-tile-label">Всего</p>
        </div>
        <div className="stat-tile-mobile">
          <p className="stat-tile-value">{stats.favorites}</p>
          <p className="stat-tile-label">Избранные</p>
        </div>
        <div className="stat-tile-mobile">
          <p className="stat-tile-value">{stats.categories}</p>
          <p className="stat-tile-label">Категории</p>
        </div>
        <div className="stat-tile-mobile">
          <p className="stat-tile-value">{stats.usage}</p>
          <p className="stat-tile-label stat-tile-label--usage">Использований</p>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="mobile-section-title">Недавние промпты</h2>
          {onViewAll ? (
            <button type="button" className="link-primary" onClick={onViewAll}>
              Все
            </button>
          ) : null}
        </div>
        {recentLoading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="skeleton h-36" />
            ))}
          </div>
        ) : recentPrompts.length ? (
          <div className="mt-4 flex flex-col gap-3">
            {recentPrompts.map((prompt, index) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                variant="mobile"
                imagePriority={index < 3}
                onOpen={onOpenPrompt}
                onCopy={onCopyPrompt}
                onToggleFavorite={onToggleFavorite}
                onTagClick={onTagClick}
              />
            ))}
          </div>
        ) : (
          <div className="surface-card empty-state mt-4">
            <p className="text-base font-medium text-[var(--text)]">Пока нет промптов</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Создайте первый промпт кнопкой ниже.</p>
          </div>
        )}
      </section>

      {showCreateButton && onCreate ? (
        <button type="button" onClick={onCreate} className="cta-button">
          <Plus size={20} className="cta-button-icon" strokeWidth={2.5} />
          Новый промпт
        </button>
      ) : null}
    </div>
  );
}

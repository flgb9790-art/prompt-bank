import { BarChart3, Heart, Layers, Plus, Sparkles } from "lucide-react";
import type { Prompt } from "../types";
import type { MiniAppViewMode, ViewMode } from "../utils/viewMode";
import { MobilePromptFeed } from "../components/MobilePromptFeed";
import { MobilePromptPostCard } from "../components/MobilePromptPostCard";
import { VirtualPromptList } from "../components/VirtualPromptList";
import { ViewModeSwitcher } from "../components/web/ViewModeSwitcher";

type Props = {
  recentPrompts: Prompt[];
  recentLoading?: boolean;
  stats: { total: number; favorites: number; categories: number; usage: number };
  viewMode: MiniAppViewMode;
  onViewModeChange: (mode: ViewMode) => void;
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
  viewMode,
  onViewModeChange,
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

  function renderRecentPrompts() {
    if (recentLoading) {
      return (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="mobile-post-card skeleton mobile-post-card-skeleton" />
          ))}
        </div>
      );
    }

    if (!recentPrompts.length) {
      return (
        <div className="surface-card empty-state mt-4">
          <p className="text-base font-medium text-[var(--text)]">Пока нет промптов</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Создайте первый промпт кнопкой ниже.</p>
        </div>
      );
    }

    if (viewMode === "list") {
      return (
        <div className="mt-4">
          <VirtualPromptList
            prompts={recentPrompts}
            variant="list"
            scrollSelector=".mobile-frame"
            estimateSize={128}
            onOpenPrompt={onOpenPrompt}
            onToggleFavorite={onToggleFavorite}
            onCopyPrompt={onCopyPrompt}
            onTagClick={onTagClick}
          />
        </div>
      );
    }

    return (
      <MobilePromptFeed className="mt-4">
        {recentPrompts.map((prompt, index) => (
          <MobilePromptPostCard
            key={prompt.id}
            prompt={prompt}
            imagePriority={index < 3}
            onOpen={onOpenPrompt}
            onCopy={onCopyPrompt}
            onToggleFavorite={onToggleFavorite}
            onTagClick={onTagClick}
          />
        ))}
      </MobilePromptFeed>
    );
  }

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
        <div className="flex items-center justify-between gap-3">
          <h2 className="mobile-section-title">Недавние промпты</h2>
          <div className="flex items-center gap-2">
            {onViewAll ? (
              <button type="button" className="link-primary" onClick={onViewAll}>
                Все
              </button>
            ) : null}
            <ViewModeSwitcher value={viewMode} onChange={onViewModeChange} hidePinterest />
          </div>
        </div>
        {renderRecentPrompts()}
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

import { Plus } from "lucide-react";
import type { Prompt } from "../types";
import type { MiniAppViewMode, ViewMode } from "../utils/viewMode";
import { MobilePromptFeed } from "../components/MobilePromptFeed";
import { MobilePromptPostCard } from "../components/MobilePromptPostCard";
import { VirtualPromptList } from "../components/VirtualPromptList";
import { ViewModeSwitcher } from "../components/web/ViewModeSwitcher";
import { Pagination } from "../components/web/Pagination";

type Props = {
  prompts: Prompt[];
  loading?: boolean;
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
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
  prompts,
  loading = false,
  page,
  totalItems,
  pageSize,
  onPageChange,
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
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  function renderRecentPrompts() {
    if (loading && !prompts.length) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="mobile-post-card skeleton mobile-post-card-skeleton" />
          ))}
        </div>
      );
    }

    if (!prompts.length) {
      return (
        <div className="surface-card empty-state">
          <p className="text-base font-medium text-[var(--text)]">Пока нет промптов</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Создайте первый промпт кнопкой ниже.</p>
        </div>
      );
    }

    const list =
      viewMode === "list" ? (
        <VirtualPromptList
          prompts={prompts}
          variant="list"
          scrollSelector=".mobile-frame"
          estimateSize={128}
          onOpenPrompt={onOpenPrompt}
          onToggleFavorite={onToggleFavorite}
          onCopyPrompt={onCopyPrompt}
          onTagClick={onTagClick}
        />
      ) : (
        <MobilePromptFeed paginated>
          {prompts.map((prompt, index) => (
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

    if (loading) {
      return <div className="mini-list-loading">{list}</div>;
    }

    return list;
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

      <section className="home-recent-section">
        <div className="home-recent-header flex items-center justify-between gap-3">
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
        {totalItems > 0 ? (
          <Pagination
            variant="mini"
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={onPageChange}
          />
        ) : null}
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

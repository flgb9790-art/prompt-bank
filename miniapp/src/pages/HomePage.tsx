import { Plus } from "lucide-react";
import type { Prompt } from "../types";
import { MiniAppCardFeed } from "../components/MiniAppCardFeed";
import { Pagination } from "../components/web/Pagination";

type Props = {
  prompts: Prompt[];
  loading?: boolean;
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
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
  prompts,
  loading = false,
  page,
  totalItems,
  pageSize,
  onPageChange,
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
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

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
          {onViewAll ? (
            <button type="button" className="link-primary" onClick={onViewAll}>
              Все
            </button>
          ) : null}
        </div>
        <MiniAppCardFeed
          prompts={prompts}
          loading={loading}
          paginated
          emptyState={
            <div className="surface-card empty-state">
              <p className="text-base font-medium text-[var(--text)]">Пока нет промптов</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Создайте первый промпт кнопкой ниже.</p>
            </div>
          }
          onOpen={onOpenPrompt}
          onCopy={onCopyPrompt}
          onToggleFavorite={onToggleFavorite}
          onTagClick={onTagClick}
        />
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

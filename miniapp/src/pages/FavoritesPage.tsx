import type { Prompt } from "../types";
import { MiniAppPinterestFeed } from "../components/MiniAppPinterestFeed";
import { Pagination } from "../components/web/Pagination";

type Props = {
  prompts: Prompt[];
  loading?: boolean;
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onOpenPrompt: (prompt: Prompt) => void;
  onCopyPrompt: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onTagClick?: (tag: string) => void;
};

export function FavoritesPage({
  prompts,
  loading = false,
  page,
  totalItems,
  pageSize,
  onPageChange,
  onOpenPrompt,
  onCopyPrompt,
  onToggleFavorite,
  onTagClick
}: Props) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (!loading && !prompts.length) {
    return (
      <div className="surface-card empty-state mt-8">
        <h2 className="text-lg font-semibold text-[var(--text)]">Пока нет избранных промптов</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Нажмите ⭐ на карточке, чтобы сохранить лучшие промпты.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-[var(--text)]">Избранное</h2>

      <MiniAppPinterestFeed
        prompts={prompts}
        loading={loading}
        skeletonCount={4}
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
    </div>
  );
}

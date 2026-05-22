import type { Prompt } from "../types";
import { VirtualPromptList } from "../components/VirtualPromptList";

type Props = {
  prompts: Prompt[];
  loading?: boolean;
  onOpenPrompt: (prompt: Prompt) => void;
  onCopyPrompt: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onTagClick?: (tag: string) => void;
};

export function FavoritesPage({
  prompts,
  loading = false,
  onOpenPrompt,
  onCopyPrompt,
  onToggleFavorite,
  onTagClick
}: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="skeleton h-36" />
        ))}
      </div>
    );
  }

  if (!prompts.length) {
    return (
      <div className="surface-card empty-state mt-8">
        <h2 className="text-lg font-semibold text-[var(--text)]">Пока нет избранных промптов</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Нажмите ⭐ на карточке, чтобы сохранить лучшие промпты.</p>
      </div>
    );
  }

  return (
    <VirtualPromptList
      prompts={prompts}
      variant="mobile"
      scrollSelector=".mobile-frame"
      onOpenPrompt={onOpenPrompt}
      onToggleFavorite={onToggleFavorite}
      onCopyPrompt={onCopyPrompt}
      onTagClick={onTagClick}
    />
  );
}

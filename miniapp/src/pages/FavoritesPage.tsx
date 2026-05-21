import type { Prompt } from "../types";
import { PromptCard } from "../components/PromptCard";

type Props = {
  prompts: Prompt[];
  onOpenPrompt: (prompt: Prompt) => void;
  onCopyPrompt: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
};

export function FavoritesPage({ prompts, onOpenPrompt, onCopyPrompt, onToggleFavorite }: Props) {
  if (!prompts.length) {
    return (
      <div className="glass-card empty-state mt-8">
        <h2 className="text-lg font-semibold">Пока нет избранных промптов</h2>
        <p className="mt-2 text-sm text-muted">Нажмите ⭐ на карточке, чтобы сохранить лучшие промпты.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {prompts.map((prompt) => (
        <PromptCard key={prompt.id} prompt={prompt} onOpen={onOpenPrompt} onCopy={onCopyPrompt} onToggleFavorite={onToggleFavorite} />
      ))}
    </div>
  );
}

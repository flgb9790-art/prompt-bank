import { PromptCard } from "../PromptCard";
import type { Prompt } from "../../types";

type Props = {
  prompts: Prompt[];
  view: "grid" | "list";
  onOpenPrompt: (prompt: Prompt) => void;
  onCopyPrompt: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onTagClick?: (tag: string) => void;
};

export function PromptGrid({ prompts, view, onOpenPrompt, onCopyPrompt, onToggleFavorite, onTagClick }: Props) {
  if (!prompts.length) {
    return (
      <div className="surface-card empty-state mt-5">
        <p className="text-base font-medium text-[var(--text)]">Промпты не найдены</p>
        <p className="mt-1 text-sm text-[var(--muted)]">Измените фильтры или добавьте новый промпт.</p>
      </div>
    );
  }

  if (view === "list") {
    return (
      <div className="prompt-list mt-4 flex flex-col gap-3">
        {prompts.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            variant="mobile"
            onOpen={onOpenPrompt}
            onCopy={onCopyPrompt}
            onToggleFavorite={onToggleFavorite}
            onTagClick={onTagClick}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 hidden grid-cols-1 gap-5 md:grid lg:grid-cols-2 xl:grid-cols-3">
        {prompts.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            variant="desktop"
            onOpen={onOpenPrompt}
            onCopy={onCopyPrompt}
            onToggleFavorite={onToggleFavorite}
            onTagClick={onTagClick}
          />
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-3 md:hidden">
        {prompts.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            variant="mobile"
            onOpen={onOpenPrompt}
            onCopy={onCopyPrompt}
            onToggleFavorite={onToggleFavorite}
            onTagClick={onTagClick}
          />
        ))}
      </div>
    </>
  );
}

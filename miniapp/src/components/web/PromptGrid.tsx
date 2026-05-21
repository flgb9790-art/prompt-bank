import { PromptCard } from "../PromptCard";
import type { Prompt } from "../../types";

type Props = {
  prompts: Prompt[];
  view: "grid" | "list";
  onOpenPrompt: (prompt: Prompt) => void;
  onCopyPrompt: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
};

export function PromptGrid({ prompts, view, onOpenPrompt, onCopyPrompt, onToggleFavorite }: Props) {
  if (!prompts.length) {
    return (
      <div className="glass-card empty-state mt-5">
        <p className="text-base font-medium text-slate-100">Промпты не найдены</p>
        <p className="mt-1 text-sm text-muted">Измените фильтры или добавьте новый промпт.</p>
      </div>
    );
  }

  return (
    <div className={`mt-5 grid gap-5 ${view === "grid" ? "grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3" : "grid-cols-1"}`}>
      {prompts.map((prompt) => (
        <PromptCard key={prompt.id} prompt={prompt} onOpen={onOpenPrompt} onCopy={onCopyPrompt} onToggleFavorite={onToggleFavorite} />
      ))}
    </div>
  );
}

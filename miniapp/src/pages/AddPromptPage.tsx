import type { Category, PromptCreatePayload, TelegramUser } from "../types";
import { PromptForm } from "../components/PromptForm";

type Props = {
  categories: Category[];
  user: TelegramUser;
  onSave: (payload: PromptCreatePayload) => Promise<void>;
  onCancel: () => void;
  successPromptId?: number;
  onOpenPrompt: () => void;
  onAddMore: () => void;
  onGoHome: () => void;
};

export function AddPromptPage({
  categories,
  user,
  onSave,
  onCancel,
  successPromptId,
  onOpenPrompt,
  onAddMore,
  onGoHome
}: Props) {
  if (successPromptId) {
    return (
      <div className="glass-card space-y-3 p-4 text-center">
        <h2 className="text-xl font-semibold">Промпт сохранен ✅</h2>
        <div className="space-y-2">
          <button onClick={onOpenPrompt} className="w-full rounded-xl bg-primary px-4 py-3 text-sm">
            Открыть промпт
          </button>
          <button onClick={onAddMore} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            Добавить еще
          </button>
          <button onClick={onGoHome} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            На главную
          </button>
        </div>
      </div>
    );
  }

  return <PromptForm categories={categories} user={user} onSubmit={onSave} onCancel={onCancel} />;
}

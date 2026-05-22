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
      <div className="surface-card space-y-3 p-4 text-center">
        <h2 className="text-xl font-semibold text-[var(--text)]">Промпт сохранен ✅</h2>
        <div className="space-y-2">
          <button onClick={onOpenPrompt} className="btn-primary w-full justify-center">
            Открыть промпт
          </button>
          <button onClick={onAddMore} className="btn-secondary w-full">
            Добавить еще
          </button>
          <button onClick={onGoHome} className="btn-secondary w-full">
            На главную
          </button>
        </div>
      </div>
    );
  }

  return <PromptForm categories={categories} user={user} onSubmit={onSave} onCancel={onCancel} />;
}

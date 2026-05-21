import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { resolveMediaUrl } from "../api";
import type { Category, Prompt } from "../types";

type Props = {
  prompt?: Prompt;
  categories: Category[];
  canManage: boolean;
  desktopMode?: boolean;
  onClose: () => void;
  onCopy: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (promptId: number, data: { title: string; content: string; categoryId: number }) => Promise<void>;
};

export function PromptDetailsModal({
  prompt,
  categories,
  canManage,
  desktopMode = false,
  onClose,
  onCopy,
  onToggleFavorite,
  onDelete,
  onEdit
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!prompt) return;
    setTitle(prompt.title);
    setContent(prompt.content);
    setCategoryId(prompt.categoryId);
    setSaveError("");
    setIsEditing(false);
  }, [prompt]);

  if (!prompt) return null;

  return (
    <div className={`fixed inset-0 z-50 flex justify-center bg-black/70 p-4 backdrop-blur-[2px] ${desktopMode ? "items-center" : "items-end"}`}>
      <div className={`fade-up glass-card overflow-y-auto p-4 ${desktopMode ? "max-h-[90vh] w-full max-w-[860px]" : "max-h-[90vh] w-full max-w-[460px]"}`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Детали промпта</h3>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-muted">
            <X size={16} />
          </button>
        </div>
        {isEditing ? (
          <div className="space-y-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm"
              placeholder="Название"
            />
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(Number(event.target.value))}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={5}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm"
              placeholder="Текст промпта"
            />
            {saveError ? <p className="text-xs text-red-400">{saveError}</p> : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  setIsSaving(true);
                  setSaveError("");
                  try {
                    await onEdit(prompt.id, { title: title.trim(), content: content.trim(), categoryId });
                    setIsEditing(false);
                  } catch {
                    setSaveError("Не удалось сохранить изменения.");
                  } finally {
                    setIsSaving(false);
                  }
                }}
                className="rounded-xl bg-gradient-to-r from-primary to-primary-2 px-3 py-2 text-sm"
              >
                {isSaving ? "Сохраняем..." : "Сохранить"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setTitle(prompt.title);
                  setContent(prompt.content);
                  setCategoryId(prompt.categoryId);
                  setSaveError("");
                }}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className={`${desktopMode ? "grid gap-4 md:grid-cols-[340px_1fr]" : ""}`}>
            <div>
              {prompt.coverMediaUrl ? (
                prompt.coverMediaType === "video" ? (
                  <div className="mb-3 flex max-h-[420px] min-h-40 w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                    <video src={resolveMediaUrl(prompt.coverMediaUrl)} controls className="max-h-[420px] w-full object-contain" />
                  </div>
                ) : (
                  <div className="mb-3 flex max-h-[420px] min-h-40 w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                    <img src={resolveMediaUrl(prompt.coverMediaUrl)} alt={prompt.title} className="max-h-[420px] w-full object-contain" />
                  </div>
                )
              ) : null}

              <div className="mt-4">
                <h4 className="mb-2 text-sm font-semibold">Примеры</h4>
                <div className={`${desktopMode ? "grid grid-cols-2 gap-2" : "grid grid-cols-2 gap-2"}`}>
                  {prompt.examples.length ? (
                    prompt.examples.map((example) =>
                      example.type === "video" ? (
                        <div key={example.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/25 p-1">
                          <video src={resolveMediaUrl(example.url)} controls className="block max-h-64 w-full rounded-lg object-contain" />
                        </div>
                      ) : (
                        <div key={example.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/25 p-1">
                          <img src={resolveMediaUrl(example.url)} alt="example" className="block max-h-64 w-full rounded-lg object-contain" />
                        </div>
                      )
                    )
                  ) : (
                    <p className="col-span-2 text-xs text-muted">Примеры не добавлены.</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold">{prompt.title}</h2>
              <p className="mt-1 text-sm text-muted">{prompt.category.name}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {prompt.keywords.map((item) => (
                  <span key={item.keyword.id} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-indigo-100">
                    #{item.keyword.name}
                  </span>
                ))}
              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm text-slate-100">{prompt.content}</p>

              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => onCopy(prompt)} className="flex-1 rounded-xl bg-gradient-to-r from-primary to-primary-2 px-4 py-2 text-sm font-medium">
                  Скопировать
                </button>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(prompt.id)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm"
                >
                  В избранное
                </button>
              </div>

              {canManage ? (
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                  >
                    Редактировать
                  </button>
                  <button type="button" onClick={() => onDelete(prompt.id)} className="rounded-xl bg-red-500/20 px-3 py-2 text-sm text-red-300">
                    Удалить
                  </button>
                </div>
              ) : (
                <p className="mt-5 text-xs text-muted">Редактирование и удаление доступны только администратору.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { resolveMediaUrl } from "../api";
import type { Category, MediaType, Prompt } from "../types";
import { MediaUploader } from "./MediaUploader";

export type PromptEditPayload = {
  title: string;
  content: string;
  categoryId: number;
  coverMediaUrl?: string | null;
  coverMediaType?: MediaType | null;
  removedExampleIds: number[];
  newExamples: Array<{ url: string; type: MediaType; originalName?: string }>;
};

type Props = {
  prompt?: Prompt;
  categories: Category[];
  canManage: boolean;
  desktopMode?: boolean;
  onClose: () => void;
  onCopy: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (promptId: number, data: PromptEditPayload) => Promise<void>;
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
  const [coverMedia, setCoverMedia] = useState<{ url: string; type: MediaType } | null>(null);
  const [keptExampleIds, setKeptExampleIds] = useState<number[]>([]);
  const [newExamples, setNewExamples] = useState<Array<{ url: string; type: MediaType; originalName?: string }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  function resetEditState(current: Prompt) {
    setTitle(current.title);
    setContent(current.content);
    setCategoryId(current.categoryId);
    setCoverMedia(
      current.coverMediaUrl && current.coverMediaType
        ? { url: current.coverMediaUrl, type: current.coverMediaType }
        : null
    );
    setKeptExampleIds(current.examples.map((example) => example.id));
    setNewExamples([]);
    setSaveError("");
  }

  useEffect(() => {
    if (!prompt) return;
    resetEditState(prompt);
    setIsEditing(false);
  }, [prompt]);

  if (!prompt) return null;

  const visibleExamples = [
    ...prompt.examples.filter((example) => keptExampleIds.includes(example.id)),
    ...newExamples.map((example, index) => ({ ...example, id: -(index + 1) }))
  ];

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

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="mb-2 text-sm font-medium">Заставка / превью</p>
              {coverMedia ? (
                <div className="mb-2 flex max-h-48 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30 p-1">
                  {coverMedia.type === "video" ? (
                    <video src={resolveMediaUrl(coverMedia.url)} controls className="max-h-44 w-full object-contain" />
                  ) : (
                    <img src={resolveMediaUrl(coverMedia.url)} alt="cover" className="max-h-44 w-full object-contain" />
                  )}
                </div>
              ) : (
                <p className="mb-2 text-xs text-muted">Заставка не задана</p>
              )}
              <div className="flex flex-wrap gap-2">
                <MediaUploader
                  label="Заменить заставку"
                  onUploaded={(items) => {
                    if (items[0]) setCoverMedia(items[0]);
                  }}
                />
                {coverMedia ? (
                  <button
                    type="button"
                    onClick={() => setCoverMedia(null)}
                    className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
                  >
                    Удалить заставку
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="mb-2 text-sm font-medium">Примеры</p>
              <div className="grid grid-cols-2 gap-2">
                {visibleExamples.length ? (
                  visibleExamples.map((example) => (
                    <div key={example.id} className="relative overflow-hidden rounded-xl border border-white/10 bg-black/25 p-1">
                      {example.type === "video" ? (
                        <video src={resolveMediaUrl(example.url)} controls className="block max-h-40 w-full rounded-lg object-contain" />
                      ) : (
                        <img src={resolveMediaUrl(example.url)} alt="example" className="block max-h-40 w-full rounded-lg object-contain" />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (example.id > 0) {
                            setKeptExampleIds((prev) => prev.filter((id) => id !== example.id));
                          } else {
                            const index = -(example.id + 1);
                            setNewExamples((prev) => prev.filter((_, idx) => idx !== index));
                          }
                        }}
                        className="absolute right-2 top-2 rounded-lg bg-red-500/80 px-2 py-1 text-[10px] text-white"
                      >
                        Удалить
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="col-span-2 text-xs text-muted">Примеры не добавлены.</p>
                )}
              </div>
              <div className="mt-2">
                <MediaUploader
                  label="Добавить примеры"
                  multiple
                  onUploaded={(items) => setNewExamples((prev) => [...prev, ...items])}
                />
              </div>
            </div>

            {saveError ? <p className="text-xs text-red-400">{saveError}</p> : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  setIsSaving(true);
                  setSaveError("");
                  try {
                    const removedExampleIds = prompt.examples
                      .map((example) => example.id)
                      .filter((id) => !keptExampleIds.includes(id));

                    const coverChanged =
                      (prompt.coverMediaUrl ?? null) !== (coverMedia?.url ?? null) ||
                      (prompt.coverMediaType ?? null) !== (coverMedia?.type ?? null);

                    await onEdit(prompt.id, {
                      title: title.trim(),
                      content: content.trim(),
                      categoryId,
                      coverMediaUrl: coverChanged ? (coverMedia?.url ?? null) : undefined,
                      coverMediaType: coverChanged ? (coverMedia?.type ?? null) : undefined,
                      removedExampleIds,
                      newExamples
                    });
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
                  resetEditState(prompt);
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
                    onClick={() => {
                      resetEditState(prompt);
                      setIsEditing(true);
                    }}
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

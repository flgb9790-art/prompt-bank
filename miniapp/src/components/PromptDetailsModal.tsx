import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { resolveMediaUrl } from "../api";
import type { Category, MediaType, Prompt } from "../types";
import { getCategoryBadgeClass } from "../utils/categoryStyle";
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

function MediaPreview({ url, type, className }: { url: string; type: MediaType; className?: string }) {
  return (
    <div className={`preview-4x5 ${className ?? ""}`}>
      {type === "video" ? <video src={resolveMediaUrl(url)} controls /> : <img src={resolveMediaUrl(url)} alt="media" />}
    </div>
  );
}

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
    setKeptExampleIds((current.examples ?? []).map((example) => example.id));
    setNewExamples([]);
    setSaveError("");
  }

  useEffect(() => {
    if (!prompt) return;
    resetEditState(prompt);
    setIsEditing(false);
  }, [prompt]);

  if (!prompt) return null;

  const badgeClass = getCategoryBadgeClass(prompt.category.slug, prompt.category.name);
  const visibleExamples = [
    ...(prompt.examples ?? []).filter((example) => keptExampleIds.includes(example.id)),
    ...newExamples.map((example, index) => ({ ...example, id: -(index + 1) }))
  ];

  return (
    <div className={`modal-overlay fixed inset-0 z-50 flex justify-center p-4 ${desktopMode ? "items-center" : "items-end"}`}>
      <div
        className={`modal-panel fade-up max-h-[90vh] w-full overflow-y-auto p-5 ${desktopMode ? "max-w-[860px] rounded-[24px]" : "max-w-[460px]"}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--text)]">Детали промпта</h3>
          <button type="button" onClick={onClose} className="btn-ghost-icon h-9 w-9">
            <X size={16} />
          </button>
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="form-input" placeholder="Название" />
            <select value={categoryId} onChange={(event) => setCategoryId(Number(event.target.value))} className="form-select">
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <p className="text-sm font-semibold text-[var(--primary)]">Изображения и примеры</p>

            <div className="surface-card-soft p-3">
              <p className="mb-2 text-sm font-medium text-[var(--text)]">Заставка / превью</p>
              {coverMedia ? (
                <MediaPreview url={coverMedia.url} type={coverMedia.type} className="mb-2 max-w-[200px]" />
              ) : (
                <p className="mb-2 text-xs text-[var(--muted)]">Заставка не задана</p>
              )}
              <div className="flex flex-wrap gap-2">
                <MediaUploader label="Заменить заставку" onUploaded={(items) => items[0] && setCoverMedia(items[0])} />
                {coverMedia ? (
                  <button type="button" onClick={() => setCoverMedia(null)} className="btn-secondary text-[var(--red)]">
                    Удалить заставку
                  </button>
                ) : null}
              </div>
            </div>

            <div className="surface-card-soft p-3">
              <p className="mb-2 text-sm font-medium text-[var(--text)]">Примеры</p>
              <div className="grid grid-cols-2 gap-2">
                {visibleExamples.length ? (
                  visibleExamples.map((example) => (
                    <div key={example.id} className="relative">
                      <MediaPreview url={example.url} type={example.type} className="w-full" />
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
                        className="absolute right-2 top-2 rounded-lg bg-[var(--red)] px-2 py-1 text-[10px] text-white"
                      >
                        Удалить
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="col-span-2 text-xs text-[var(--muted)]">Примеры не добавлены.</p>
                )}
              </div>
              <div className="mt-2">
                <MediaUploader label="Добавить примеры" multiple onUploaded={(items) => setNewExamples((prev) => [...prev, ...items])} />
              </div>
            </div>

            <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={6} className="form-textarea" placeholder="Текст промпта" />
            {saveError ? <p className="text-xs text-[var(--red)]">{saveError}</p> : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  setIsSaving(true);
                  setSaveError("");
                  try {
                    const removedExampleIds = (prompt.examples ?? [])
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
                className="btn-primary justify-center"
              >
                {isSaving ? "Сохраняем..." : "Сохранить"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  resetEditState(prompt);
                }}
                className="btn-secondary"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className={desktopMode ? "grid gap-6 md:grid-cols-[300px_1fr]" : ""}>
            <div>
              {prompt.coverMediaUrl && prompt.coverMediaType ? (
                <MediaPreview url={prompt.coverMediaUrl} type={prompt.coverMediaType} className="mb-4 w-full max-w-[280px]" />
              ) : null}
              <h4 className="mb-2 text-sm font-semibold text-[var(--text)]">Примеры</h4>
              <div className="grid grid-cols-2 gap-2">
                {(prompt.examples ?? []).length ? (
                  (prompt.examples ?? []).map((example) => (
                    <MediaPreview key={example.id} url={example.url} type={example.type} className="w-full" />
                  ))
                ) : (
                  <p className="col-span-2 text-xs text-[var(--muted)]">Примеры не добавлены.</p>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[var(--text)]">{prompt.title}</h2>
              <span className={`category-badge mt-2 ${badgeClass}`}>{prompt.category.name}</span>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {prompt.keywords.map((item) => (
                  <span key={item.keyword.id} className="tag-pill bg-[var(--primary-soft)] text-[var(--primary)]">
                    #{item.keyword.name}
                  </span>
                ))}
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-soft)]">{prompt.content}</p>
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => onCopy(prompt)} className="btn-primary flex-1 justify-center">
                  Скопировать
                </button>
                <button type="button" onClick={() => onToggleFavorite(prompt.id)} className="btn-secondary flex-1">
                  В избранное
                </button>
              </div>
              {canManage ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetEditState(prompt);
                      setIsEditing(true);
                    }}
                    className="btn-secondary"
                  >
                    Редактировать (текст и фото)
                  </button>
                  <button type="button" onClick={() => onDelete(prompt.id)} className="btn-secondary text-[var(--red)]">
                    Удалить
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-xs text-[var(--muted)]">
                  Чтобы заменить битые изображения, войдите через Telegram под аккаунтом администратора, затем нажмите «Редактировать (текст и фото)».
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

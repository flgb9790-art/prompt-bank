import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Share2, X } from "lucide-react";
import { resolveMediaUrl } from "../api";
import type { Category, MediaType, Prompt } from "../types";
import { getCategoryBadgeClass } from "../utils/categoryStyle";
import { buildPromptShareUrl } from "../utils/promptShare";
import { MediaLightbox, type LightboxItem } from "./MediaLightbox";
import { MediaUploader } from "./MediaUploader";
import { TagPill } from "./TagPill";

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
  onShareLinkCopied?: () => void;
  onTagClick?: (tag: string) => void;
};

function MediaPreview({
  url,
  type,
  className,
  onClick
}: {
  url: string;
  type: MediaType;
  className?: string;
  onClick?: () => void;
}) {
  const clickable = Boolean(onClick);
  return (
    <button
      type="button"
      className={`preview-4x5 ${clickable ? "preview-clickable" : ""} ${className ?? ""}`}
      onClick={onClick}
      disabled={!clickable}
    >
      {type === "video" ? <video src={resolveMediaUrl(url)} muted playsInline /> : <img src={resolveMediaUrl(url)} alt="media" />}
      {clickable ? <span className="preview-clickable-hint">Открыть</span> : null}
    </button>
  );
}

function buildGalleryItems(prompt: Prompt): LightboxItem[] {
  const items: LightboxItem[] = [];
  if (prompt.coverMediaUrl && prompt.coverMediaType) {
    items.push({ url: prompt.coverMediaUrl, type: prompt.coverMediaType, label: "Заставка" });
  }
  (prompt.examples ?? []).forEach((example, index) => {
    items.push({ url: example.url, type: example.type, label: `Пример ${index + 1}` });
  });
  return items;
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
  onEdit,
  onShareLinkCopied,
  onTagClick
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
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [shareError, setShareError] = useState("");

  const galleryItems = useMemo(() => (prompt ? buildGalleryItems(prompt) : []), [prompt]);

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
    setGalleryIndex(0);
    setLightboxOpen(false);
    setShareError("");
  }, [prompt]);

  if (!prompt) return null;

  const badgeClass = getCategoryBadgeClass(prompt.category.slug, prompt.category.name);
  const visibleExamples = [
    ...(prompt.examples ?? []).filter((example) => keptExampleIds.includes(example.id)),
    ...newExamples.map((example, index) => ({ ...example, id: -(index + 1) }))
  ];
  const currentGallery = galleryItems[galleryIndex];
  const promptId = prompt.id;

  async function handleShareLink() {
    setShareError("");
    try {
      await navigator.clipboard.writeText(buildPromptShareUrl(promptId));
      onShareLinkCopied?.();
    } catch {
      setShareError("Не удалось скопировать ссылку.");
    }
  }

  return (
    <>
      <div className={`modal-overlay fixed inset-0 z-50 flex justify-center p-4 ${desktopMode ? "items-center" : "items-end"}`}>
        <div
          className={`modal-panel fade-up max-h-[90vh] w-full overflow-y-auto p-5 ${desktopMode ? "max-w-[860px] rounded-[24px]" : "max-w-[460px]"}`}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Детали промпта</h3>
            <div className="flex items-center gap-1">
              <button type="button" onClick={handleShareLink} className="btn-ghost-icon h-9 w-9" aria-label="Поделиться">
                <Share2 size={16} />
              </button>
              <button type="button" onClick={onClose} className="btn-ghost-icon h-9 w-9" aria-label="Закрыть">
                <X size={16} />
              </button>
            </div>
          </div>
          {shareError ? <p className="mb-3 text-xs text-[var(--red)]">{shareError}</p> : null}

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
                <div className="edit-media-toolbar">
                  <MediaUploader compact label="Заменить заставку" onUploaded={(items) => items[0] && setCoverMedia(items[0])} />
                  {coverMedia ? (
                    <button type="button" onClick={() => setCoverMedia(null)} className="btn-compact btn-compact-danger">
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
                          className="example-remove-btn"
                        >
                          Удалить
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="col-span-2 text-xs text-[var(--muted)]">Примеры не добавлены.</p>
                  )}
                </div>
                <div className="edit-media-toolbar mt-2">
                  <MediaUploader compact label="Добавить примеры" multiple onUploaded={(items) => setNewExamples((prev) => [...prev, ...items])} />
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
                {galleryItems.length ? (
                  <div className="prompt-gallery">
                    <div className="prompt-gallery-main">
                      {galleryItems.length > 1 ? (
                        <button
                          type="button"
                          className="prompt-gallery-nav"
                          onClick={() => setGalleryIndex((prev) => (prev > 0 ? prev - 1 : galleryItems.length - 1))}
                          aria-label="Предыдущее"
                        >
                          <ChevronLeft size={18} />
                        </button>
                      ) : null}
                      <MediaPreview
                        url={currentGallery.url}
                        type={currentGallery.type}
                        className="prompt-gallery-preview"
                        onClick={() => setLightboxOpen(true)}
                      />
                      {galleryItems.length > 1 ? (
                        <button
                          type="button"
                          className="prompt-gallery-nav"
                          onClick={() => setGalleryIndex((prev) => (prev < galleryItems.length - 1 ? prev + 1 : 0))}
                          aria-label="Следующее"
                        >
                          <ChevronRight size={18} />
                        </button>
                      ) : null}
                    </div>
                    {galleryItems.length > 1 ? (
                      <div className="prompt-gallery-thumbs">
                        {galleryItems.map((item, index) => (
                          <button
                            key={`${item.url}-${index}`}
                            type="button"
                            className={`prompt-gallery-thumb ${index === galleryIndex ? "active" : ""}`}
                            onClick={() => setGalleryIndex(index)}
                          >
                            {item.type === "video" ? (
                              <video src={resolveMediaUrl(item.url)} muted playsInline />
                            ) : (
                              <img src={resolveMediaUrl(item.url)} alt="" />
                            )}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted)]">Изображения не добавлены.</p>
                )}
              </div>

              <div>
                <h2 className="text-xl font-semibold text-[var(--text)]">{prompt.title}</h2>
                <span className={`category-badge mt-2 ${badgeClass}`}>{prompt.category.name}</span>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {prompt.keywords.map((item) => (
                    <TagPill key={item.keyword.id} name={item.keyword.name} variant="accent" onClick={onTagClick} />
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

      {lightboxOpen && galleryItems.length ? (
        <MediaLightbox items={galleryItems} initialIndex={galleryIndex} onClose={() => setLightboxOpen(false)} />
      ) : null}
    </>
  );
}

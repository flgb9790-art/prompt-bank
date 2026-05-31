import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Share2, X } from "lucide-react";
import { resolveCardMediaUrl, resolveMediaUrl } from "../api";
import { useHorizontalSwipe } from "../hooks/useHorizontalSwipe";
import { useMediaMinWidth } from "../hooks/useMediaMinWidth";
import { isTelegramMiniAppContext } from "../telegram";
import { lockTelegramViewport, setTelegramPagePinchBlocked } from "../utils/telegramViewport";
import { MediaLightbox } from "./MediaLightbox";
import type { Category, MediaType, Prompt } from "../types";
import { getCategoryBadgeClass } from "../utils/categoryStyle";
import { hasFullPromptDetails } from "../utils/promptContent";
import { buildPromptShareUrl } from "../utils/promptShare";
import { telegramPublicationStatusLabel } from "../utils/telegramPost";
import { pinterestPublicationStatusLabel } from "../utils/pinterestPost";
import type { LightboxItem } from "./MediaLightbox";

import { TagPill } from "./TagPill";
import {
  PromptMediaGalleryEditor,
  buildPromptMediaItemsFromPrompt,
  diffPromptMediaOnEdit
} from "./PromptMediaGalleryEditor";
import {
  PublicationTemplatesEditor,
  publicationTemplatesFromPrompt,
  templatesPayloadForApi
} from "./PublicationTemplatesEditor";
import { loadStoredPublicationTemplates } from "../utils/publicationTemplatesStorage";
import { PromptContentText } from "./PromptContentText";
import { PromptContentTextarea } from "./PromptContentTextarea";
import { normalizePromptContent } from "../utils/promptContentFormat";

export type PromptEditPayload = {
  content: string;
  categoryId: number;
  coverMediaUrl?: string | null;
  coverMediaType?: MediaType | null;
  removedExampleIds: number[];
  newExamples: Array<{ url: string; type: MediaType; originalName?: string }>;
  telegramPostTemplate?: string | null;
  pinterestTitleTemplate?: string | null;
  pinterestDescriptionTemplate?: string | null;
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
  onPublishTelegram?: (promptId: number) => Promise<void>;
  onPublishPinterest?: (promptId: number) => Promise<void>;
  onShareLinkCopied?: () => void;
  onTagClick?: (tag: string) => void;
  showPublicationTemplates?: boolean;
};

const galleryMediaStyle = {
  width: "100%",
  height: "auto",
  display: "block",
  maxHeight: "min(68vh, 560px)",
  objectFit: "contain" as const,
  objectPosition: "center" as const
};

function MediaPreview({
  url,
  type,
  className,
  onClick,
  fit = "cover",
  framed = true,
  fillWidth = false
}: {
  url: string;
  type: MediaType;
  className?: string;
  onClick?: () => void;
  fit?: "cover" | "contain";
  framed?: boolean;
  fillWidth?: boolean;
}) {
  const clickable = Boolean(onClick);
  const fitClass = fillWidth ? "" : fit === "contain" ? "preview-fit-contain" : "";
  const frameClass = fillWidth ? "preview-media-fill" : framed ? "preview-4x5" : "preview-unframed";
  return (
    <button
      type="button"
      className={`${frameClass} ${fitClass} ${clickable ? "preview-clickable" : ""} ${className ?? ""}`}
      onClick={onClick}
      disabled={!clickable}
    >
      {type === "video" ? (
        <video
          src={resolveMediaUrl(url)}
          muted
          playsInline
          preload="metadata"
          style={fillWidth ? galleryMediaStyle : undefined}
        />
      ) : (
        <img
          src={resolveMediaUrl(url)}
          alt="media"
          loading={fillWidth ? "lazy" : "eager"}
          decoding="async"
          fetchPriority={fillWidth ? "auto" : "high"}
          style={fillWidth ? galleryMediaStyle : undefined}
        />
      )}
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

function PromptDetailsLoadingPanel({ wideLayout }: { wideLayout: boolean }) {
  return (
    <div
      className={`prompt-details-loading ${wideLayout ? "prompt-details-loading--desktop" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="prompt-details-loading-head">
        <span className="prompt-details-loading-spinner" aria-hidden />
        <span>Загрузка промпта…</span>
      </div>
      <div className={wideLayout ? "prompt-details-layout prompt-details-layout--desktop" : "flex flex-col gap-4"}>
        <div className="prompt-details-skeleton-gallery" aria-hidden />
        <div className="space-y-3" aria-hidden>
          <div className="prompt-details-skeleton-line prompt-details-skeleton-line--wide" />
          <div className="prompt-details-skeleton-line" />
          <div className="prompt-details-skeleton-line" />
          <div className="prompt-details-skeleton-line prompt-details-skeleton-line--short" />
        </div>
      </div>
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
  onEdit,
  onPublishTelegram,
  onPublishPinterest,
  onShareLinkCopied,
  onTagClick,
  showPublicationTemplates = false
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState<number>(0);
  const [mediaItems, setMediaItems] = useState<Array<{ url: string; type: MediaType; exampleId?: number }>>([]);
  const [publicationTemplates, setPublicationTemplates] = useState({
    telegramPostTemplate: "",
    pinterestTitleTemplate: "",
    pinterestDescriptionTemplate: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [shareError, setShareError] = useState("");
  const [telegramPublishing, setTelegramPublishing] = useState(false);
  const [pinterestPublishing, setPinterestPublishing] = useState(false);

  const galleryItems = useMemo(() => (prompt ? buildGalleryItems(prompt) : []), [prompt]);

  useEffect(() => {
    if (!galleryItems.length) {
      setGalleryIndex(0);
      setLightboxOpen(false);
      return;
    }
    if (galleryIndex >= galleryItems.length) {
      setGalleryIndex(0);
    }
  }, [galleryItems.length, galleryIndex]);
  const isTelegramMiniApp = isTelegramMiniAppContext();
  const webModal = desktopMode && !isTelegramMiniApp;
  const wideLayout = useMediaMinWidth(1024, webModal);
  const fullscreenLayout = webModal && wideLayout;
  const compactGallery = isTelegramMiniApp || !wideLayout;
  const fitGalleryFrame = webModal;
  const showGalleryNav = !compactGallery && galleryItems.length > 1;

  const goGalleryPrev = useCallback(() => {
    setGalleryIndex((prev) => (prev > 0 ? prev - 1 : galleryItems.length - 1));
  }, [galleryItems.length]);

  const goGalleryNext = useCallback(() => {
    setGalleryIndex((prev) => (prev < galleryItems.length - 1 ? prev + 1 : 0));
  }, [galleryItems.length]);

  const gallerySwipe = useHorizontalSwipe(goGalleryNext, goGalleryPrev, compactGallery && galleryItems.length > 1);

  function resetEditState(current: Prompt) {
    setContent(current.content ?? current.contentExcerpt ?? "");
    setCategoryId(current.categoryId);
    setMediaItems(buildPromptMediaItemsFromPrompt(current));
    setPublicationTemplates(publicationTemplatesFromPrompt(current, loadStoredPublicationTemplates()));
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

  useEffect(() => {
    if (!isTelegramMiniApp || !prompt) return;
    lockTelegramViewport();
    setTelegramPagePinchBlocked(!lightboxOpen);
    return () => setTelegramPagePinchBlocked(false);
  }, [isTelegramMiniApp, prompt, lightboxOpen]);

  if (!prompt) return null;

  const loadingDetails = !hasFullPromptDetails(prompt);
  const isShellPrompt = loadingDetails && prompt.category.slug === "loading";
  const badgeClass = getCategoryBadgeClass(prompt.category.slug, prompt.category.name);
  const safeGalleryIndex = galleryItems.length ? Math.min(galleryIndex, galleryItems.length - 1) : 0;
  const currentGallery = galleryItems[safeGalleryIndex];
  const editCategory = categories.find((category) => category.id === categoryId);
  const editTagNames = prompt.keywords.map((item) => item.keyword.name);
  const promptId = prompt.id;
  const promptBody = prompt.content ?? "";

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
      <div
        className={`modal-overlay fixed inset-0 z-[100] flex justify-center p-4 ${
          fullscreenLayout ? "modal-overlay--prompt-fullscreen items-stretch" : wideLayout ? "items-center" : "items-end"
        }${webModal && !wideLayout ? " modal-overlay--prompt-web-mobile" : ""}${lightboxOpen ? " modal-overlay--behind-lightbox" : ""}`}
        aria-hidden={lightboxOpen}
      >
        <div
          className={`modal-panel fade-up p-5 ${
            fullscreenLayout
              ? "modal-panel--prompt-fullscreen"
              : webModal
                ? "modal-panel--prompt-web-mobile max-h-[92vh] overflow-y-auto"
                : "modal-panel--prompt-mobile max-h-[92vh] overflow-y-auto"
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="prompt-details-modal-header mb-4 flex shrink-0 items-center justify-between gap-3">
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
          {shareError ? <p className="mb-3 shrink-0 text-xs text-[var(--red)]">{shareError}</p> : null}

          <div className={fullscreenLayout ? "prompt-details-modal-body min-h-0 flex-1 overflow-y-auto" : undefined}>
          {isEditing ? (
            <div className="space-y-3">
              <select value={categoryId} onChange={(event) => setCategoryId(Number(event.target.value))} className="form-select">
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <PromptMediaGalleryEditor items={mediaItems} onChange={setMediaItems} />

              {showPublicationTemplates ? (
                <div className="surface-card-soft space-y-3 p-3">
                  <PublicationTemplatesEditor
                    content={content}
                    categoryName={editCategory?.name ?? prompt.category.name}
                    tagNames={editTagNames}
                    value={publicationTemplates}
                    onChange={setPublicationTemplates}
                  />
                </div>
              ) : null}

              <PromptContentTextarea value={content} onChange={setContent} rows={10} />
              {saveError ? <p className="text-xs text-[var(--red)]">{saveError}</p> : null}
              <div className="action-button-row">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={async () => {
                    setIsSaving(true);
                    setSaveError("");
                    try {
                      const mediaDiff = diffPromptMediaOnEdit(prompt.examples ?? [], mediaItems);
                      const coverChanged =
                        (prompt.coverMediaUrl ?? null) !== mediaDiff.coverMediaUrl ||
                        (prompt.coverMediaType ?? null) !== mediaDiff.coverMediaType;
                      await onEdit(prompt.id, {
                        content: content.trim(),
                        categoryId,
                        coverMediaUrl: coverChanged ? mediaDiff.coverMediaUrl : undefined,
                        coverMediaType: coverChanged ? mediaDiff.coverMediaType : undefined,
                        removedExampleIds: mediaDiff.removedExampleIds,
                        newExamples: mediaDiff.newExamples,
                        ...(showPublicationTemplates ? templatesPayloadForApi(publicationTemplates) : {})
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
          ) : isShellPrompt ? (
            <PromptDetailsLoadingPanel wideLayout={wideLayout} />
          ) : (
            <div className={wideLayout ? "prompt-details-layout prompt-details-layout--desktop" : "flex flex-col gap-4"}>
              <div>
                {loadingDetails && !galleryItems.length ? (
                  <div className="prompt-details-skeleton-gallery" aria-hidden />
                ) : galleryItems.length ? (
                  <div className={`prompt-gallery ${compactGallery ? "prompt-gallery--mobile" : "prompt-gallery--desktop"}`}>
                    <div
                      className="prompt-gallery-main"
                      onTouchStart={gallerySwipe.onTouchStart}
                      onTouchEnd={gallerySwipe.onTouchEnd}
                    >
                      {showGalleryNav ? (
                        <button type="button" className="prompt-gallery-nav" onClick={goGalleryPrev} aria-label="Предыдущее">
                          <ChevronLeft size={18} />
                        </button>
                      ) : null}
                      {currentGallery ? (
                        <MediaPreview
                          url={currentGallery.url}
                          type={currentGallery.type}
                          framed={false}
                          fit={fitGalleryFrame ? undefined : "contain"}
                          className={`prompt-gallery-preview${fitGalleryFrame ? " prompt-gallery-preview--fit" : ""}`}
                          onClick={() => setLightboxOpen(true)}
                        />
                      ) : null}
                      {showGalleryNav ? (
                        <button type="button" className="prompt-gallery-nav" onClick={goGalleryNext} aria-label="Следующее">
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
                            className={`prompt-gallery-thumb ${index === safeGalleryIndex ? "active" : ""}`}
                            onClick={() => setGalleryIndex(index)}
                          >
                            {item.type === "video" ? (
                              <video src={resolveMediaUrl(item.url)} muted playsInline />
                            ) : (
                              <img
                                src={resolveCardMediaUrl(item.url, "image")}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                onError={(event) => {
                                  const fallback = resolveMediaUrl(item.url);
                                  if (event.currentTarget.src !== fallback) {
                                    event.currentTarget.src = fallback;
                                  }
                                }}
                              />
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

              <div className={webModal ? "prompt-details-meta" : undefined}>
                <span className={`category-badge ${badgeClass}`}>{prompt.category.name}</span>
                <div className={`mt-3 flex flex-wrap gap-1.5${webModal ? " prompt-details-tags" : ""}`}>
                  {prompt.keywords.map((item) => (
                    <TagPill
                      key={item.keyword.id}
                      name={item.keyword.name}
                      variant="accent"
                      onClick={
                        onTagClick
                          ? (name) => {
                              onClose();
                              onTagClick(name);
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>
                {loadingDetails ? (
                  <div className="mt-4 space-y-3" role="status" aria-live="polite">
                    <div className="prompt-details-loading-head">
                      <span className="prompt-details-loading-spinner" aria-hidden />
                      <span>Загрузка текста и примеров…</span>
                    </div>
                    <div className="space-y-2" aria-hidden>
                      <div className="prompt-details-skeleton-line prompt-details-skeleton-line--wide" />
                      <div className="prompt-details-skeleton-line" />
                      <div className="prompt-details-skeleton-line" />
                      <div className="prompt-details-skeleton-line prompt-details-skeleton-line--short" />
                    </div>
                  </div>
                ) : (
                  <PromptContentText
                    content={promptBody}
                    className={`${webModal ? "mt-3" : "mt-4"} text-sm leading-relaxed text-[var(--text-soft)]`}
                  />
                )}
                <div className={webModal ? "prompt-details-actions" : "action-button-row mt-5"}>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void onCopy(prompt);
                    }}
                    className={
                      webModal
                        ? `prompt-detail-action-btn prompt-detail-action-btn--primary${loadingDetails ? " is-loading" : ""}`
                        : "btn-primary justify-center"
                    }
                  >
                    Скопировать
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleFavorite(prompt.id);
                    }}
                    className={
                      webModal
                        ? `prompt-detail-action-btn${prompt.isFavorite ? " prompt-detail-action-btn--favorite" : ""}`
                        : `btn-secondary justify-center${prompt.isFavorite ? " btn-secondary--favorite" : ""}`
                    }
                    aria-pressed={prompt.isFavorite}
                  >
                    {prompt.isFavorite ? "В избранном" : "В избранное"}
                  </button>
                  {canManage && webModal ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          resetEditState(prompt);
                          setIsEditing(true);
                        }}
                        className="prompt-detail-action-btn"
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(prompt.id)}
                        className="prompt-detail-action-btn prompt-detail-action-btn--danger"
                      >
                        Удалить
                      </button>
                    </>
                  ) : null}
                </div>
                {canManage ? (
                  <div
                    className={
                      webModal ? "prompt-publish-panels prompt-publish-panels--row" : "prompt-publish-panels mt-4 space-y-3"
                    }
                  >
                    <div className="surface-card-soft p-3">
                      <p className="text-sm font-medium text-[var(--text)]">
                        {telegramPublicationStatusLabel(
                          telegramPublishing ? "pending" : prompt.telegramPublication?.status
                        )}
                      </p>
                      {prompt.telegramPublication?.status === "failed" && prompt.telegramPublication.error ? (
                        <p className="mt-2 text-xs text-[var(--red)]" title={prompt.telegramPublication.error}>
                          {prompt.telegramPublication.error}
                        </p>
                      ) : null}
                      {prompt.telegramPublication?.status === "published" && !telegramPublishing ? (
                        <p className="mt-2 text-xs text-[var(--muted)]">Опубликовано в Telegram ✅</p>
                      ) : onPublishTelegram ? (
                        <button
                          type="button"
                          disabled={telegramPublishing}
                          onClick={(event) => {
                            event.stopPropagation();
                            void (async () => {
                              setTelegramPublishing(true);
                              try {
                                await onPublishTelegram(prompt.id);
                              } finally {
                                setTelegramPublishing(false);
                              }
                            })();
                          }}
                          className="btn-secondary mt-3 w-full justify-center"
                        >
                          {telegramPublishing
                            ? "Публикуем..."
                            : prompt.telegramPublication?.status === "failed" ||
                                prompt.telegramPublication?.status === "pending"
                              ? "Повторить публикацию"
                              : "Опубликовать в Telegram"}
                        </button>
                      ) : null}
                    </div>
                    <div className="surface-card-soft p-3">
                      <p className="text-sm font-medium text-[var(--text)]">
                        {pinterestPublicationStatusLabel(
                          pinterestPublishing ? "pending" : prompt.pinterestPublication?.status
                        )}
                      </p>
                      {prompt.pinterestPublication?.status === "failed" && prompt.pinterestPublication.error ? (
                        <p className="mt-2 text-xs text-[var(--red)]" title={prompt.pinterestPublication.error}>
                          {prompt.pinterestPublication.error}
                        </p>
                      ) : null}
                      {prompt.pinterestPublication?.status === "published" && prompt.pinterestPublication.publishedUrl ? (
                        <a
                          href={prompt.pinterestPublication.publishedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary mt-3 inline-flex w-full justify-center"
                        >
                          Открыть Pin
                        </a>
                      ) : onPublishPinterest ? (
                        <button
                          type="button"
                          disabled={pinterestPublishing}
                          onClick={(event) => {
                            event.stopPropagation();
                            void (async () => {
                              setPinterestPublishing(true);
                              try {
                                await onPublishPinterest(prompt.id);
                              } finally {
                                setPinterestPublishing(false);
                              }
                            })();
                          }}
                          className="btn-secondary mt-3 w-full justify-center"
                        >
                          {pinterestPublishing
                            ? "Публикуем..."
                            : prompt.pinterestPublication?.status === "failed"
                              ? "Повторить публикацию"
                              : "Опубликовать в Pinterest"}
                        </button>
                      ) : null}
                    </div>
                    {!webModal ? (
                      <div className="action-button-row">
                        <button
                          type="button"
                          onClick={() => {
                            resetEditState(prompt);
                            setIsEditing(true);
                          }}
                          className="btn-secondary"
                        >
                          Редактировать
                        </button>
                        <button type="button" onClick={() => onDelete(prompt.id)} className="btn-secondary text-[var(--red)]">
                          Удалить
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {lightboxOpen && galleryItems.length && currentGallery ? (
        <MediaLightbox
          key={`${promptId}-${safeGalleryIndex}`}
          items={galleryItems}
          initialIndex={safeGalleryIndex}
          isTelegramMiniApp={isTelegramMiniApp}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </>
  );
}

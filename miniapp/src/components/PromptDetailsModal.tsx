import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowDown, ChevronLeft, ChevronRight, Copy, Maximize2, Share2, Star, X } from "lucide-react";
import { useDialogFocus } from "../hooks/useDialogFocus";
import { getPromptLabel } from "../utils/promptTitle";
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
import { buildPinterestPinUrl, pinterestPublicationStatusLabel } from "../utils/pinterestPost";
import { isValidPinterestLink } from "../utils/pinterestPublish";
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
import { usePromptFavorite } from "../context/FavoriteIdsContext";

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
  onSaveTelegramPostLink?: (promptId: number, link: string) => Promise<void>;
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
      aria-label={type === "video" ? "Открыть видео" : "Увеличить изображение"}
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
          src={resolveCardMediaUrl(url, "image")}
          alt="Пример результата промпта"
          loading={fillWidth ? "lazy" : "eager"}
          decoding="async"
          fetchPriority={fillWidth ? "auto" : "high"}
          style={fillWidth ? galleryMediaStyle : undefined}
          onError={(event) => {
            if (!event.currentTarget.dataset.fallback) {
              event.currentTarget.dataset.fallback = "true";
              event.currentTarget.src = resolveMediaUrl(url);
            }
          }}
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
  onSaveTelegramPostLink,
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, Boolean(prompt), onClose, lightboxOpen);
  const [shareError, setShareError] = useState("");
  const [telegramPublishing, setTelegramPublishing] = useState(false);
  const [pinterestPublishing, setPinterestPublishing] = useState(false);
  const [telegramPostLink, setTelegramPostLink] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkError, setLinkError] = useState("");
  useEffect(() => {
    setTelegramPostLink(prompt?.telegramPostUrl ?? "");
    setLinkError("");
  }, [prompt?.id, prompt?.telegramPostUrl]);
  const pinterestPinUrl = buildPinterestPinUrl(prompt?.pinterestPublication?.pinterestPinId);

  const galleryItems = useMemo(() => (prompt ? buildGalleryItems(prompt) : []), [prompt]);
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const isFavorite = usePromptFavorite(
    prompt ? { id: prompt.id, isFavorite: prompt.isFavorite } : { id: 0, isFavorite: false }
  );

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

  useEffect(() => {
    const rail = thumbnailsRef.current;
    const thumbnail = rail?.children[galleryIndex] as HTMLElement | undefined;
    if (!rail || !thumbnail) return;
    const offset = thumbnail.getBoundingClientRect().left - rail.getBoundingClientRect().left;
    if (offset < 0) rail.scrollLeft += offset - 3;
    else if (offset + thumbnail.offsetWidth > rail.clientWidth) {
      rail.scrollLeft += offset + thumbnail.offsetWidth - rail.clientWidth + 3;
    }
  }, [galleryIndex, galleryItems.length]);
  const isTelegramMiniApp = isTelegramMiniAppContext();
  const webModal = desktopMode && !isTelegramMiniApp;
  const wideLayout = useMediaMinWidth(1024, webModal);
  const fullscreenLayout = webModal && wideLayout;
  const compactGallery = isTelegramMiniApp || !wideLayout;
  const showGalleryNav = galleryItems.length > 1;

  const goGalleryPrev = useCallback(() => {
    setGalleryIndex((prev) => (prev > 0 ? prev - 1 : galleryItems.length - 1));
  }, [galleryItems.length]);

  const goGalleryNext = useCallback(() => {
    setGalleryIndex((prev) => (prev < galleryItems.length - 1 ? prev + 1 : 0));
  }, [galleryItems.length]);

  const gallerySwipe = useHorizontalSwipe(goGalleryNext, goGalleryPrev, galleryItems.length > 1);

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
        className={`modal-overlay reader-overlay fixed inset-0 z-[100] flex justify-center p-4 ${
          fullscreenLayout ? "modal-overlay--prompt-fullscreen items-stretch" : wideLayout ? "items-center" : "items-end"
        }${webModal && !wideLayout ? " modal-overlay--prompt-web-mobile" : ""}${lightboxOpen ? " modal-overlay--behind-lightbox" : ""}`}
        aria-hidden={lightboxOpen}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="prompt-dialog-title"
          tabIndex={-1}
          className={`modal-panel prompt-reader fade-up p-5 ${
            fullscreenLayout
              ? "modal-panel--prompt-fullscreen"
              : webModal
                ? "modal-panel--prompt-web-mobile max-h-[92vh] overflow-y-auto"
                : "modal-panel--prompt-mobile max-h-[92vh] overflow-y-auto"
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="reader-header">
            <button type="button" className="reader-back" onClick={onClose} aria-label="Вернуться к списку промптов">
              <ArrowLeft size={18} /><span>К списку</span>
            </button>
            <h2 id="prompt-dialog-title" className="sr-only">{isEditing ? "Редактирование промпта" : getPromptLabel(prompt)}</h2>
            <div className="reader-header-actions">
              {!isEditing ? <>
                <button type="button" disabled={loadingDetails} className="btn-primary reader-copy" onClick={() => onCopy(prompt)}><Copy size={15} /><span>Копировать</span></button>
                <button type="button" className={`btn-ghost-icon reader-favorite${isFavorite ? " is-active" : ""}`} onClick={() => onToggleFavorite(prompt.id)} aria-label={isFavorite ? "Убрать из избранного" : "В избранное"} aria-pressed={isFavorite}>
                  <Star size={17} fill={isFavorite ? "currentColor" : "none"} />
                </button>
              </> : null}
              <button type="button" onClick={handleShareLink} className="btn-ghost-icon" aria-label="Скопировать ссылку на промпт">
                <Share2 size={16} />
              </button>
              <button type="button" onClick={onClose} className="btn-ghost-icon reader-close" aria-label="Закрыть">
                <X size={16} />
              </button>
            </div>
          </div>
          {shareError ? <p role="alert" className="reader-share-error">{shareError}</p> : null}

          <div className="reader-body">
          {isEditing ? (
            <div className="reader-edit space-y-3">
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
            <div className={`reader-layout${wideLayout ? " reader-layout--wide" : ""}`}>
              <div className="reader-visual">
                {loadingDetails && !galleryItems.length ? (
                  <div className="prompt-details-skeleton-gallery" aria-hidden />
                ) : galleryItems.length ? (
                  <div className="reader-gallery" role="region" aria-label="Примеры результата"
                    onKeyDown={(event) => {
                      if (lightboxOpen || !showGalleryNav || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
                      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                        event.preventDefault();
                        if (event.key === "ArrowLeft") goGalleryPrev();
                        else goGalleryNext();
                      }
                    }}>
                    <div className="reader-section-heading">
                      <span>Результат</span>
                      <span className="reader-gallery-counter" aria-live="polite" aria-atomic="true">{safeGalleryIndex + 1} / {galleryItems.length}</span>
                    </div>
                    <div
                      className="reader-gallery-stage"
                      onTouchStart={gallerySwipe.onTouchStart}
                      onTouchEnd={gallerySwipe.onTouchEnd}
                    >
                      {showGalleryNav ? (
                        <button type="button" className="reader-gallery-arrow reader-gallery-arrow--prev" onClick={goGalleryPrev} aria-label="Предыдущее изображение">
                          <ChevronLeft size={18} />
                        </button>
                      ) : null}
                      {currentGallery ? (
                        <MediaPreview
                          key={currentGallery.url}
                          url={currentGallery.url}
                          type={currentGallery.type}
                          framed={false}
                          fit="contain"
                          className="reader-media"
                          onClick={() => setLightboxOpen(true)}
                        />
                      ) : null}
                      {showGalleryNav ? (
                        <button type="button" className="reader-gallery-arrow reader-gallery-arrow--next" onClick={goGalleryNext} aria-label="Следующее изображение">
                          <ChevronRight size={18} />
                        </button>
                      ) : null}
                      <span className="reader-zoom-hint" aria-hidden="true"><Maximize2 size={14} />Увеличить</span>
                    </div>
                    {galleryItems.length > 1 ? (
                      <div ref={thumbnailsRef} className="reader-thumbnails" aria-label="Выбор примера">
                        {galleryItems.map((item, index) => (
                          <button
                            key={`${item.url}-${index}`}
                            type="button"
                            className={`reader-thumbnail ${index === safeGalleryIndex ? "is-active" : ""}`}
                            aria-label={`Показать пример ${index + 1}`}
                            aria-pressed={index === safeGalleryIndex}
                            onClick={() => setGalleryIndex(index)}
                          >
                            {item.type === "video" ? (
                              <video src={resolveMediaUrl(item.url)} muted playsInline preload="none" />
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
                    {compactGallery ? <button type="button" className="reader-jump" onClick={() => textRef.current?.scrollIntoView({ behavior: "auto", block: "start" })}>К тексту промпта <ArrowDown size={14} /></button> : null}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted)]">Изображения не добавлены.</p>
                )}
              </div>

              <div ref={textRef} className="prompt-reading-panel reader-content">
                <span className={`category-badge ${badgeClass}`}>{prompt.category.name}</span>
                <h3 className="prompt-reading-title">{getPromptLabel(prompt)}</h3>
                <section className="reader-text-card" aria-label="Текст промпта">
                <div className="reader-section-heading reader-text-heading"><span>Текст промпта</span>
                  {!loadingDetails ? <span>{normalizePromptContent(promptBody).length.toLocaleString("ru-RU")} знаков</span> : null}
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
                    className="reader-prompt-text"
                  />
                )}
                </section>
                {prompt.keywords.length ? <details className="prompt-tag-disclosure reader-tags"><summary>Теги · {prompt.keywords.length}</summary>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {prompt.keywords.map((item) => (
                      <TagPill key={item.keyword.id} name={item.keyword.name} variant="accent"
                        onClick={onTagClick ? (name) => { onClose(); onTagClick(name); } : undefined} />
                    ))}
                  </div>
                </details> : null}
                {canManage ? (
                    <div className="reader-admin-actions">
                      <button
                        type="button"
                        onClick={() => {
                          resetEditState(prompt);
                          setIsEditing(true);
                        }}
                        className="btn-secondary"
                        disabled={loadingDetails}
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(prompt.id)}
                        className="btn-secondary text-[var(--red)]"
                      >
                        Удалить
                      </button>
                    </div>
                  ) : null}
                {canManage ? (
                  <div
                    className={
                      webModal ? "prompt-publish-panels prompt-publish-panels--row" : "prompt-publish-panels mt-4 space-y-3"
                    }
                  >
                    <div className="surface-card-soft p-3">
                      <p className="text-sm font-medium text-[var(--text)]">
                        {telegramPublicationStatusLabel(
                          telegramPublishing ? "pending" : prompt.telegramPostUrl || prompt.telegramPublished ? "published" : prompt.telegramPublication?.status
                        )}
                      </p>
                      {!prompt.telegramPostUrl && prompt.telegramPublication?.status === "failed" && prompt.telegramPublication.error ? (
                        <p className="mt-2 text-xs text-[var(--red)]" title={prompt.telegramPublication.error}>
                          {prompt.telegramPublication.error}
                        </p>
                      ) : null}
                      {(prompt.telegramPostUrl || prompt.telegramPublished || prompt.telegramPublication?.status === "published") && !telegramPublishing ? (
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
                              } catch (error) {
                                setLinkError(error instanceof Error ? error.message : "Публикация Telegram не удалась");
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
                      <label className="block text-sm font-medium" htmlFor="telegram-post-destination">Ссылка на Telegram-пост</label>
                      <input id="telegram-post-destination" type="url" className="form-input mt-2 w-full"
                        placeholder="https://t.me/channel/123" value={telegramPostLink}
                        disabled={linkSaving || pinterestPublishing}
                        onChange={(event) => setTelegramPostLink(event.target.value)} />
                      <p className="mt-2 break-all text-xs text-[var(--muted)]">
                        Назначение нового пина: {prompt.telegramPostUrl || "не указано"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">Укажите пост с текстом промпта. Сохранение ссылки не отправляет материал в канал. Ссылки /c/ доступны участникам канала.</p>
                      {onSaveTelegramPostLink ? <button type="button" className="btn-secondary mt-2"
                        disabled={linkSaving || pinterestPublishing || telegramPostLink.trim() === prompt.telegramPostUrl}
                        onClick={() => {
                          if (!isValidPinterestLink(telegramPostLink)) {
                            setLinkError("Укажите конкретный Telegram-пост: https://t.me/channel/123"); return;
                          }
                          setLinkSaving(true); setLinkError("");
                          void onSaveTelegramPostLink(prompt.id, telegramPostLink.trim())
                            .catch((error) => setLinkError(error instanceof Error ? error.message : "Не удалось сохранить ссылку"))
                            .finally(() => setLinkSaving(false));
                        }}>{linkSaving ? "Сохраняем..." : "Сохранить ссылку"}</button> : null}
                      {linkError ? <p role="alert" className="mt-2 text-xs text-[var(--red)]">{linkError}</p> : null}
                      {prompt.pinterestPublication?.status === "published" ? <p className="mt-2 text-xs text-[var(--muted)]">
                        Изменение ссылки относится к будущим публикациям. Существующий пин не изменяется.
                      </p> : null}
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
                      {prompt.pinterestPublication?.status === "published" && pinterestPinUrl ? (
                        <a
                          href={pinterestPinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary mt-3 inline-flex w-full justify-center"
                        >
                          Открыть Pin
                        </a>
                      ) : onPublishPinterest ? (
                        <button
                          type="button"
                          disabled={pinterestPublishing || linkSaving || !prompt.telegramPostUrl || telegramPostLink.trim() !== prompt.telegramPostUrl}
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

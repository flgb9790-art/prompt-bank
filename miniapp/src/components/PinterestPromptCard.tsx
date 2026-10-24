import { memo, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useNearViewport } from "../hooks/useNearViewport";
import { Copy, Images, Sparkles, Star } from "lucide-react";
import { api, resolveCardMediaUrl, resolveMediaUrl } from "../api";
import type { Prompt } from "../types";
import { getCategoryBadgeClass } from "../utils/categoryStyle";
import { hasFullPromptDetails } from "../utils/promptContent";
import { resolvePostMedia } from "../utils/resolvePostMedia";
import { usePromptFavorite } from "../context/FavoriteIdsContext";
import { getPromptLabel } from "../utils/promptTitle";

type Props = {
  prompt: Prompt;
  imagePriority?: boolean;
  uniformAspect?: boolean;
  className?: string;
  onOpen: (prompt: Prompt) => void;
  onCopy: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  /** @deprecated Теги на Pinterest-карточке скрыты */
  onTagClick?: (tag: string) => void;
};

export const PinterestPromptCard = memo(function PinterestPromptCard({
  prompt,
  imagePriority = false,
  uniformAspect = false,
  className = "",
  onOpen,
  onCopy,
  onToggleFavorite
}: Props) {
  const media = resolvePostMedia(prompt);
  const badgeClass = getCategoryBadgeClass(prompt.category.slug, prompt.category.name);
  const imageSrc = useMemo(
    () => (media?.type === "image" ? resolveCardMediaUrl(media.url, "image") : null),
    [media?.type, media?.url]
  );
  const mediaRef = useRef<HTMLDivElement>(null);
  const nearViewport = useNearViewport(mediaRef, { enabled: !imagePriority, rootMargin: "360px 0px" });
  const shouldLoadMedia = imagePriority || nearViewport;
  const [tooTall, setTooTall] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const label = getPromptLabel(prompt);
  const imageCount = new Set([prompt.coverMediaUrl, ...(prompt.examples ?? []).map((item) => item.url)].filter(Boolean)).size;
  const isFavorite = usePromptFavorite(prompt);
  const [favoriteBump, setFavoriteBump] = useState(false);
  useEffect(() => { setMediaFailed(false); setUseOriginal(false); setTooTall(false); }, [media?.url]);

  useEffect(() => {
    if (!favoriteBump) return;
    const timer = window.setTimeout(() => setFavoriteBump(false), 180);
    return () => window.clearTimeout(timer);
  }, [favoriteBump]);

  function prefetchDetails() {
    if (!hasFullPromptDetails(prompt)) {
      api.prefetchPrompt(prompt.id);
    }
  }

  function handleOpen() {
    onOpen(prompt);
  }

  function handleCopy(event: MouseEvent) {
    event.stopPropagation();
    onCopy(prompt);
  }

  function handleFavorite(event: MouseEvent) {
    event.stopPropagation();
    setFavoriteBump(true);
    onToggleFavorite(prompt.id);
  }

  return (
    <article
      className={`pinterest-card pinterest-card--visual ${className}`.trim()}
      onPointerEnter={prefetchDetails}
      onFocus={prefetchDetails}
    >
      <button type="button" className="pinterest-open-button" onClick={handleOpen} aria-label={`Открыть промпт: ${label}`} />
      <div
        className={`pinterest-media${uniformAspect ? " pinterest-media--uniform" : ""}`}
        ref={mediaRef}
      >
        {!media || mediaFailed ? (
          <div className="pinterest-placeholder" aria-hidden>
            <Sparkles size={38} strokeWidth={2} />
          </div>
        ) : !shouldLoadMedia ? (
          <div className="pinterest-media-skeleton" aria-hidden />
        ) : media.type === "video" ? (
          <>
            <video src={resolveMediaUrl(media.url)} muted playsInline preload="none" />
            <span className="pinterest-video-badge">Видео</span>
          </>
        ) : (
          <img
            src={useOriginal ? resolveMediaUrl(media.url) : imageSrc ?? resolveMediaUrl(media.url)}
            alt=""
            draggable={false}
            loading={imagePriority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={imagePriority ? "high" : "auto"}
            className={tooTall ? "is-too-tall" : undefined}
            onLoad={(event) => {
              if (uniformAspect) return;
              const img = event.currentTarget;
              const ratio = img.naturalHeight / Math.max(img.naturalWidth, 1);
              if (ratio > 1.35 && img.offsetHeight >= 560) {
                setTooTall(true);
              }
            }}
            onError={() => {
              if (!useOriginal && imageSrc !== resolveMediaUrl(media.url)) setUseOriginal(true);
              else setMediaFailed(true);
            }}
          />
        )}

        <span className={`pinterest-category-overlay ${badgeClass}`}>{prompt.category.name}</span>
        {imageCount > 1 ? <span className="pinterest-count" aria-label={`${imageCount} примера`}><Images size={13} />{imageCount}</span> : null}

        <div className="pinterest-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="pinterest-action-btn" onClick={handleCopy} aria-label="Скопировать промпт">
            <Copy size={19} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={`pinterest-action-btn${isFavorite ? " active favorite-lit" : ""}${favoriteBump ? " bump" : ""}`}
            onClick={handleFavorite}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? "Убрать из избранного" : "В избранное"}
          >
            <Star size={19} strokeWidth={2} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
      <div className="pinterest-card-caption"><h3>{label}</h3><span>Открыть промпт <span aria-hidden>↗</span></span></div>
    </article>
  );
});

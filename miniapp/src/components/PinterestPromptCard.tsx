import { memo, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useNearViewport } from "../hooks/useNearViewport";
import { Copy, Sparkles, Star } from "lucide-react";
import { api, resolveCardMediaUrl, resolveMediaUrl } from "../api";
import type { Prompt } from "../types";
import { getCategoryBadgeClass } from "../utils/categoryStyle";
import { hasFullPromptDetails } from "../utils/promptContent";
import { resolvePostMedia } from "../utils/resolvePostMedia";

type Props = {
  prompt: Prompt;
  imagePriority?: boolean;
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
  const [tooTall, setTooTall] = useState(false);
  const [favoriteBump, setFavoriteBump] = useState(false);

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
      onClick={handleOpen}
      onPointerEnter={prefetchDetails}
      onFocus={prefetchDetails}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleOpen();
        }
      }}
    >
      <div className="pinterest-media" ref={mediaRef}>
        {!media ? (
          <div className="pinterest-placeholder" aria-hidden>
            <Sparkles size={38} strokeWidth={2} />
          </div>
        ) : !shouldLoadMedia ? (
          <div className="pinterest-media-skeleton" aria-hidden />
        ) : media.type === "video" ? (
          <>
            <video src={resolveMediaUrl(media.url)} muted playsInline preload="metadata" />
            <span className="pinterest-video-badge">VIDEO</span>
          </>
        ) : (
          <img
            src={imageSrc ?? resolveMediaUrl(media.url)}
            alt=""
            draggable={false}
            loading={imagePriority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={imagePriority ? "high" : "auto"}
            className={tooTall ? "is-too-tall" : undefined}
            onLoad={(event) => {
              const img = event.currentTarget;
              const ratio = img.naturalHeight / Math.max(img.naturalWidth, 1);
              if (ratio > 1.35 && img.offsetHeight >= 560) {
                setTooTall(true);
              }
            }}
            onError={(event) => {
              const fallback = resolveMediaUrl(media.url);
              if (event.currentTarget.src !== fallback) {
                event.currentTarget.src = fallback;
              }
            }}
          />
        )}

        <span className={`pinterest-category-overlay ${badgeClass}`}>{prompt.category.name}</span>

        <div className="pinterest-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="pinterest-action-btn" onClick={handleCopy} aria-label="Скопировать промпт">
            <Copy size={19} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={`pinterest-action-btn ${prompt.isFavorite ? "active" : ""}${favoriteBump ? " bump" : ""}`}
            onClick={handleFavorite}
            aria-label={prompt.isFavorite ? "Убрать из избранного" : "В избранное"}
          >
            <Star size={19} strokeWidth={2} fill={prompt.isFavorite ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
    </article>
  );
});

import { memo, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Copy, Sparkles, Star } from "lucide-react";
import { api, resolveCardMediaUrl, resolveMediaUrl } from "../api";
import type { Prompt } from "../types";
import { getCategoryBadgeClass } from "../utils/categoryStyle";
import { hasFullPromptDetails } from "../utils/promptContent";
import { resolvePostMedia } from "../utils/resolvePostMedia";
import { TagPill } from "./TagPill";

const MAX_TAGS = 6;

type Props = {
  prompt: Prompt;
  imagePriority?: boolean;
  metaLabel?: string;
  className?: string;
  onOpen: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onCopy: (prompt: Prompt) => void;
  onTagClick?: (tag: string) => void;
};

function PostMediaBlock({
  prompt,
  imagePriority,
  onOpen
}: {
  prompt: Prompt;
  imagePriority?: boolean;
  onOpen: (prompt: Prompt) => void;
}) {
  const media = resolvePostMedia(prompt);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [mediaReady, setMediaReady] = useState(!media);
  const [tooTall, setTooTall] = useState(false);

  useEffect(() => {
    if (!media) {
      setImageSrc(null);
      setMediaReady(true);
      setTooTall(false);
      return;
    }
    if (media.type === "image") {
      setImageSrc(resolveCardMediaUrl(media.url, "image"));
    } else {
      setImageSrc(resolveMediaUrl(media.url));
    }
    setMediaReady(false);
    setTooTall(false);
  }, [media?.url, media?.type, prompt.id]);

  function openDetails(event: MouseEvent | KeyboardEvent) {
    event.stopPropagation();
    onOpen(prompt);
  }

  if (!media) {
    return (
      <button type="button" className="mobile-post-media mobile-post-placeholder" onClick={openDetails} aria-label="Открыть промпт">
        <div className="mobile-post-placeholder-inner">
          <Sparkles size={42} strokeWidth={2} />
          <span>Prompt Bank</span>
        </div>
      </button>
    );
  }

  const mediaClass = `mobile-post-media${tooTall ? " is-too-tall" : ""}${mediaReady ? "" : " mobile-post-media--loading"}`;

  return (
    <button
      type="button"
      className={mediaClass}
      onClick={openDetails}
      aria-label="Открыть промпт"
    >
      {!mediaReady ? <div className="mobile-post-media-shimmer" aria-hidden /> : null}
      {media.type === "video" ? (
        <>
          <video src={resolveMediaUrl(media.url)} muted playsInline preload="metadata" />
          <span className="mobile-post-video-badge">VIDEO</span>
        </>
      ) : (
        <img
          src={imageSrc ?? resolveMediaUrl(media.url)}
          alt=""
          draggable={false}
          loading={imagePriority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={imagePriority ? "high" : "auto"}
          onLoad={(event) => {
            setMediaReady(true);
            const img = event.currentTarget;
            const ratio = img.naturalHeight / Math.max(img.naturalWidth, 1);
            if (ratio > 1.35 && img.offsetHeight >= 600) {
              setTooTall(true);
            }
          }}
          onError={() => {
            const fallback = resolveMediaUrl(media.url);
            if (imageSrc !== fallback) {
              setImageSrc(fallback);
              return;
            }
            setMediaReady(true);
          }}
        />
      )}
    </button>
  );
}

export const MobilePromptPostCard = memo(function MobilePromptPostCard({
  prompt,
  imagePriority = false,
  metaLabel,
  className = "",
  onOpen,
  onToggleFavorite,
  onCopy,
  onTagClick
}: Props) {
  const badgeClass = getCategoryBadgeClass(prompt.category.slug, prompt.category.name);
  const tags = prompt.keywords.slice(0, MAX_TAGS);
  const extraTags = Math.max(0, prompt.keywords.length - MAX_TAGS);
  const favoriteRef = useRef<HTMLButtonElement>(null);
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

  function handleFavorite(event: MouseEvent) {
    event.stopPropagation();
    setFavoriteBump(true);
    onToggleFavorite(prompt.id);
  }

  return (
    <article
      className={`mobile-post-card fade-up ${className}`.trim()}
      onPointerEnter={prefetchDetails}
      onFocus={prefetchDetails}
    >
      <div className="mobile-post-media-wrap">
        <PostMediaBlock prompt={prompt} imagePriority={imagePriority} onOpen={onOpen} />
        <button
          ref={favoriteRef}
          type="button"
          className={`mobile-post-favorite-overlay ${prompt.isFavorite ? "active" : ""}${favoriteBump ? " bump" : ""}`}
          onClick={handleFavorite}
          aria-label={prompt.isFavorite ? "Убрать из избранного" : "В избранное"}
        >
          <Star size={22} strokeWidth={2.2} fill={prompt.isFavorite ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="mobile-post-content">
        <div className="mobile-post-header-row">
          <span className={`mobile-post-category-badge ${badgeClass}`}>{prompt.category.name}</span>
          {metaLabel ? <span className="mobile-post-meta-label">{metaLabel}</span> : null}
        </div>

        {tags.length ? (
          <div
            className="mobile-post-tags"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {tags.map((item) => (
              <TagPill key={item.keyword.id} name={item.keyword.name} onClick={onTagClick} />
            ))}
            {extraTags > 0 ? <span className="mobile-post-tag-more">+{extraTags}</span> : null}
          </div>
        ) : null}

        <div className="mobile-post-actions">
          <button
            type="button"
            className="mobile-post-action mobile-post-action--copy"
            onClick={(event) => {
              event.stopPropagation();
              onCopy(prompt);
            }}
          >
            <Copy size={19} strokeWidth={2.2} />
            Скопировать
          </button>
          <button
            type="button"
            className={`mobile-post-action mobile-post-action--favorite${prompt.isFavorite ? " active" : ""}`}
            onClick={handleFavorite}
          >
            <Star size={19} strokeWidth={2.2} fill={prompt.isFavorite ? "currentColor" : "none"} />
            {prompt.isFavorite ? "В избранном" : "В избранное"}
          </button>
        </div>
      </div>
    </article>
  );
});

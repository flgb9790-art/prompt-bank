import { memo, useEffect, useState, type MouseEvent } from "react";
import { Copy, Sparkles, Star } from "lucide-react";
import { api, resolveMediaUrl } from "../api";
import type { Prompt } from "../types";
import { getCategoryBadgeClass } from "../utils/categoryStyle";
import { getPromptExcerpt, hasFullPromptDetails } from "../utils/promptContent";
import { resolvePostMedia } from "../utils/resolvePostMedia";

const MAX_TAGS = 5;

type Props = {
  prompt: Prompt;
  imagePriority?: boolean;
  className?: string;
  onOpen: (prompt: Prompt) => void;
  onCopy: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onTagClick?: (tag: string) => void;
};

export const PinterestPromptCard = memo(function PinterestPromptCard({
  prompt,
  imagePriority = false,
  className = "",
  onOpen,
  onCopy,
  onToggleFavorite,
  onTagClick
}: Props) {
  const media = resolvePostMedia(prompt);
  const badgeClass = getCategoryBadgeClass(prompt.category.slug, prompt.category.name);
  const tags = prompt.keywords.slice(0, MAX_TAGS);
  const extraTags = Math.max(0, prompt.keywords.length - MAX_TAGS);
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

  function handleTagClick(tag: string, event: MouseEvent) {
    event.stopPropagation();
    onTagClick?.(tag);
  }

  return (
    <article
      className={`pinterest-card fade-up ${className}`.trim()}
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
      <div className="pinterest-media">
        {!media ? (
          <div className="pinterest-placeholder" aria-hidden>
            <Sparkles size={38} strokeWidth={2} />
          </div>
        ) : media.type === "video" ? (
          <>
            <video src={resolveMediaUrl(media.url)} muted playsInline preload="metadata" />
            <span className="pinterest-video-badge">VIDEO</span>
          </>
        ) : (
          <img
            src={resolveMediaUrl(media.url)}
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
          />
        )}

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

      <div className="pinterest-content">
        <p className="pinterest-excerpt">{getPromptExcerpt(prompt)}</p>
        <span className={`pinterest-category ${badgeClass}`}>{prompt.category.name}</span>
        {tags.length ? (
          <div className="pinterest-tags">
            {tags.map((item) => (
              <button
                key={item.keyword.id}
                type="button"
                className="pinterest-tag"
                onClick={(event) => handleTagClick(item.keyword.name, event)}
              >
                {item.keyword.name}
              </button>
            ))}
            {extraTags > 0 ? <span className="pinterest-tag-more">+{extraTags}</span> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
});

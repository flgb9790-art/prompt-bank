import { memo, useState } from "react";
import { Copy, Star } from "lucide-react";
import { resolveCardMediaUrl, resolveMediaUrl } from "../api";
import type { Prompt } from "../types";
import { getPromptExcerpt } from "../utils/promptContent";
import { TagPill } from "./TagPill";
import { getCategoryBadgeClass } from "../utils/categoryStyle";

type Props = {
  prompt: Prompt;
  variant?: "desktop" | "mobile" | "list";
  imagePriority?: boolean;
  onOpen: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onCopy: (prompt: Prompt) => void;
  onTagClick?: (tag: string) => void;
};

type CardVariant = "desktop" | "mobile" | "list";

function CardPreview({
  prompt,
  variant,
  imagePriority = false
}: {
  prompt: Prompt;
  variant: CardVariant;
  imagePriority?: boolean;
}) {
  const coverUrl = prompt.coverMediaUrl ?? "";
  const [imageSrc, setImageSrc] = useState(() =>
    coverUrl && prompt.coverMediaType === "image"
      ? resolveCardMediaUrl(coverUrl, "image")
      : resolveMediaUrl(coverUrl)
  );
  const [imageReady, setImageReady] = useState(!coverUrl || prompt.coverMediaType === "video");

  const sizeClass =
    variant === "desktop"
      ? "prompt-card-preview--desktop"
      : variant === "list"
        ? "prompt-card-preview--list"
        : "prompt-card-preview--mobile";

  return (
    <div className={`preview-4x5 ${sizeClass}${imageReady ? "" : " preview-4x5--loading"}`} aria-hidden>
      {!imageReady ? <div className="preview-4x5-shimmer" aria-hidden /> : null}
      {prompt.coverMediaUrl ? (
        prompt.coverMediaType === "video" ? (
          <video src={resolveMediaUrl(prompt.coverMediaUrl)} muted playsInline preload="metadata" />
        ) : (
          <img
            src={imageSrc}
            alt=""
            draggable={false}
            loading={imagePriority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={imagePriority ? "high" : "auto"}
            onLoad={() => setImageReady(true)}
            onError={() => {
              const fallback = resolveMediaUrl(coverUrl);
              if (imageSrc !== fallback) {
                setImageSrc(fallback);
                return;
              }
              setImageReady(true);
            }}
          />
        )
      ) : null}
    </div>
  );
}

function CardTagsRow({
  tags,
  className,
  onTagClick
}: {
  tags: Prompt["keywords"];
  className: string;
  onTagClick?: (tag: string) => void;
}) {
  if (!tags.length) return null;

  return (
    <div
      className={className}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {tags.map((item) => (
        <TagPill key={item.keyword.id} name={item.keyword.name} onClick={onTagClick} />
      ))}
    </div>
  );
}

export const PromptCard = memo(function PromptCard({
  prompt,
  variant = "mobile",
  imagePriority = false,
  onOpen,
  onToggleFavorite,
  onCopy,
  onTagClick
}: Props) {
  const badgeClass = getCategoryBadgeClass(prompt.category.slug, prompt.category.name);

  if (variant === "list") {
    const listTags = prompt.keywords.slice(0, 4);

    return (
      <article
        role="button"
        tabIndex={0}
        onClick={() => onOpen(prompt)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onOpen(prompt);
        }}
        className="prompt-card-list fade-up"
      >
        <div className="prompt-card-list-layout prompt-card-web-layout">
          <CardPreview prompt={prompt} variant="list" imagePriority={imagePriority} />
          <div className="prompt-card-body prompt-card-body--list">
            <h3 className="prompt-card-title prompt-card-title--list">{prompt.title}</h3>
            <span className={`category-badge category-badge-mobile ${badgeClass}`}>{prompt.category.name}</span>
            <p className="prompt-card-excerpt prompt-card-excerpt--list">{getPromptExcerpt(prompt)}</p>
          </div>
          <button
            type="button"
            className={`prompt-card-action prompt-card-star-slot ${prompt.isFavorite ? "active" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite(prompt.id);
            }}
            aria-label="Избранное"
          >
            <Star size={16} fill={prompt.isFavorite ? "currentColor" : "none"} />
          </button>
          <CardTagsRow tags={listTags} className="prompt-card-tags prompt-card-tags--web-row" onTagClick={onTagClick} />
          <button
            type="button"
            className="prompt-card-action prompt-card-copy-slot"
            onClick={(event) => {
              event.stopPropagation();
              onCopy(prompt);
            }}
            aria-label="Копировать"
          >
            <Copy size={16} />
          </button>
        </div>
      </article>
    );
  }

  if (variant === "desktop") {
    const desktopTags = prompt.keywords.slice(0, 3);

    return (
      <article
        role="button"
        tabIndex={0}
        onClick={() => onOpen(prompt)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onOpen(prompt);
        }}
        className="prompt-card-desktop fade-up"
      >
        <div className="prompt-card-desktop-layout prompt-card-web-layout">
          <CardPreview prompt={prompt} variant="desktop" imagePriority={imagePriority} />
          <div className="prompt-card-body prompt-card-body--desktop">
            <h3 className="prompt-card-title">{prompt.title}</h3>
            <span className={`category-badge ${badgeClass}`}>{prompt.category.name}</span>
            <p className="prompt-card-excerpt prompt-card-excerpt--desktop">{getPromptExcerpt(prompt)}</p>
          </div>
          <button
            type="button"
            className={`prompt-card-action prompt-card-star-slot ${prompt.isFavorite ? "active" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite(prompt.id);
            }}
            aria-label="Избранное"
          >
            <Star size={20} fill={prompt.isFavorite ? "currentColor" : "none"} />
          </button>
          <CardTagsRow tags={desktopTags} className="prompt-card-tags prompt-card-tags--web-row" onTagClick={onTagClick} />
          <button
            type="button"
            className="prompt-card-action prompt-card-copy-slot"
            onClick={(event) => {
              event.stopPropagation();
              onCopy(prompt);
            }}
            aria-label="Копировать"
          >
            <Copy size={16} />
          </button>
        </div>
      </article>
    );
  }

  const mobileTags = prompt.keywords.slice(0, 3);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(prompt)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(prompt);
      }}
      className="prompt-card-mobile fade-up"
    >
      <div className="prompt-card-mobile-layout prompt-card-web-layout">
        <CardPreview prompt={prompt} variant="mobile" imagePriority={imagePriority} />
        <div className="prompt-card-body prompt-card-body--mobile">
          <h3 className="prompt-card-title prompt-card-title--mobile">{prompt.title}</h3>
          <span className={`category-badge category-badge-mobile ${badgeClass}`}>{prompt.category.name}</span>
          <p className="prompt-card-excerpt prompt-card-excerpt--mobile">{getPromptExcerpt(prompt)}</p>
        </div>
        <button
          type="button"
          className={`prompt-card-action prompt-card-star-slot ${prompt.isFavorite ? "active" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(prompt.id);
          }}
          aria-label="Избранное"
        >
          <Star size={16} fill={prompt.isFavorite ? "currentColor" : "none"} />
        </button>
        <CardTagsRow tags={mobileTags} className="prompt-card-tags prompt-card-tags--web-row" onTagClick={onTagClick} />
        <button
          type="button"
          className="prompt-card-action prompt-card-copy-slot"
          onClick={(event) => {
            event.stopPropagation();
            onCopy(prompt);
          }}
          aria-label="Копировать"
        >
          <Copy size={16} />
        </button>
      </div>
    </article>
  );
});

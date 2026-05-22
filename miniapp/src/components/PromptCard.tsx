import { Copy, Star } from "lucide-react";
import { resolveMediaUrl } from "../api";
import type { Prompt } from "../types";
import { TagPill } from "./TagPill";
import { getCategoryBadgeClass } from "../utils/categoryStyle";

type Props = {
  prompt: Prompt;
  variant?: "desktop" | "mobile";
  onOpen: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onCopy: (prompt: Prompt) => void;
  onTagClick?: (tag: string) => void;
};

function CardPreview({ prompt, variant }: { prompt: Prompt; variant: "desktop" | "mobile" }) {
  const sizeClass = variant === "desktop" ? "prompt-card-preview--desktop" : "prompt-card-preview--mobile";

  return (
    <div className={`preview-4x5 ${sizeClass}`} aria-hidden>
      {prompt.coverMediaUrl ? (
        prompt.coverMediaType === "video" ? (
          <video src={resolveMediaUrl(prompt.coverMediaUrl)} muted playsInline preload="metadata" />
        ) : (
          <img src={resolveMediaUrl(prompt.coverMediaUrl)} alt="" draggable={false} loading="lazy" />
        )
      ) : null}
    </div>
  );
}

export function PromptCard({ prompt, variant = "mobile", onOpen, onToggleFavorite, onCopy, onTagClick }: Props) {
  const badgeClass = getCategoryBadgeClass(prompt.category.slug, prompt.category.name);
  const isDesktop = variant === "desktop";

  if (isDesktop) {
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
        <CardPreview prompt={prompt} variant="desktop" />
        <div className="prompt-card-body prompt-card-body--desktop">
          <button
            type="button"
            className={`prompt-card-star ${prompt.isFavorite ? "active" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite(prompt.id);
            }}
            aria-label="Избранное"
          >
            <Star size={20} fill={prompt.isFavorite ? "currentColor" : "none"} />
          </button>
          <h3 className="prompt-card-title">{prompt.title}</h3>
          <span className={`category-badge ${badgeClass}`}>{prompt.category.name}</span>
          <p className="prompt-card-excerpt prompt-card-excerpt--desktop">{prompt.content}</p>
          <div className="prompt-card-tags">
            {prompt.keywords.slice(0, 3).map((item) => (
              <TagPill key={item.keyword.id} name={item.keyword.name} onClick={onTagClick} />
            ))}
          </div>
          <div className="prompt-card-footer">
            <button
              type="button"
              className="prompt-card-action"
              onClick={(event) => {
                event.stopPropagation();
                onCopy(prompt);
              }}
              aria-label="Копировать"
            >
              <Copy size={16} />
            </button>
          </div>
        </div>
      </article>
    );
  }

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
      <CardPreview prompt={prompt} variant="mobile" />
      <div className="prompt-card-body prompt-card-body--mobile">
        <button
          type="button"
          className={`prompt-card-star-mobile ${prompt.isFavorite ? "active" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(prompt.id);
          }}
          aria-label="Избранное"
        >
          <Star size={18} fill={prompt.isFavorite ? "currentColor" : "none"} />
        </button>
        <h3 className="prompt-card-title">{prompt.title}</h3>
        <span className={`category-badge category-badge-mobile ${badgeClass}`}>{prompt.category.name}</span>
        <p className="prompt-card-excerpt prompt-card-excerpt--mobile">{prompt.content}</p>
        <div className="prompt-card-tags prompt-card-tags--mobile">
          {prompt.keywords.slice(0, 2).map((item) => (
            <TagPill key={item.keyword.id} name={item.keyword.name} onClick={onTagClick} />
          ))}
        </div>
      </div>
      <button
        type="button"
        className="prompt-card-copy-mobile"
        onClick={(event) => {
          event.stopPropagation();
          onCopy(prompt);
        }}
        aria-label="Копировать"
      >
        <Copy size={16} />
      </button>
    </article>
  );
}

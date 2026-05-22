import { Copy, Star } from "lucide-react";
import { resolveMediaUrl } from "../api";
import type { Prompt } from "../types";
import { formatPromptDate, getCategoryBadgeClass } from "../utils/categoryStyle";

type Props = {
  prompt: Prompt;
  variant?: "desktop" | "mobile";
  onOpen: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onCopy: (prompt: Prompt) => void;
};

function Preview({ prompt, className }: { prompt: Prompt; className: string }) {
  if (!prompt.coverMediaUrl) {
    return <div className={`prompt-preview ${className} bg-[#f2f4f7]`} />;
  }

  return (
    <div className={`prompt-preview preview-4x5 ${className}`}>
      {prompt.coverMediaType === "video" ? (
        <video src={resolveMediaUrl(prompt.coverMediaUrl)} muted playsInline />
      ) : (
        <img src={resolveMediaUrl(prompt.coverMediaUrl)} alt={prompt.title} draggable={false} />
      )}
    </div>
  );
}

export function PromptCard({ prompt, variant = "mobile", onOpen, onToggleFavorite, onCopy }: Props) {
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
        <Preview prompt={prompt} className="preview-desktop" />
        <div className="prompt-card-content">
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
          <h3 className="line-clamp-2 pr-8 text-[16px] font-[750] leading-[22px] text-[var(--text)]">{prompt.title}</h3>
          <span className={`category-badge mt-2 ${badgeClass}`}>{prompt.category.name}</span>
          <p className="line-clamp-3 mt-2.5 text-[14px] leading-5 text-[#475467]">{prompt.content}</p>
          <div className="mt-auto flex max-h-6 flex-wrap gap-1.5 overflow-hidden pt-2">
            {prompt.keywords.slice(0, 3).map((item) => (
              <span key={item.keyword.id} className="tag-pill">
                #{item.keyword.name}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[13px] text-[var(--muted)]">{formatPromptDate(prompt.createdAt)}</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="text-[var(--muted)] hover:text-[var(--primary)]"
                onClick={(event) => {
                  event.stopPropagation();
                  onCopy(prompt);
                }}
                aria-label="Копировать"
              >
                <Copy size={18} />
              </button>
            </div>
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
      <Preview prompt={prompt} className="preview-mobile" />
      <div className="prompt-card-content-mobile">
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
        <h3 className="line-clamp-2 text-[15.5px] font-[760] leading-5 text-[var(--text)]">{prompt.title}</h3>
        <span className={`category-badge category-badge-mobile mt-1.5 ${badgeClass}`}>{prompt.category.name}</span>
        <p className="line-clamp-2 mt-1.5 text-[13.5px] leading-[18px] text-[#475467]">{prompt.content}</p>
        <div className="mt-auto flex max-h-[22px] gap-1 overflow-hidden pt-1">
          {prompt.keywords.slice(0, 2).map((item) => (
            <span key={item.keyword.id} className="tag-pill">
              #{item.keyword.name}
            </span>
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
        <Copy size={20} />
      </button>
    </article>
  );
}

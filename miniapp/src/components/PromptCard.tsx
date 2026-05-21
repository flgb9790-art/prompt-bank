import { Copy, EllipsisVertical, Star } from "lucide-react";
import { resolveMediaUrl } from "../api";
import type { Prompt } from "../types";

type Props = {
  prompt: Prompt;
  onOpen: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onCopy: (prompt: Prompt) => void;
};

export function PromptCard({ prompt, onOpen, onToggleFavorite, onCopy }: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(prompt)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onOpen(prompt);
        }
      }}
      className="glass-card fade-up w-full p-3.5 text-left transition duration-200 hover:-translate-y-0.5 active:scale-[0.995]"
    >
      <div className="flex gap-3">
        {prompt.coverMediaUrl ? (
          <div className="shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/25 p-1 shadow-inner">
            {prompt.coverMediaType === "video" ? (
              <video
                src={resolveMediaUrl(prompt.coverMediaUrl)}
                className="pointer-events-none block max-h-28 w-auto rounded-lg object-contain"
              />
            ) : (
              <img
                src={resolveMediaUrl(prompt.coverMediaUrl)}
                alt={prompt.title}
                draggable={false}
                className="pointer-events-none block max-h-28 w-auto rounded-lg object-contain"
              />
            )}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="mb-1.5">
            <h3 className="line-clamp-2 text-[17px] font-semibold leading-[1.25]">{prompt.title}</h3>
          </div>
          <p className="line-clamp-2 text-[13px] text-slate-300">{prompt.content}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {prompt.keywords.slice(0, 4).map((item) => (
              <span key={item.keyword.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-slate-300">
                #{item.keyword.name}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3.5 flex items-center justify-between gap-2">
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-slate-300">
          {prompt.category.name}
        </span>
        <div className="flex items-center gap-2">
          <button
          type="button"
          className={`rounded-xl border px-2.5 py-2 ${
            prompt.isFavorite
              ? "border-amber-300/30 bg-amber-300/20 text-amber-300"
              : "border-white/10 bg-white/[0.04] text-muted"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(prompt.id);
          }}
        >
          <Star size={14} />
          </button>
          <button
          type="button"
          className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-muted"
          onClick={(event) => {
            event.stopPropagation();
            onCopy(prompt);
          }}
        >
          <Copy size={14} />
          </button>
          <button type="button" className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-muted">
            <EllipsisVertical size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

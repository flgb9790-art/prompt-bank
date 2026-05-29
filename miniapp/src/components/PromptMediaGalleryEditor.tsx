import { ImageIcon, Star, Trash2 } from "lucide-react";
import { resolveMediaUrl } from "../api";
import type { MediaType } from "../types";
import { MediaUploader } from "./MediaUploader";

export type PromptMediaItem = {
  url: string;
  type: MediaType;
  /** Существующий пример в БД */
  exampleId?: number;
};

type Props = {
  items: PromptMediaItem[];
  onChange: (items: PromptMediaItem[]) => void;
  label?: string;
};

export function splitPromptMediaItems(items: PromptMediaItem[]) {
  const cover = items[0];
  return {
    coverMediaUrl: cover?.url,
    coverMediaType: cover?.type,
    examples: items.slice(1).map(({ url, type }) => ({ url, type }))
  };
}

export function buildPromptMediaItemsFromPrompt(input: {
  coverMediaUrl?: string | null;
  coverMediaType?: MediaType | null;
  examples?: Array<{ id: number; url: string; type: MediaType }>;
}): PromptMediaItem[] {
  const items: PromptMediaItem[] = [];
  if (input.coverMediaUrl && input.coverMediaType) {
    items.push({ url: input.coverMediaUrl, type: input.coverMediaType });
  }
  for (const example of input.examples ?? []) {
    items.push({ url: example.url, type: example.type, exampleId: example.id });
  }
  return items;
}

export function diffPromptMediaOnEdit(
  originalExamples: Array<{ id: number }>,
  nextItems: PromptMediaItem[]
) {
  const cover = nextItems[0];
  const nextExampleIds = new Set(
    nextItems.slice(1).map((item) => item.exampleId).filter((id): id is number => typeof id === "number")
  );
  const removedExampleIds = originalExamples.map((e) => e.id).filter((id) => !nextExampleIds.has(id));
  const newExamples = nextItems
    .slice(1)
    .filter((item) => item.exampleId === undefined)
    .map(({ url, type }) => ({ url, type }));

  return {
    coverMediaUrl: cover?.url ?? null,
    coverMediaType: cover?.type ?? null,
    removedExampleIds,
    newExamples
  };
}

export function PromptMediaGalleryEditor({ items, onChange, label = "Фотографии" }: Props) {
  function removeAt(index: number) {
    onChange(items.filter((_, idx) => idx !== index));
  }

  function makePreview(index: number) {
    if (index <= 0) return;
    const next = [...items];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    onChange(next);
  }

  return (
    <div className="prompt-form-media-block">
      <p className="mb-1 text-sm font-medium text-[var(--text)]">{label}</p>
      <p className="mb-2 text-xs text-[var(--muted)]">Первая фотография — превью в карточках. Можно добавить несколько файлов.</p>
      <div className="edit-media-toolbar">
        <MediaUploader
          compact
          label="Добавить фото"
          multiple
          onUploaded={(uploaded) => onChange([...items, ...uploaded])}
        />
        {items.length ? <span className="text-xs text-[var(--muted)]">Всего: {items.length}</span> : null}
      </div>

      {items.length ? (
        <div className="prompt-media-grid mt-3">
          {items.map((item, index) => (
            <div key={`${item.url}-${index}`} className="prompt-media-grid-item">
              {item.type === "video" ? (
                <video src={resolveMediaUrl(item.url)} muted playsInline preload="metadata" />
              ) : (
                <img src={resolveMediaUrl(item.url)} alt="" loading="lazy" decoding="async" />
              )}
              {index === 0 ? <span className="prompt-media-badge">Превью</span> : null}
              <div className="prompt-media-grid-actions">
                {index > 0 ? (
                  <button
                    type="button"
                    className="prompt-media-icon-btn"
                    title="Сделать превью"
                    aria-label="Сделать превью"
                    onClick={() => makePreview(index)}
                  >
                    <Star size={14} />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="prompt-media-icon-btn prompt-media-icon-btn--danger"
                  title="Удалить"
                  aria-label="Удалить"
                  onClick={() => removeAt(index)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {item.type === "video" ? (
                <span className="prompt-media-type-badge">
                  <ImageIcon size={10} aria-hidden />
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-[var(--muted)]">Фотографии не добавлены.</p>
      )}
    </div>
  );
}

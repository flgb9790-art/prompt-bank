import { useMemo, useState, type FormEvent } from "react";
import type { Category, PromptCreatePayload, TelegramUser } from "../types";
import {
  PublicationTemplatesEditor,
  emptyPublicationTemplates,
  templatesPayloadForApi
} from "./PublicationTemplatesEditor";
import {
  PromptMediaGalleryEditor,
  splitPromptMediaItems,
  type PromptMediaItem
} from "./PromptMediaGalleryEditor";

type Props = {
  categories: Category[];
  user: TelegramUser;
  showTelegramPublish?: boolean;
  onSubmit: (payload: PromptCreatePayload) => Promise<void>;
  onCancel: () => void;
};

function previewKeywords(content: string) {
  const clean = content.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
  return [...new Set(clean.split(/\s+/).filter((word) => word.length > 4))].slice(0, 8);
}

export function PromptForm({ categories, user, showTelegramPublish = false, onSubmit, onCancel }: Props) {
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id ?? 1);
  const [content, setContent] = useState("");
  const [publishToTelegram, setPublishToTelegram] = useState(false);
  const [publishToPinterest, setPublishToPinterest] = useState(false);
  const [publicationTemplatesOpen, setPublicationTemplatesOpen] = useState(false);
  const [publicationTemplates, setPublicationTemplates] = useState(emptyPublicationTemplates);
  const [mediaItems, setMediaItems] = useState<PromptMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const keywordsPreview = useMemo(() => previewKeywords(content), [content]);
  const selectedCategory = categories.find((category) => category.id === categoryId);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { coverMediaUrl, coverMediaType, examples } = splitPromptMediaItems(mediaItems);
    try {
      await onSubmit({
        userId: user.id || 1,
        content,
        categoryId,
        coverMediaUrl,
        coverMediaType,
        examples,
        publishToTelegram: showTelegramPublish ? publishToTelegram : undefined,
        publishToPinterest: showTelegramPublish ? publishToPinterest : undefined,
        ...templatesPayloadForApi(publicationTemplates)
      });
    } catch {
      setError("Не удалось сохранить промпт.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="prompt-form space-y-4">
      <div>
        <label className="mb-2 block text-sm text-[var(--muted)]">Категория</label>
        <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} className="form-select">
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-2 block text-sm text-[var(--muted)]">Текст промпта</label>
        <textarea required rows={8} value={content} onChange={(e) => setContent(e.target.value)} className="form-textarea" />
      </div>
      {keywordsPreview.length ? (
        <div className="flex flex-wrap gap-2">
          {keywordsPreview.map((word) => (
            <span key={word} className="tag-pill bg-[var(--primary-soft)] text-[var(--primary)]">
              {word}
            </span>
          ))}
        </div>
      ) : null}

      <PromptMediaGalleryEditor items={mediaItems} onChange={setMediaItems} />

      {showTelegramPublish ? (
        <div className="surface-card-soft space-y-3 p-4">
          <p className="text-sm font-semibold text-[var(--text)]">Публикация</p>
          <label className="flex items-start gap-3 text-sm text-[var(--text-soft)]">
            <input
              type="checkbox"
              checked={publishToTelegram}
              onChange={(event) => setPublishToTelegram(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-[var(--border)]"
            />
            <span>
              <span className="font-medium text-[var(--text)]">Опубликовать в Telegram-канале</span>
              <span className="mt-1 block text-xs text-[var(--muted)]">
                После сохранения промпт будет автоматически опубликован в Telegram-канал.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-[var(--text-soft)]">
            <input
              type="checkbox"
              checked={publishToPinterest}
              onChange={(event) => setPublishToPinterest(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-[var(--border)]"
            />
            <span>
              <span className="font-medium text-[var(--text)]">Опубликовать в Pinterest</span>
              <span className="mt-1 block text-xs text-[var(--muted)]">
                После сохранения промпт будет автоматически опубликован в Pinterest. Пин будет вести в Telegram-канал.
              </span>
            </span>
          </label>

          <PublicationTemplatesEditor
            content={content}
            categoryName={selectedCategory?.name ?? "Категория"}
            tagNames={keywordsPreview}
            value={publicationTemplates}
            onChange={setPublicationTemplates}
            open={publicationTemplatesOpen}
            onToggleOpen={() => setPublicationTemplatesOpen((open) => !open)}
          />
        </div>
      ) : null}

      {error ? <p className="text-xs text-[var(--red)]">{error}</p> : null}
      <div className="action-button-row">
        <button disabled={loading} type="submit" className="btn-primary justify-center">
          {loading ? "Сохраняем..." : "Сохранить промпт"}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary justify-center">
          Отмена
        </button>
      </div>
    </form>
  );
}

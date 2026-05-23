import { useMemo, useState, type FormEvent } from "react";
import type { Category, PromptCreatePayload, TelegramUser } from "../types";
import { buildTelegramPostPreview } from "../utils/telegramPost";
import { buildPinterestPinPreview } from "../utils/pinterestPost";
import { MediaUploader } from "./MediaUploader";

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
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id ?? 1);
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [publishToTelegram, setPublishToTelegram] = useState(false);
  const [publishToPinterest, setPublishToPinterest] = useState(false);
  const [coverMedia, setCoverMedia] = useState<{ url: string; type: "image" | "video" } | undefined>();
  const [examples, setExamples] = useState<Array<{ url: string; type: "image" | "video"; originalName?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const keywordsPreview = useMemo(() => previewKeywords(content), [content]);
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const telegramPreview = useMemo(
    () =>
      buildTelegramPostPreview({
        title: title || "Название промпта",
        categoryName: selectedCategory?.name ?? "Категория",
        tagNames: keywordsPreview
      }),
    [title, selectedCategory?.name, keywordsPreview]
  );
  const pinterestPreview = useMemo(
    () =>
      buildPinterestPinPreview({
        title: title || "Название промпта",
        categoryName: selectedCategory?.name ?? "Категория"
      }),
    [title, selectedCategory?.name]
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onSubmit({
        userId: user.id || 1,
        title,
        content,
        categoryId,
        note: note || undefined,
        coverMediaUrl: coverMedia?.url,
        coverMediaType: coverMedia?.type,
        examples,
        publishToTelegram: showTelegramPublish ? publishToTelegram : undefined,
        publishToPinterest: showTelegramPublish ? publishToPinterest : undefined
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
        <label className="mb-2 block text-sm text-[var(--muted)]">Название промпта</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} className="form-input" />
      </div>
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
        <textarea required rows={6} value={content} onChange={(e) => setContent(e.target.value)} className="form-textarea" />
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

      <div className="prompt-form-media-block">
        <p className="mb-2 text-sm font-medium text-[var(--text)]">Заставка / превью</p>
        <div className="edit-media-toolbar">
          <MediaUploader
            compact
            label="Выбрать файл"
            onUploaded={(items) => {
              if (items[0]) setCoverMedia(items[0]);
            }}
          />
          {coverMedia ? (
            <span className="text-xs text-[var(--muted)]">Файл выбран</span>
          ) : (
            <span className="text-xs text-[var(--muted)]">Не выбран</span>
          )}
        </div>
      </div>

      <div className="prompt-form-media-block">
        <p className="mb-2 text-sm font-medium text-[var(--text)]">Примеры результата</p>
        <div className="edit-media-toolbar">
          <MediaUploader compact label="Добавить файлы" multiple onUploaded={(items) => setExamples((prev) => [...prev, ...items])} />
          {examples.length ? (
            <span className="text-xs text-[var(--muted)]">Добавлено: {examples.length}</span>
          ) : null}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm text-[var(--muted)]">Заметка (необязательно)</label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="form-textarea min-h-[80px]" />
      </div>

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
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Превью Telegram-поста</p>
            <pre className="whitespace-pre-wrap rounded-xl border border-[var(--border-soft)] bg-white p-3 text-xs leading-relaxed text-[var(--text-soft)]">
              {telegramPreview}
            </pre>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Превью Pinterest-публикации</p>
            <pre className="whitespace-pre-wrap rounded-xl border border-[var(--border-soft)] bg-white p-3 text-xs leading-relaxed text-[var(--text-soft)]">
              {pinterestPreview}
            </pre>
          </div>
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

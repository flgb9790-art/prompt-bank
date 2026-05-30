import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Category, PromptCreatePayload, TelegramUser } from "../types";
import {
  PublicationTemplatesEditor,
  emptyPublicationTemplates,
  templatesPayloadForApi
} from "./PublicationTemplatesEditor";
import { loadStoredPublicationTemplates } from "../utils/publicationTemplatesStorage";
import {
  PromptMediaGalleryEditor,
  splitPromptMediaItems,
  type PromptMediaItem
} from "./PromptMediaGalleryEditor";
import { PromptContentTextarea } from "./PromptContentTextarea";

type Props = {
  categories: Category[];
  user: TelegramUser;
  showTelegramPublish?: boolean;
  layout?: "default" | "webFullscreen";
  onSubmit: (payload: PromptCreatePayload) => Promise<void>;
  onCancel: () => void;
};

function previewKeywords(content: string) {
  const clean = content.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
  return [...new Set(clean.split(/\s+/).filter((word) => word.length > 4))].slice(0, 8);
}

function FormSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`prompt-form-section ${className}`.trim()}>{children}</section>;
}

export function PromptForm({
  categories,
  user,
  showTelegramPublish = false,
  layout = "default",
  onSubmit,
  onCancel
}: Props) {
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id ?? 1);
  const [content, setContent] = useState("");
  const [publishToTelegram, setPublishToTelegram] = useState(false);
  const [publishToPinterest, setPublishToPinterest] = useState(false);
  const [publicationTemplates, setPublicationTemplates] = useState(
    () => loadStoredPublicationTemplates() ?? emptyPublicationTemplates()
  );
  const [mediaItems, setMediaItems] = useState<PromptMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const keywordsPreview = useMemo(() => previewKeywords(content), [content]);
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const isWebFullscreen = layout === "webFullscreen";

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

  const categoryField = (
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
  );

  const contentField = (
    <div>
      <label className="mb-2 block text-sm text-[var(--muted)]">Текст промпта</label>
      <PromptContentTextarea required value={content} onChange={setContent} rows={isWebFullscreen ? 14 : 10} />
    </div>
  );

  const keywordsField =
    keywordsPreview.length > 0 ? (
      <div>
        <p className="mb-2 text-sm text-[var(--muted)]">Ключевые слова (авто)</p>
        <div className="flex flex-wrap gap-2">
          {keywordsPreview.map((word) => (
            <span key={word} className="tag-pill bg-[var(--primary-soft)] text-[var(--primary)]">
              {word}
            </span>
          ))}
        </div>
      </div>
    ) : null;

  const mediaField = <PromptMediaGalleryEditor items={mediaItems} onChange={setMediaItems} />;

  const publishField = showTelegramPublish ? (
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
      />
    </div>
  ) : null;

  const actionsField = (
    <div className="action-button-row prompt-form-actions">
      <button disabled={loading} type="submit" className="btn-primary justify-center">
        {loading ? "Сохраняем..." : "Сохранить промпт"}
      </button>
      <button type="button" onClick={onCancel} className="btn-secondary justify-center">
        Отмена
      </button>
    </div>
  );

  if (isWebFullscreen) {
    return (
      <form onSubmit={handleSubmit} className="prompt-form prompt-form--web-fullscreen">
        <div className="prompt-form-layout">
          <aside className="prompt-form-aside">
            <FormSection>{categoryField}</FormSection>
            <FormSection>{mediaField}</FormSection>
          </aside>
          <div className="prompt-form-main">
            <FormSection>{contentField}</FormSection>
            {keywordsField ? <FormSection>{keywordsField}</FormSection> : null}
            {publishField ? <FormSection className="prompt-form-section--plain">{publishField}</FormSection> : null}
            {error ? <p className="text-xs text-[var(--red)]">{error}</p> : null}
            <footer className="prompt-form-footer">{actionsField}</footer>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="prompt-form space-y-4">
      {categoryField}
      {contentField}
      {keywordsField}
      {mediaField}
      {publishField}
      {error ? <p className="text-xs text-[var(--red)]">{error}</p> : null}
      {actionsField}
    </form>
  );
}

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, FileText, Images, Pin, Send } from "lucide-react";
import type { Category, PromptCreatePayload, TelegramUser } from "../types";
import { derivePromptTitle } from "../utils/promptTitle";
import { normalizePromptContent } from "../utils/promptContentFormat";
import { PublicationTemplatesEditor, emptyPublicationTemplates, templatesPayloadForApi } from "./PublicationTemplatesEditor";
import { loadStoredPublicationTemplates } from "../utils/publicationTemplatesStorage";
import { PromptMediaGalleryEditor, splitPromptMediaItems, type PromptMediaItem } from "./PromptMediaGalleryEditor";
import { PromptContentTextarea } from "./PromptContentTextarea";
import { PinterestPublishFields, emptyPinterestPublishValue, validatePinterestPublishValue } from "./PinterestPublishFields";

type Props = {
  categories: Category[];
  user: TelegramUser;
  showTelegramPublish?: boolean;
  layout?: "default" | "webFullscreen";
  onSubmit: (payload: PromptCreatePayload) => Promise<void>;
  onCancel: () => void;
  onBusyChange?: (busy: boolean) => void;
};

function previewKeywords(content: string) {
  const clean = content.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
  return [...new Set(clean.split(/\s+/).filter((word) => word.length > 4))].slice(0, 8);
}

export function PromptForm({ categories, user, showTelegramPublish = false, layout = "default", onSubmit, onCancel, onBusyChange }: Props) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0);
  const [content, setContent] = useState("");
  const [publishToTelegram, setPublishToTelegram] = useState(false);
  const [publishToPinterest, setPublishToPinterest] = useState(false);
  const [pinterestPublish, setPinterestPublish] = useState(emptyPinterestPublishValue);
  const [pinterestValidationAttempted, setPinterestValidationAttempted] = useState(false);
  const [publicationTemplates, setPublicationTemplates] = useState(() => loadStoredPublicationTemplates() ?? emptyPublicationTemplates());
  const [mediaItems, setMediaItems] = useState<PromptMediaItem[]>([]);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);
  const keywordsPreview = useMemo(() => previewKeywords(content), [content]);
  const autoTitle = useMemo(() => content.trim() ? derivePromptTitle(content) : "", [content]);
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const busy = loading || mediaUploading;

  useEffect(() => {
    if (!categories.some((category) => category.id === categoryId)) setCategoryId(categories[0]?.id ?? 0);
  }, [categories, categoryId]);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || busy) return;
    const normalizedContent = normalizePromptContent(content);
    if (!normalizedContent) {
      setError("Добавьте текст промпта.");
      event.currentTarget.querySelector<HTMLTextAreaElement>("textarea[required]")?.focus();
      return;
    }
    if (!selectedCategory) { setError("Выберите категорию промпта."); return; }
    if (showTelegramPublish && publishToPinterest && !validatePinterestPublishValue(pinterestPublish, publishToTelegram)) {
      setPinterestValidationAttempted(true);
      setError("Проверьте название, описание и ссылку в блоке Pinterest.");
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    setError("");
    const { coverMediaUrl, coverMediaType, examples } = splitPromptMediaItems(mediaItems);
    try {
      await onSubmit({
        userId: user.id || 1,
        content: normalizedContent,
        categoryId,
        coverMediaUrl, coverMediaType, examples,
        publishToTelegram: showTelegramPublish ? publishToTelegram : undefined,
        publishToPinterest: showTelegramPublish ? publishToPinterest : undefined,
        ...(showTelegramPublish && publishToPinterest ? {
          pinterestTitle: pinterestPublish.title.trim(),
          pinterestDescription: pinterestPublish.description.trim(),
          ...(!publishToTelegram ? { telegramPostUrl: pinterestPublish.link.trim() } : {})
        } : {}),
        ...templatesPayloadForApi(publicationTemplates)
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить промпт. Попробуйте ещё раз.");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  const destinationSummary = !showTelegramPublish || (!publishToTelegram && !publishToPinterest)
    ? "Только в библиотеку"
    : publishToTelegram && publishToPinterest ? "Telegram → подтверждение пина"
      : publishToTelegram ? "Библиотека и Telegram" : "Библиотека → подтверждение пина";
  const submitLabel = loading ? "Сохраняем…" : mediaUploading ? "Загружаем файлы…"
    : showTelegramPublish && publishToTelegram ? "Сохранить и опубликовать"
      : showTelegramPublish && publishToPinterest ? "Сохранить и проверить пин" : "Сохранить промпт";

  return (
    <form onSubmit={handleSubmit} className={`prompt-composer${layout === "webFullscreen" ? " prompt-composer--fullscreen" : ""}`}>
      {layout === "default" ? <header className="composer-page-heading"><h1>Новый промпт</h1><p>Добавьте текст и примеры, затем выберите публикацию.</p></header> : null}
      <fieldset disabled={loading} className="composer-fields">
        <div className="composer-layout">
          <div className="composer-main">
            <section className="composer-card composer-text-section" aria-labelledby="composer-text-title">
              <div className="composer-section-head">
                <div><FileText size={17} /><label id="composer-text-title" htmlFor="composer-content">Текст промпта</label></div>
                <span className="composer-required">Обязательно</span>
              </div>
              <p id="composer-content-help" className="composer-help">Вставьте готовый промпт. Абзацы и переносы сохранятся.</p>
              <PromptContentTextarea id="composer-content" describedBy="composer-content-help" required value={content} onChange={setContent} rows={12}
                placeholder="Опишите идею, сцену, стиль и детали результата…" className="composer-textarea" />
              <div className="composer-text-meta"><span>{content.trim() ? "Название сформируется автоматически" : "Начните с текста"}</span><span>{content.length.toLocaleString("ru-RU")} знаков</span></div>
            </section>

            <section className="composer-card composer-media-section" aria-labelledby="composer-media-title">
              <div className="composer-section-head"><div><Images size={17} /><h2 id="composer-media-title">Примеры результата</h2></div><span>Необязательно</span></div>
              <PromptMediaGalleryEditor label="" presentation="dropzone" items={mediaItems} onChange={setMediaItems} onUploadingChange={setMediaUploading} disabled={loading} />
            </section>
          </div>

          <aside className="composer-sidebar">
            <section className="composer-card composer-card-preview" aria-label="Название и категория">
              <p className="composer-eyebrow">Название в библиотеке</p>
              <h2 className={`composer-auto-title${!autoTitle ? " is-empty" : ""}`}>{autoTitle || "Название появится здесь"}</h2>
              <p className="composer-help">2–3 слова на языке промпта.</p>
              <div className="composer-category-field">
                <label htmlFor="composer-category">Категория</label>
                <select id="composer-category" value={categoryId} onChange={(event) => setCategoryId(Number(event.target.value))} className="form-select" required disabled={!categories.length}>
                  {!categories.length ? <option value={0}>Категории загружаются…</option> : categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
            </section>

            {showTelegramPublish ? <section className="composer-card composer-publishing" aria-labelledby="composer-publish-title">
              <div className="composer-section-head"><h2 id="composer-publish-title">Публикация</h2><span>По желанию</span></div>
              <p className="composer-help">Без выбора площадок промпт сохранится только в библиотеке.</p>
              <label className={`composer-channel${publishToTelegram ? " is-selected" : ""}`}>
                <input type="checkbox" checked={publishToTelegram} onChange={(event) => setPublishToTelegram(event.target.checked)} />
                <Send size={18} /><span><strong>Telegram</strong><small>Отправить новый пост в канал</small></span><span className="composer-channel-check" aria-hidden="true">{publishToTelegram ? <Check size={13} /> : null}</span>
              </label>
              <label className={`composer-channel${publishToPinterest ? " is-selected" : ""}`}>
                <input type="checkbox" checked={publishToPinterest} onChange={(event) => setPublishToPinterest(event.target.checked)} />
                <Pin size={18} /><span><strong>Pinterest</strong><small>Проверить и подтвердить создание пина</small></span><span className="composer-channel-check" aria-hidden="true">{publishToPinterest ? <Check size={13} /> : null}</span>
              </label>
              {publishToTelegram ? <div className="composer-telegram-settings">
                <PublicationTemplatesEditor content={content} categoryName={selectedCategory?.name ?? "Категория"} tagNames={keywordsPreview} value={publicationTemplates} onChange={setPublicationTemplates} showPinterestSection={false} />
              </div> : null}
              <PinterestPublishFields enabled={publishToPinterest} publishToTelegram={publishToTelegram} promptContent={content}
                categoryName={selectedCategory?.name ?? "Категория"} value={pinterestPublish} onChange={setPinterestPublish} showErrors={pinterestValidationAttempted} />
            </section> : null}
          </aside>
        </div>
      </fieldset>

      <footer className="composer-footer">
        <div className="composer-footer-inner">
          {error ? <p className="composer-error" role="alert">{error}</p> : null}
          <p className="composer-save-summary">{autoTitle ? <span className="composer-save-title">{autoTitle}</span> : null}<span>{mediaUploading ? "Дождитесь окончания загрузки файлов" : destinationSummary}</span></p>
          <div className="composer-actions">
            <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">Отмена</button>
            <button disabled={busy || !categories.length} type="submit" className="btn-primary">{submitLabel}{!busy ? <ArrowRight size={15} /> : null}</button>
          </div>
        </div>
      </footer>
    </form>
  );
}

import { useMemo, useState, type FormEvent } from "react";
import type { Category, PromptCreatePayload, TelegramUser } from "../types";
import { MediaUploader } from "./MediaUploader";

type Props = {
  categories: Category[];
  user: TelegramUser;
  onSubmit: (payload: PromptCreatePayload) => Promise<void>;
  onCancel: () => void;
};

function previewKeywords(content: string) {
  const clean = content.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
  return [...new Set(clean.split(/\s+/).filter((word) => word.length > 4))].slice(0, 8);
}

export function PromptForm({ categories, user, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id ?? 1);
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [coverMedia, setCoverMedia] = useState<{ url: string; type: "image" | "video" } | undefined>();
  const [examples, setExamples] = useState<Array<{ url: string; type: "image" | "video"; originalName?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const keywordsPreview = useMemo(() => previewKeywords(content), [content]);

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
        examples
      });
    } catch {
      setError("Не удалось сохранить промпт.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
      <div className="flex flex-wrap gap-2">
        {keywordsPreview.map((word) => (
          <span key={word} className="tag-pill bg-[var(--primary-soft)] text-[var(--primary)]">
            #{word}
          </span>
        ))}
      </div>

      <div className="upload-zone">
        <MediaUploader
          label="Заставка/превью (image или video)"
          onUploaded={(items) => {
            if (items[0]) setCoverMedia(items[0]);
          }}
        />
      </div>
      <div className="upload-zone">
        <MediaUploader label="Примеры результата (несколько image/video)" multiple onUploaded={(items) => setExamples((prev) => [...prev, ...items])} />
      </div>

      <div>
        <label className="mb-2 block text-sm text-[var(--muted)]">Заметка (optional)</label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="form-textarea min-h-[80px]" />
      </div>
      {error && <p className="text-xs text-[var(--red)]">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button disabled={loading} type="submit" className="btn-primary justify-center">
          {loading ? "Сохраняем..." : "Сохранить промпт"}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Отмена
        </button>
      </div>
    </form>
  );
}

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
        <label className="mb-2 block text-sm text-muted">Название промпта</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-card px-4 py-3 text-sm" />
      </div>
      <div>
        <label className="mb-2 block text-sm text-muted">Категория</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(Number(e.target.value))}
          className="w-full rounded-2xl border border-white/10 bg-card px-4 py-3 text-sm"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-2 block text-sm text-muted">Текст промпта</label>
        <textarea
          required
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-card px-4 py-3 text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {keywordsPreview.map((word) => (
          <span key={word} className="rounded-lg bg-primary/20 px-2 py-1 text-xs text-indigo-100">
            #{word}
          </span>
        ))}
      </div>

      <MediaUploader
        label="Заставка/превью (image или video)"
        onUploaded={(items) => {
          if (items[0]) setCoverMedia(items[0]);
        }}
      />
      <MediaUploader
        label="Примеры результата (несколько image/video)"
        multiple
        onUploaded={(items) => setExamples((prev) => [...prev, ...items])}
      />

      <div>
        <label className="mb-2 block text-sm text-muted">Заметка (optional)</label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-card px-4 py-3 text-sm" />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button disabled={loading} type="submit" className="rounded-2xl bg-gradient-to-r from-primary to-primary-2 px-4 py-3 text-sm font-medium">
          {loading ? "Сохраняем..." : "Сохранить промпт"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
          Отмена
        </button>
      </div>
    </form>
  );
}

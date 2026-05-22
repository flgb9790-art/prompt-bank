import { useState, type ChangeEvent } from "react";
import { api } from "../api";
import type { MediaType } from "../types";

type UploadedMedia = { url: string; type: MediaType; originalName?: string };

type Props = {
  label: string;
  multiple?: boolean;
  compact?: boolean;
  onUploaded: (files: UploadedMedia[]) => void;
};

export function MediaUploader({ label, multiple, compact = false, onUploaded }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || !files.length) return;
    setLoading(true);
    setError("");
    try {
      const uploaded = await Promise.all(Array.from(files).map((file) => api.upload(file)));
      onUploaded(uploaded);
      event.target.value = "";
    } catch {
      setError("Не удалось загрузить файл.");
    } finally {
      setLoading(false);
    }
  }

  if (compact) {
    return (
      <div className="media-uploader-compact">
        <label className="media-uploader-compact-label">
          <span className="sr-only">{label}</span>
          <input
            type="file"
            multiple={multiple}
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            className="media-uploader-compact-input"
            onChange={handleChange}
          />
          <span className="media-uploader-compact-text">{loading ? "Загрузка..." : label}</span>
        </label>
        {error ? <p className="media-uploader-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="media-uploader-block">
      <label className="mb-2 block text-sm text-[var(--muted)]">{label}</label>
      <input
        type="file"
        multiple={multiple}
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        className="form-input cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--primary-soft)] file:px-3 file:py-1.5 file:text-sm file:text-[var(--primary)]"
        onChange={handleChange}
      />
      {loading && <p className="mt-2 text-xs text-[var(--muted)]">Загрузка...</p>}
      {error && <p className="mt-2 text-xs text-[var(--red)]">{error}</p>}
    </div>
  );
}

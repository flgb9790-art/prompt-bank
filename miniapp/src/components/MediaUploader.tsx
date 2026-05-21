import { useState, type ChangeEvent } from "react";
import { api } from "../api";
import type { MediaType } from "../types";

type UploadedMedia = { url: string; type: MediaType; originalName?: string };

type Props = {
  label: string;
  multiple?: boolean;
  onUploaded: (files: UploadedMedia[]) => void;
};

export function MediaUploader({ label, multiple, onUploaded }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || !files.length) return;
    setLoading(true);
    setError("");
    try {
      const uploaded: UploadedMedia[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await api.upload(file));
      }
      onUploaded(uploaded);
    } catch {
      setError("Не удалось загрузить файл.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <label className="mb-2 block text-sm text-muted">{label}</label>
      <input
        type="file"
        multiple={multiple}
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        className="w-full rounded-xl border border-white/10 bg-card px-3 py-2 text-sm"
        onChange={handleChange}
      />
      {loading && <p className="mt-2 text-xs text-muted">Загрузка...</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

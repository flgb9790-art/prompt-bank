import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { api } from "../api";
import type { MediaType } from "../types";

type UploadedMedia = { url: string; type: MediaType; originalName?: string };

type Props = {
  label: string;
  multiple?: boolean;
  compact?: boolean;
  presentation?: "compact" | "dropzone";
  disabled?: boolean;
  onUploadingChange?: (busy: boolean) => void;
  onUploaded: (files: UploadedMedia[]) => void;
};

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]);
const accept = [...acceptedTypes].join(",");
const maxFileSize = 40 * 1024 * 1024;

export function MediaUploader({ label, multiple, compact = false, presentation, disabled = false, onUploadingChange, onUploaded }: Props) {
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const inputId = useId();
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const dragDepthRef = useRef(0);
  const callbacksRef = useRef({ onUploaded, onUploadingChange, disabled });
  callbacksRef.current = { onUploaded, onUploadingChange, disabled };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (busyRef.current) callbacksRef.current.onUploadingChange?.(false);
    };
  }, []);

  async function uploadFiles(selected: File[]) {
    if (busyRef.current || callbacksRef.current.disabled || !selected.length) return;
    const files = multiple ? selected : selected.slice(0, 1);
    const valid = files.filter((file) => acceptedTypes.has(file.type) && file.size <= maxFileSize);
    const unsupported = files.filter((file) => !acceptedTypes.has(file.type)).length;
    const tooLarge = files.filter((file) => acceptedTypes.has(file.type) && file.size > maxFileSize).length;
    const warnings = [
      unsupported ? `Неподдерживаемый формат: ${unsupported}. Выберите JPEG, PNG, WebP, MP4 или WebM.` : "",
      tooLarge ? `Файлов больше 40 МБ: ${tooLarge}. Выберите файлы меньшего размера.` : ""
    ].filter(Boolean);
    setError(warnings.join(" "));
    setStatus("");
    if (!valid.length) return;

    busyRef.current = true;
    setLoading(true);
    setProgress({ completed: 0, total: valid.length });
    callbacksRef.current.onUploadingChange?.(true);
    const uploaded: UploadedMedia[] = [];
    const failedNames: string[] = [];
    let completed = 0;
    try {
      // Bound concurrency when a large photo selection is dropped at once.
      for (let offset = 0; offset < valid.length; offset += 3) {
        const results = await Promise.allSettled(valid.slice(offset, offset + 3).map(async (file) => {
          try {
            return await api.upload(file);
          } finally {
            completed += 1;
            if (mountedRef.current) setProgress({ completed, total: valid.length });
          }
        }));
        for (const [index, result] of results.entries()) {
          if (result.status === "fulfilled") uploaded.push(result.value);
          else failedNames.push(valid[offset + index].name);
        }
        if (!mountedRef.current) break;
      }
      if (!mountedRef.current) return;
      if (uploaded.length) {
        callbacksRef.current.onUploaded(uploaded);
        setStatus(`Добавлено файлов: ${uploaded.length}.`);
      }
      if (failedNames.length) {
        const names = failedNames.slice(0, 3).map((name) => name.length > 60 ? `${name.slice(0, 57)}…` : name).join(", ");
        warnings.push(`Не удалось загрузить: ${names}${failedNames.length > 3 ? ` и ещё ${failedNames.length - 3}` : ""}. Попробуйте добавить их ещё раз.${uploaded.length ? " Остальные файлы уже добавлены." : ""}`);
      }
      setError(warnings.join(" "));
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        callbacksRef.current.onUploadingChange?.(false);
      }
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    // Allow the same failed file to be selected again.
    event.currentTarget.value = "";
    void uploadFiles(files);
  }

  function handleDragEnter(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (!event.dataTransfer.types.includes("Files")) return;
    dragDepthRef.current += 1;
    if (!disabled && !busyRef.current) setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (!dragDepthRef.current) setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setDragging(false);
    void uploadFiles(Array.from(event.dataTransfer.files));
  }

  const blocked = loading || disabled;
  const loadingText = `Загрузка ${progress.completed} из ${progress.total}…`;
  const feedback = <>
    {status && !loading ? <p className="composer-upload-status" role="status">{status}</p> : null}
    {error ? <p className="composer-upload-error media-uploader-error" role="alert">{error}</p> : null}
  </>;

  if (presentation === "dropzone") {
    return (
      <div className="composer-uploader" aria-busy={loading}>
        <label className={`composer-dropzone${dragging ? " is-dragging" : ""}${blocked ? " is-disabled" : ""}`}
          htmlFor={inputId} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = blocked ? "none" : "copy"; }}
          onDrop={handleDrop}>
          <input id={inputId} type="file" multiple={multiple} accept={accept} className="composer-dropzone-input sr-only"
            aria-label={label} disabled={blocked} onChange={handleChange} />
          <Upload className="composer-dropzone-icon" size={22} aria-hidden="true" />
          <span className="composer-dropzone-title" role={loading ? "status" : undefined}>{loading ? loadingText : label}</span>
          <span className="composer-dropzone-hint">Перетащите файлы сюда или нажмите для выбора</span>
          <span className="composer-dropzone-hint">JPEG, PNG, WebP, MP4, WebM · до 40 МБ на файл</span>
        </label>
        {feedback}
      </div>
    );
  }

  if (compact || presentation === "compact") {
    return (
      <div className="media-uploader-compact" aria-busy={loading}>
        <label className="media-uploader-compact-label">
          <span className="sr-only">{label}</span>
          <input
            type="file"
            multiple={multiple}
            accept={accept}
            className="media-uploader-compact-input"
            onChange={handleChange}
            disabled={blocked}
          />
          <span className="media-uploader-compact-text" role={loading ? "status" : undefined}>{loading ? loadingText : label}</span>
        </label>
        {feedback}
      </div>
    );
  }

  return (
    <div className="media-uploader-block" aria-busy={loading}>
      <label htmlFor={inputId} className="mb-2 block text-sm text-[var(--muted)]">{label}</label>
      <input
        type="file"
        id={inputId}
        multiple={multiple}
        accept={accept}
        disabled={blocked}
        className="form-input cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--primary-soft)] file:px-3 file:py-1.5 file:text-sm file:text-[var(--primary)]"
        onChange={handleChange}
      />
      {loading ? <p className="composer-upload-status" role="status">{loadingText}</p> : null}
      {feedback}
    </div>
  );
}

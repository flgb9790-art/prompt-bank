import type { ClipboardEvent } from "react";
import { plainTextFromClipboard } from "../utils/promptContentFormat";

type Props = {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  required?: boolean;
  placeholder?: string;
  className?: string;
};

export function PromptContentTextarea({
  value,
  onChange,
  rows = 8,
  required = false,
  placeholder = "Текст промпта",
  className = "form-textarea prompt-content-textarea"
}: Props) {
  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const html = event.clipboardData.getData("text/html");
    if (!html.trim()) return;

    event.preventDefault();
    const textarea = event.currentTarget;
    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? start;
    const inserted = plainTextFromClipboard(event.clipboardData);
    const next = value.slice(0, start) + inserted + value.slice(end);
    onChange(next);
    const pos = start + inserted.length;
    requestAnimationFrame(() => {
      textarea.selectionStart = pos;
      textarea.selectionEnd = pos;
    });
  }

  return (
    <textarea
      required={required}
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onPaste={handlePaste}
      className={className}
      placeholder={placeholder}
      spellCheck
    />
  );
}

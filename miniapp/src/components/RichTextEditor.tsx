import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Link2, Strikethrough } from "lucide-react";
import { plainTemplateToHtml } from "../utils/templateHtml";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
};

export function RichTextEditor({ value, onChange, placeholder, minHeight = 140 }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" }
      }),
      Placeholder.configure({ placeholder: placeholder ?? "Введите текст…" })
    ],
    content: plainTemplateToHtml(value),
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    editorProps: {
      attributes: {
        class: "rich-text-editor-content"
      }
    }
  });

  useEffect(() => {
    if (!editor) return;
    const next = plainTemplateToHtml(value);
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  function setLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL ссылки", previous ?? "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  if (!editor) return null;

  return (
    <div className="rich-text-editor">
      <div className="rich-text-editor-toolbar" role="toolbar" aria-label="Форматирование">
        <button
          type="button"
          className={`rich-text-editor-btn ${editor.isActive("bold") ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Жирный"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          className={`rich-text-editor-btn ${editor.isActive("italic") ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Курсив"
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          className={`rich-text-editor-btn ${editor.isActive("strike") ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Зачёркнутый"
        >
          <Strikethrough size={16} />
        </button>
        <button
          type="button"
          className={`rich-text-editor-btn ${editor.isActive("link") ? "active" : ""}`}
          onClick={setLink}
          title="Ссылка"
        >
          <Link2 size={16} />
        </button>
        <span className="rich-text-editor-toolbar-hint">Выделите текст → «Ссылка»</span>
      </div>
      <div className="rich-text-editor-body" style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

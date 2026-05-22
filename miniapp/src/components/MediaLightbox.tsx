import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { resolveMediaUrl } from "../api";
import type { MediaType } from "../types";

export type LightboxItem = {
  url: string;
  type: MediaType;
  label?: string;
};

type Props = {
  items: LightboxItem[];
  initialIndex?: number;
  onClose: () => void;
};

export function MediaLightbox({ items, initialIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const current = items[index];

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, items]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") setIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
      if (event.key === "ArrowRight") setIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items.length, onClose]);

  if (!current || !items.length) return null;

  return (
    <div className="media-lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <div className="media-lightbox-panel" onClick={(event) => event.stopPropagation()}>
        <div className="media-lightbox-header">
          <p className="media-lightbox-caption">
            {current.label ?? "Медиа"} · {index + 1} / {items.length}
          </p>
          <button type="button" className="btn-ghost-icon h-9 w-9" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        <div className="media-lightbox-stage">
          {items.length > 1 ? (
            <button
              type="button"
              className="media-lightbox-nav"
              onClick={() => setIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1))}
              aria-label="Предыдущее"
            >
              <ChevronLeft size={22} />
            </button>
          ) : null}

          <div className="media-lightbox-media">
            {current.type === "video" ? (
              <video src={resolveMediaUrl(current.url)} controls autoPlay className="media-lightbox-video" />
            ) : (
              <img src={resolveMediaUrl(current.url)} alt={current.label ?? "media"} className="media-lightbox-image" />
            )}
          </div>

          {items.length > 1 ? (
            <button
              type="button"
              className="media-lightbox-nav"
              onClick={() => setIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0))}
              aria-label="Следующее"
            >
              <ChevronRight size={22} />
            </button>
          ) : null}
        </div>

        {items.length > 1 ? (
          <div className="media-lightbox-thumbs">
            {items.map((item, itemIndex) => (
              <button
                key={`${item.url}-${itemIndex}`}
                type="button"
                className={`media-lightbox-thumb ${itemIndex === index ? "active" : ""}`}
                onClick={() => setIndex(itemIndex)}
              >
                {item.type === "video" ? (
                  <video src={resolveMediaUrl(item.url)} muted playsInline />
                ) : (
                  <img src={resolveMediaUrl(item.url)} alt="" />
                )}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

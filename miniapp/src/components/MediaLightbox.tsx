import { useEffect, useState, type TouchEvent, type WheelEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { resolveMediaUrl } from "../api";
import type { MediaType } from "../types";
import { useHorizontalSwipe } from "../hooks/useHorizontalSwipe";
import { useMediaMinWidth } from "../hooks/useMediaMinWidth";

export type LightboxItem = {
  url: string;
  type: MediaType;
  label?: string;
};

type Props = {
  items: LightboxItem[];
  initialIndex?: number;
  isTelegramMiniApp?: boolean;
  onClose: () => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 3;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function MediaLightbox({ items, initialIndex = 0, isTelegramMiniApp = false, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [mediaReady, setMediaReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const showNavButtons = useMediaMinWidth(768) && !isTelegramMiniApp;
  const current = items[index];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, items]);

  useEffect(() => {
    setScale(1);
    setMediaReady(false);
  }, [index, current?.url]);

  useEffect(() => {
    if (!isTelegramMiniApp) return;
    const webApp = window.Telegram?.WebApp;
    if (!webApp?.BackButton) return;

    const backButton = webApp.BackButton;
    backButton.show();
    const handleBack = () => onClose();
    backButton.onClick(handleBack);
    return () => {
      backButton.offClick(handleBack);
      backButton.hide();
    };
  }, [isTelegramMiniApp, onClose]);

  useEffect(() => {
    const scrollRoot = document.querySelector<HTMLElement>(".mobile-frame");
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = scrollRoot?.style.overflow;

    if (isTelegramMiniApp) {
      if (scrollRoot) scrollRoot.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      if (scrollRoot) scrollRoot.style.overflow = previousRootOverflow ?? "";
    };
  }, [isTelegramMiniApp]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (scale > 1) return;
      if (event.key === "ArrowLeft") setIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
      if (event.key === "ArrowRight") setIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items.length, onClose, scale]);

  const swipe = useHorizontalSwipe(
    () => setIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0)),
    () => setIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1)),
    scale === 1 && items.length > 1
  );

  function goPrev() {
    setIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
  }

  function goNext() {
    setIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
  }

  function resetZoom() {
    setScale(1);
  }

  function adjustZoom(delta: number) {
    setScale((prev) => {
      const next = clamp(prev + delta, MIN_SCALE, MAX_SCALE);
      return next <= 1 ? 1 : next;
    });
  }

  function onWheel(event: WheelEvent) {
    if (isTelegramMiniApp || current?.type !== "image") return;
    event.preventDefault();
    adjustZoom(event.deltaY < 0 ? 0.2 : -0.2);
  }

  function onDoubleClick() {
    if (current?.type !== "image") return;
    setScale((prev) => (prev > 1 ? 1 : 2));
  }

  function onTouchStart(event: TouchEvent) {
    if (scale === 1) swipe.onTouchStart(event);
  }

  function onTouchEnd(event: TouchEvent) {
    if (scale === 1) swipe.onTouchEnd(event);
  }

  if (!mounted || !current || !items.length) return null;

  const zoomPercent = Math.round(scale * 100);
  const imageUrl = resolveMediaUrl(current.url);

  const content = (
    <div
      className={`media-lightbox${isTelegramMiniApp ? " media-lightbox--mini" : ""}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="media-lightbox-panel" onClick={(event) => event.stopPropagation()}>
        <div className="media-lightbox-toolbar">
          <p className="media-lightbox-caption">
            {current.label ?? "Медиа"} · {index + 1} / {items.length}
          </p>
          <div className="media-lightbox-toolbar-actions">
            {current.type === "image" ? (
              <div className="media-lightbox-zoom-controls">
                <button type="button" className="media-lightbox-tool-btn" onClick={() => adjustZoom(-0.25)} aria-label="Уменьшить">
                  <ZoomOut size={18} />
                </button>
                <span className="media-lightbox-zoom-label">{zoomPercent}%</span>
                <button type="button" className="media-lightbox-tool-btn" onClick={() => adjustZoom(0.25)} aria-label="Увеличить">
                  <ZoomIn size={18} />
                </button>
                <button
                  type="button"
                  className="media-lightbox-tool-btn"
                  onClick={resetZoom}
                  disabled={scale === 1}
                  aria-label="Сбросить масштаб"
                >
                  <RotateCcw size={17} />
                </button>
              </div>
            ) : null}
            <button type="button" className="media-lightbox-tool-btn" onClick={onClose} aria-label="Закрыть">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="media-lightbox-stage">
          {items.length > 1 && showNavButtons ? (
            <button type="button" className="media-lightbox-nav" onClick={goPrev} aria-label="Предыдущее">
              <ChevronLeft size={22} />
            </button>
          ) : null}

          <div
            className={`media-lightbox-viewport${scale > 1 ? " is-zoomed" : ""}`}
            onWheel={onWheel}
            onDoubleClick={onDoubleClick}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {!mediaReady ? <div className="media-lightbox-loader" aria-hidden /> : null}
            <div
              className="media-lightbox-media"
              style={scale > 1 ? { transform: `scale(${scale})` } : undefined}
            >
              {current.type === "video" ? (
                <video
                  src={imageUrl}
                  controls
                  playsInline
                  className={`media-lightbox-video${mediaReady ? " is-ready" : ""}`}
                  onLoadedData={() => setMediaReady(true)}
                />
              ) : (
                <img
                  src={imageUrl}
                  alt={current.label ?? "media"}
                  className={`media-lightbox-image${mediaReady ? " is-ready" : ""}`}
                  draggable={false}
                  onLoad={() => setMediaReady(true)}
                  onError={() => setMediaReady(true)}
                />
              )}
            </div>
          </div>

          {items.length > 1 && showNavButtons ? (
            <button type="button" className="media-lightbox-nav" onClick={goNext} aria-label="Следующее">
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

  return createPortal(content, document.body);
}

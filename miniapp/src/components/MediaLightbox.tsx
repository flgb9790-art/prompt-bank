import { useEffect, useState, type TouchEvent, type WheelEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { resolveCardMediaUrl, resolveMediaUrl } from "../api";
import type { MediaType } from "../types";
import { useHorizontalSwipe } from "../hooks/useHorizontalSwipe";
import { useMediaMinWidth } from "../hooks/useMediaMinWidth";
import { usePinchZoom } from "../hooks/usePinchZoom";
import { lockTelegramViewport } from "../utils/telegramViewport";

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

function clampIndex(value: number, length: number) {
  if (length <= 0) return 0;
  return clamp(value, 0, length - 1);
}

export function MediaLightbox({ items, initialIndex = 0, isTelegramMiniApp = false, onClose }: Props) {
  const [index, setIndex] = useState(() => clampIndex(initialIndex, items.length));
  const [scale, setScale] = useState(1);
  const [mediaReady, setMediaReady] = useState(false);
  const showNavButtons = useMediaMinWidth(768) && !isTelegramMiniApp;
  const safeIndex = clampIndex(index, items.length);
  const current = items[safeIndex];
  const zoomOnImageOnly = isTelegramMiniApp && current?.type === "image";
  const pinchZoom = usePinchZoom(zoomOnImageOnly);
  const activeScale = zoomOnImageOnly ? pinchZoom.scale : scale;
  const setActiveScale = zoomOnImageOnly ? pinchZoom.setScale : setScale;

  useEffect(() => {
    setIndex(clampIndex(initialIndex, items.length));
  }, [initialIndex, items.length]);

  useEffect(() => {
    setScale(1);
    pinchZoom.resetScale();
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
      if (activeScale > 1) return;
      if (event.key === "ArrowLeft") setIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
      if (event.key === "ArrowRight") setIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeScale, items.length, onClose]);

  useEffect(() => {
    if (!isTelegramMiniApp) return;
    lockTelegramViewport();
    const preventGesture = (event: Event) => {
      if (event.cancelable) event.preventDefault();
    };
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("gestureend", preventGesture, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
    };
  }, [isTelegramMiniApp]);

  const swipe = useHorizontalSwipe(
    () => setIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0)),
    () => setIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1)),
    activeScale === 1 && items.length > 1
  );

  function goPrev() {
    setIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
  }

  function goNext() {
    setIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
  }

  function resetZoom() {
    setScale(1);
    pinchZoom.resetScale();
  }

  function adjustZoom(delta: number) {
    setActiveScale((prev) => {
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
    setActiveScale((prev) => (prev > 1 ? 1 : 2));
  }

  function onTouchStart(event: TouchEvent) {
    if (activeScale === 1 && event.touches.length < 2) swipe.onTouchStart(event);
  }

  function onTouchEnd(event: TouchEvent) {
    if (activeScale === 1) swipe.onTouchEnd(event);
  }

  if (!current || !items.length) return null;

  const zoomPercent = Math.round(activeScale * 100);
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
            {current.label ?? "Медиа"} · {safeIndex + 1} / {items.length}
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
                  disabled={activeScale === 1}
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
            className={`media-lightbox-viewport${activeScale > 1 ? " is-zoomed" : ""}`}
            onWheel={onWheel}
            onDoubleClick={onDoubleClick}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {!mediaReady ? <div className="media-lightbox-loader" aria-hidden /> : null}
            <div className="media-lightbox-media">
              {current.type === "video" ? (
                <video
                  src={imageUrl}
                  controls
                  playsInline
                  className={`media-lightbox-video${mediaReady ? " is-ready" : ""}`}
                  style={!zoomOnImageOnly && activeScale > 1 ? { transform: `scale(${activeScale})` } : undefined}
                  onLoadedData={() => setMediaReady(true)}
                />
              ) : (
                <img
                  key={imageUrl}
                  src={imageUrl}
                  alt={current.label ?? "media"}
                  className={`media-lightbox-image${mediaReady ? " is-ready" : ""}`}
                  draggable={false}
                  style={
                    activeScale > 1
                      ? { transform: `scale(${activeScale})`, transformOrigin: "center center" }
                      : undefined
                  }
                  onLoad={() => setMediaReady(true)}
                  onError={() => setMediaReady(true)}
                  {...(zoomOnImageOnly ? pinchZoom.pinchHandlers : {})}
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
                className={`media-lightbox-thumb ${itemIndex === safeIndex ? "active" : ""}`}
                onClick={() => setIndex(itemIndex)}
              >
                {item.type === "video" ? (
                  <video src={resolveMediaUrl(item.url)} muted playsInline />
                ) : (
                  <img
                    src={resolveCardMediaUrl(item.url, "image")}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      const fallback = resolveMediaUrl(item.url);
                      if (event.currentTarget.src !== fallback) {
                        event.currentTarget.src = fallback;
                      }
                    }}
                  />
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

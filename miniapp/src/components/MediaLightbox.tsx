import React, { useEffect, useRef, useState, type TouchEvent, type WheelEvent } from "react";
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
const MAX_SCALE = 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function touchDistance(touches: React.TouchList) {
  const first = touches.item(0);
  const second = touches.item(1);
  if (!first || !second) return 0;
  const dx = first.clientX - second.clientX;
  const dy = first.clientY - second.clientY;
  return Math.hypot(dx, dy);
}

export function MediaLightbox({ items, initialIndex = 0, isTelegramMiniApp = false, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pinchRef = useRef<{ distance: number; baseScale: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const showNavButtons = useMediaMinWidth(768) && !isTelegramMiniApp;
  const current = items[index];

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, items]);

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    pinchRef.current = null;
    panRef.current = null;
  }, [index]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

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
    setOffset({ x: 0, y: 0 });
  }

  function adjustZoom(delta: number) {
    setScale((prev) => {
      const next = clamp(prev + delta, MIN_SCALE, MAX_SCALE);
      if (next <= 1) {
        setOffset({ x: 0, y: 0 });
        return 1;
      }
      return next;
    });
  }

  function onPointerDown(event: React.PointerEvent) {
    if (scale <= 1 || current?.type !== "image" || event.pointerType === "touch") return;
    panRef.current = { x: offset.x, y: offset.y, originX: event.clientX, originY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!panRef.current || scale <= 1) return;
    setOffset({
      x: panRef.current.x + (event.clientX - panRef.current.originX),
      y: panRef.current.y + (event.clientY - panRef.current.originY)
    });
  }

  function onPointerUp() {
    panRef.current = null;
  }

  function onWheel(event: WheelEvent) {
    if (current?.type !== "image") return;
    event.preventDefault();
    adjustZoom(event.deltaY < 0 ? 0.2 : -0.2);
  }

  function onDoubleClick() {
    if (current?.type !== "image") return;
    if (scale > 1) {
      resetZoom();
      return;
    }
    setScale(2);
  }

  function onTouchStart(event: TouchEvent) {
    swipe.onTouchStart(event);
    if (event.touches.length === 2 && current?.type === "image") {
      pinchRef.current = { distance: touchDistance(event.touches), baseScale: scale };
      panRef.current = null;
      return;
    }
    if (event.touches.length === 1 && scale > 1) {
      panRef.current = {
        x: offset.x,
        y: offset.y,
        originX: event.touches[0].clientX,
        originY: event.touches[0].clientY
      };
    }
  }

  function onTouchMove(event: TouchEvent) {
    if (event.touches.length === 2 && pinchRef.current && current?.type === "image") {
      const distance = touchDistance(event.touches);
      const ratio = distance / pinchRef.current.distance;
      setScale((prev) => {
        const next = clamp(pinchRef.current!.baseScale * ratio, MIN_SCALE, MAX_SCALE);
        if (next <= 1.02) {
          setOffset({ x: 0, y: 0 });
          return 1;
        }
        return next;
      });
      return;
    }
    if (event.touches.length === 1 && panRef.current && scale > 1) {
      const touch = event.touches[0];
      setOffset({
        x: panRef.current.x + (touch.clientX - panRef.current.originX),
        y: panRef.current.y + (touch.clientY - panRef.current.originY)
      });
    }
  }

  function onTouchEnd(event: TouchEvent) {
    swipe.onTouchEnd(event);
    if (event.touches.length < 2) pinchRef.current = null;
    if (event.touches.length === 0) panRef.current = null;
  }

  if (!current || !items.length) return null;

  const zoomPercent = Math.round(scale * 100);

  return (
    <div className="media-lightbox" onClick={onClose} role="dialog" aria-modal="true">
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
                  disabled={scale === 1 && offset.x === 0 && offset.y === 0}
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
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div
              className="media-lightbox-media"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`
              }}
            >
              {current.type === "video" ? (
                <video src={resolveMediaUrl(current.url)} controls autoPlay className="media-lightbox-video" />
              ) : (
                <img src={resolveMediaUrl(current.url)} alt={current.label ?? "media"} className="media-lightbox-image" draggable={false} />
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
}

import { useRef, useState, type TouchEvent } from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 3;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function touchDistance(touches: React.TouchList) {
  const first = touches.item(0);
  const second = touches.item(1);
  if (!first || !second) return 0;
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

export function usePinchZoom(enabled: boolean) {
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const pinchRef = useRef<{ distance: number; baseScale: number } | null>(null);

  scaleRef.current = scale;

  function resetScale() {
    setScale(1);
    pinchRef.current = null;
  }

  function onTouchStart(event: TouchEvent) {
    if (!enabled || event.touches.length !== 2) return;
    pinchRef.current = { distance: touchDistance(event.touches), baseScale: scaleRef.current };
  }

  function onTouchMove(event: TouchEvent) {
    if (!enabled || event.touches.length !== 2 || !pinchRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const distance = touchDistance(event.touches);
    const ratio = distance / pinchRef.current.distance;
    setScale(clamp(pinchRef.current.baseScale * ratio, MIN_SCALE, MAX_SCALE));
  }

  function onTouchEnd(event: TouchEvent) {
    if (event.touches.length < 2) pinchRef.current = null;
  }

  return {
    scale,
    setScale,
    resetScale,
    pinchHandlers: enabled
      ? { onTouchStart, onTouchMove, onTouchEnd }
      : { onTouchStart: undefined, onTouchMove: undefined, onTouchEnd: undefined }
  };
}

import { useRef, type TouchEvent } from "react";

type Handlers = {
  onTouchStart: (event: TouchEvent) => void;
  onTouchEnd: (event: TouchEvent) => void;
};

export function useHorizontalSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  enabled: boolean,
  thresholdPx = 44
): Handlers {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart(event) {
      if (!enabled || event.touches.length !== 1) return;
      startRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    },
    onTouchEnd(event) {
      if (!enabled || !startRef.current) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - startRef.current.x;
      const dy = touch.clientY - startRef.current.y;
      startRef.current = null;
      if (Math.abs(dx) < thresholdPx || Math.abs(dx) < Math.abs(dy) * 1.15) return;
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
    }
  };
}

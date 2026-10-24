import { useEffect, useRef, type RefObject } from "react";

export function useDialogFocus(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, paused = false) {
  const closeRef = useRef(onClose);
  const pausedRef = useRef(paused);
  closeRef.current = onClose;
  pausedRef.current = paused;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = ref.current;
    panel?.focus({ preventScroll: true });
    function handleKey(event: KeyboardEvent) {
      if (pausedRef.current || !panel) return;
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); closeRef.current(); return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'))
        .filter((element) => element.getClientRects().length > 0);
      const first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); panel.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [open, ref]);
}

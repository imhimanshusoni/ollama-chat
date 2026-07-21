import { useCallback, useEffect, useRef, type RefObject } from 'react';

// Pins a scroll container to its bottom without fighting native touch scrolling.
//
// The naive "scrollTop = scrollHeight on every token" approach freezes mobile
// scrolling: a programmatic scroll write that lands while the user's touch/fling
// is in flight cancels the native gesture (worst on Android Chrome). This hook
// avoids that by (a) never writing while a finger is down and (b) coalescing
// bursts of pin() calls into a single write per animation frame.
//
// Generic over the element type so callers can pass useRef<HTMLDivElement>(null)
// without a strict-TS invariance error on RefObject.
export function usePinToBottom<T extends HTMLElement>(
  ref: RefObject<T | null>,
  shouldPin: () => boolean,
) {
  const isTouchingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  // Keep the latest predicate without re-registering listeners or re-creating pin.
  const shouldPinRef = useRef(shouldPin);
  shouldPinRef.current = shouldPin;

  // Schedule a single rAF-batched pin. Repeated calls within a frame collapse
  // into one write. The not-touching / shouldPin checks run at write time (in
  // the frame callback), not at call time.
  const pin = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = ref.current;
      if (!el || isTouchingRef.current || !shouldPinRef.current()) return;
      el.scrollTop = el.scrollHeight;
    });
  }, [ref]);

  // Track finger-down state so pin() can bow out while the user is scrolling.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = () => {
      isTouchingRef.current = true;
    };
    const onTouchEnd = () => {
      isTouchingRef.current = false;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [ref]);

  return { pin, isTouchingRef };
}

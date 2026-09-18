/**
 * Raw pointer capture.
 *
 * The only part of the input domain that touches the DOM. It reports where the
 * finger went down and where it is now; `controls.ts` decides what that means.
 *
 * Listens on `window` rather than on the module's own overlay layer. That is a
 * deliberate exception to the rule that a module stays inside its own slice:
 * "input" is precisely the domain whose job is global, the game is fullscreen,
 * and routing touches through a stack of overlay layers would make the control
 * scheme depend on DOM ordering — which is exactly the kind of accidental
 * coupling between domains the architecture exists to prevent.
 */

import type { PointerSample } from './controls.js';

export interface PointerCapture {
  readonly sample: Readonly<PointerSample>;
  dispose(): void;
}

export function createPointerCapture(target: Window = window): PointerCapture {
  const sample: PointerSample = {
    active: false,
    originX: 0,
    originY: 0,
    currentX: 0,
    currentY: 0,
  };

  // Only the first finger down drives the car. A second touch is ignored
  // rather than fighting the first — no gesture in this game needs two.
  let activeId: number | null = null;

  function onDown(e: PointerEvent): void {
    if (activeId !== null) return;
    activeId = e.pointerId;
    sample.active = true;
    sample.originX = e.clientX;
    sample.originY = e.clientY;
    sample.currentX = e.clientX;
    sample.currentY = e.clientY;
  }

  function onMove(e: PointerEvent): void {
    if (e.pointerId !== activeId) return;
    sample.currentX = e.clientX;
    sample.currentY = e.clientY;
  }

  function onUp(e: PointerEvent): void {
    if (e.pointerId !== activeId) return;
    activeId = null;
    sample.active = false;
  }

  target.addEventListener('pointerdown', onDown, { passive: true });
  target.addEventListener('pointermove', onMove, { passive: true });
  target.addEventListener('pointerup', onUp, { passive: true });
  target.addEventListener('pointercancel', onUp, { passive: true });
  // A finger that leaves the window is a finger that has let go. Without this
  // the car would keep full lock after the thumb slid off the edge.
  target.addEventListener('pointerleave', onUp, { passive: true });
  target.addEventListener('blur', onBlur);

  function onBlur(): void {
    activeId = null;
    sample.active = false;
  }

  return {
    sample,
    dispose() {
      target.removeEventListener('pointerdown', onDown);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      target.removeEventListener('pointerleave', onUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}

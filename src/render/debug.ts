/**
 * Debug overlay: frame timings and framing guides.
 *
 * DOM rather than drawn in WebGL, so it costs nothing in the frame budget and
 * can't accidentally become load-bearing. Text is rewritten at a fixed low
 * rate rather than every frame — at 120 fps, DOM writes would themselves show
 * up in the numbers they are reporting.
 */

import type { LoopStats } from '../core/loop.js';
import type { Framing } from './framing.js';

export interface DebugOverlay {
  readonly element: HTMLElement;
  visible: boolean;
  setVisible(v: boolean): void;
  /** Adds or updates an arbitrary named value in the panel. */
  watch(key: string, value: string | number): void;
  /** Called every frame; throttles its own DOM writes. */
  update(stats: Readonly<LoopStats>, info: { drawCalls: number; triangles: number }, framing: Framing): void;
  dispose(): void;
}

const REFRESH_INTERVAL_S = 0.1;

export function createDebugOverlay(parent: HTMLElement): DebugOverlay {
  const root = document.createElement('div');
  root.className = 'debug-root';

  const panel = document.createElement('pre');
  panel.className = 'debug-panel';
  root.appendChild(panel);

  const guides = document.createElement('div');
  guides.className = 'debug-guides';
  root.appendChild(guides);

  const bands: Record<string, HTMLElement> = {};
  for (const name of ['header', 'aperture', 'dash', 'wheel']) {
    const el = document.createElement('div');
    el.className = 'debug-band';
    el.dataset.band = name;
    const label = document.createElement('span');
    label.textContent = name;
    el.appendChild(label);
    guides.appendChild(el);
    bands[name] = el;
  }

  const horizon = document.createElement('div');
  horizon.className = 'debug-horizon';
  guides.appendChild(horizon);

  parent.appendChild(root);

  const watched = new Map<string, string>();
  let visible = true;
  let sinceRefresh = 0;

  function layoutGuides(framing: Framing): void {
    for (const name of ['header', 'aperture', 'dash', 'wheel'] as const) {
      const r = framing[name];
      const el = bands[name];
      if (el === undefined) continue;
      el.style.top = `${r.y}px`;
      el.style.height = `${r.h}px`;
    }
    // Where the horizon lands inside the aperture, derived back out of the
    // camera pitch rather than from the authored fraction — so if the framing
    // maths and the camera ever disagree, this line visibly leaves the horizon.
    const ap = framing.aperture;
    const fromTop = (1 + Math.tan(framing.horizonPitch) / Math.tan(framing.vFov / 2)) / 2;
    horizon.style.top = `${ap.y + ap.h * fromTop}px`;
  }

  function redraw(stats: Readonly<LoopStats>, info: { drawCalls: number; triangles: number }, framing: Framing): void {
    const lines = [
      `${stats.fps.toFixed(0).padStart(3)} fps   ${stats.frameMs.toFixed(2)} ms`,
      `sim    ${stats.simMs.toFixed(2)} ms  (${stats.stepsLastFrame} steps)`,
      `render ${stats.renderMs.toFixed(2)} ms`,
      `draws  ${info.drawCalls}   tris ${info.triangles}`,
      `simT   ${stats.simTime.toFixed(1)} s`,
      stats.droppedFrames > 0 ? `DROPPED ${stats.droppedFrames}` : '',
      `view   ${framing.width}×${framing.height} @${framing.pixelRatio}`,
      `hfov   ${((framing.vFov * 180) / Math.PI).toFixed(1)}° v`,
    ].filter((l) => l !== '');

    for (const [k, v] of watched) lines.push(`${k.padEnd(6)} ${v}`);
    panel.textContent = lines.join('\n');
  }

  return {
    element: root,
    get visible() {
      return visible;
    },
    setVisible(v: boolean) {
      visible = v;
      root.style.display = v ? '' : 'none';
    },
    watch(key: string, value: string | number) {
      watched.set(key, typeof value === 'number' ? value.toFixed(2) : value);
    },
    update(stats, info, framing) {
      if (!visible) return;
      layoutGuides(framing);
      sinceRefresh += stats.frameMs / 1000;
      if (sinceRefresh < REFRESH_INTERVAL_S) return;
      sinceRefresh = 0;
      redraw(stats, info, framing);
    },
    dispose() {
      root.remove();
    },
  };
}

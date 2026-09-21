/**
 * Small always-on performance readout for device tuning.
 *
 * This deliberately lives beside the full debug overlay rather than in a UI
 * module: loop and renderer instrumentation are app-level concerns, and
 * pushing them through a gameplay contract would make development tooling part
 * of the game architecture. DOM writes are throttled so the meter does not
 * meaningfully change the numbers it reports.
 */

import type { LoopStats } from '../core/loop.js';
import type { Framing } from '../contracts/view.js';
import type { QualityTier } from '../render/tuning.js';

export interface PerformanceMeter {
  update(
    stats: Readonly<LoopStats>,
    info: { drawCalls: number; triangles: number },
    framing: Framing,
    quality: QualityTier,
  ): void;
  dispose(): void;
}

const REFRESH_INTERVAL_S = 0.25;

function compactCount(value: number): string {
  if (value < 1_000) return String(value);
  if (value < 1_000_000) return `${(value / 1_000).toFixed(value < 100_000 ? 1 : 0)}k`;
  return `${(value / 1_000_000).toFixed(1)}m`;
}

export function createPerformanceMeter(parent: HTMLElement): PerformanceMeter {
  const panel = document.createElement('pre');
  panel.className = 'performance-meter';
  panel.setAttribute('aria-label', 'Performance metrics');
  parent.appendChild(panel);

  let sinceRefresh = REFRESH_INTERVAL_S;
  let previousDroppedFrames = 0;

  return {
    update(stats, info, framing, quality) {
      sinceRefresh += stats.frameMs / 1000;
      if (sinceRefresh < REFRESH_INTERVAL_S) return;
      sinceRefresh = 0;

      const dropped = stats.droppedFrames - previousDroppedFrames;
      previousDroppedFrames = stats.droppedFrames;
      panel.classList.toggle('performance-meter--strained', stats.fps < 50 || dropped > 0);
      panel.textContent = [
        `${stats.fps.toFixed(0).padStart(3)} FPS  ${stats.frameMs.toFixed(1).padStart(4)} ms`,
        `SIM ${stats.simMs.toFixed(2)}  SUBMIT ${stats.renderMs.toFixed(2)} ms`,
        `${info.drawCalls} draws  ${compactCount(info.triangles)} tris`,
        `${quality}  ${framing.pixelRatio.toFixed(2)}x DPR${dropped > 0 ? `  DROP +${dropped}` : ''}`,
      ].join('\n');
    },
    dispose() {
      panel.remove();
    },
  };
}

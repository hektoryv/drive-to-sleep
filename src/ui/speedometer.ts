/** The first permanent HUD instrument: current road speed. */

import type { GameModule } from '../contracts/module.js';
import type { CarView } from '../contracts/vehicle.js';

export function formatSpeedKmh(speedMs: number): string {
  return String(Math.round(Math.max(0, speedMs) * 3.6));
}

export function createSpeedometerModule(): GameModule {
  let car: CarView | undefined;
  let value: HTMLSpanElement | undefined;
  let root: HTMLDivElement | undefined;
  let previous = '';

  return {
    name: 'ui',

    init(ctx) {
      root = document.createElement('div');
      root.className = 'speedometer';
      root.setAttribute('aria-label', 'Current speed');

      value = document.createElement('span');
      value.className = 'speedometer-value';
      value.textContent = '0';

      const unit = document.createElement('span');
      unit.className = 'speedometer-unit';
      unit.textContent = 'km/h';

      root.append(value, unit);
      ctx.overlay.appendChild(root);
    },

    start(ctx) {
      car = ctx.services.require('car');
    },

    frame() {
      if (car === undefined || value === undefined) return;
      const next = formatSpeedKmh(car.speedMs);
      if (next === previous) return;
      previous = next;
      value.textContent = next;
    },

    dispose() {
      root?.remove();
    },
  };
}

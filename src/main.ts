/**
 * Entry point: canvas, sizing, lifecycle.
 */

import { createGame } from './game.js';
import { installTestApi } from './test-api.js';
import type { FramingOverrides } from './render/framing.js';
import type { PlaceholderTime } from './render/placeholder-scene.js';

const canvas = document.getElementById('view') as HTMLCanvasElement | null;
const overlay = document.getElementById('overlay');

if (canvas === null || overlay === null) {
  throw new Error('index.html is missing #view or #overlay');
}

// Query parameters exist for the screenshot harness. They are not a feature.
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? '1') || 1;
const time = (params.get('time') ?? 'day') as PlaceholderTime;
const debugVisible = params.get('debug') !== '0';

/**
 * Framing overrides from the URL, so a sweep across several settings can be
 * shot in one harness run. Degrees in, radians out — degrees are what a person
 * types. The authored values in `VIEW` remain what the game ships with.
 */
function framingFromParams(): FramingOverrides {
  const o: FramingOverrides = {};
  const num = (k: string): number | undefined => {
    const raw = params.get(k);
    if (raw === null) return undefined;
    const v = Number(raw);
    return Number.isFinite(v) ? v : undefined;
  };
  const fov = num('fov');
  if (fov !== undefined) o.hFov = (fov * Math.PI) / 180;
  const aperture = num('aperture');
  if (aperture !== undefined) o.apertureFraction = aperture;
  const dash = num('dash');
  if (dash !== undefined) o.dashFraction = dash;
  const header = num('header');
  if (header !== undefined) o.headerFraction = header;
  const horizon = num('horizon');
  if (horizon !== undefined) o.horizonY = horizon;
  return o;
}

const game = createGame({
  canvas,
  overlayParent: overlay,
  seed,
  time,
  framing: framingFromParams(),
});
game.setDebugVisible(debugVisible);
game.setLookAheadEnabled(params.get('look') !== '0');

function applySize(): void {
  // visualViewport is the honest size inside a WebView with system bars; the
  // window dimensions can lie about it.
  const vv = window.visualViewport;
  const width = Math.round(vv?.width ?? window.innerWidth);
  const height = Math.round(vv?.height ?? window.innerHeight);
  game.resize(width, height, window.devicePixelRatio || 1);
}

applySize();
window.addEventListener('resize', applySize);
window.visualViewport?.addEventListener('resize', applySize);

// Stop simulating while backgrounded. Without this, returning to the app
// delivers one enormous frame delta and the loop spends its sub-step budget
// catching up on time the player wasn't there for.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.stop();
  else game.start();
});

const ready = new Promise<void>((resolve) => {
  const off = game.events.on('ready', () => {
    off();
    resolve();
  });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => game.events.emit('ready', { seed }));
  });
});

installTestApi(game, ready);
game.start();

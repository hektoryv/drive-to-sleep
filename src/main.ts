/**
 * Entry point: canvas, sizing, lifecycle. Everything else lives in `app/`.
 */

import { createApp } from './app/app.js';
import { installTestApi } from './app/test-api.js';
import type { FramingOverrides } from './contracts/view.js';

const canvas = document.getElementById('view') as HTMLCanvasElement | null;
const overlay = document.getElementById('overlay');

if (canvas === null || overlay === null) {
  throw new Error('index.html is missing #view or #overlay');
}

// Query parameters exist for the screenshot harness. They are not a feature.
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? '1') || 1;
const debugVisible = params.get('debug') !== '0';

/**
 * Framing overrides from the URL, so a sweep across several settings can be
 * shot in one harness run. Degrees in, radians out — degrees are what a person
 * types. The authored values in `render/tuning.ts` remain what the game ships.
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

const app = createApp({
  canvas,
  overlayRoot: overlay,
  seed,
  framing: framingFromParams(),
});
app.setDebugVisible(debugVisible);

function applySize(): void {
  // visualViewport is the honest size inside a WebView with system bars; the
  // window dimensions can lie about it.
  const vv = window.visualViewport;
  const width = Math.round(vv?.width ?? window.innerWidth);
  const height = Math.round(vv?.height ?? window.innerHeight);
  app.resize(width, height, window.devicePixelRatio || 1);
}

applySize();
window.addEventListener('resize', applySize);
window.visualViewport?.addEventListener('resize', applySize);

// Stop simulating while backgrounded. Without this, returning to the app
// delivers one enormous frame delta and the loop spends its sub-step budget
// catching up on time the player wasn't there for.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) app.stop();
  else app.start();
});

const ready = new Promise<void>((resolve) => {
  const off = app.events.on('ready', () => {
    off();
    resolve();
  });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => app.events.emit('ready', { seed }));
  });
});

const api = installTestApi(app, ready);
if (params.get('look') === '0') api.setLookAheadEnabled(false);
if (params.get('cam') === 'chase') api.setCameraMode('chase');

/** Named moments, so a URL can say `?time=golden` instead of `?time=0.76`. */
const MOMENTS: Record<string, number> = {
  midnight: 0.0,
  predawn: 0.19,
  dawn: 0.25,
  morning: 0.34,
  noon: 0.5,
  afternoon: 0.66,
  /** Sun ~2° up: the art target's moment. */
  golden: 0.735,
  /** Sun exactly on the horizon. */
  sunset: 0.75,
  dusk: 0.79,
  twilight: 0.86,
  night: 0.95,
  // Phase 0's three moods, kept so old commands still mean something.
  day: 0.5,
};
const timeParam = params.get('time');
if (timeParam !== null) {
  const named = MOMENTS[timeParam];
  const phase = named ?? Number(timeParam);
  if (Number.isFinite(phase)) api.setTime(phase);
}
if (params.get('auto') === '1') api.setAutopilot(true);

app.start();

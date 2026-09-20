/**
 * The screenshot harness — how this game gets looked at (ADR-0008).
 *
 *   npm run shoot -- --seed 7 --at 1200 --time dusk
 *   npm run shoot -- --sheet
 *
 * A single shot writes one PNG. `--sheet` runs a matrix of seeds, distances
 * and times of day and composites the results into one contact sheet, which is
 * the review unit for any visual change.
 *
 * Remember what this cannot do: it photographs stills. Feel, lean, latency and
 * the sense of speed are invisible here. Anything about motion needs a capture
 * or a real device — see ADR-0008 and the Phase 2 exit criterion.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  DEFAULT_DEVICE,
  parseArgs,
  startHarness,
  type Device,
  type ShotState,
} from './harness.js';

const args = parseArgs(process.argv.slice(2));

const outDir = resolve(args.get('out') ?? 'shots');
const device: Device = {
  width: Number(args.get('width') ?? DEFAULT_DEVICE.width),
  height: Number(args.get('height') ?? DEFAULT_DEVICE.height),
  dpr: Number(args.get('dpr') ?? DEFAULT_DEVICE.dpr),
};
const debug = args.get('debug') === 'true' || args.get('debug') === '1';
const sheet = args.get('sheet') === 'true';
const compare = args.get('compare') === 'true';
const sequence = args.get('sequence') === 'true';
const handling = args.get('handling') === 'true';

function optionalNumber(key: string): number | undefined {
  const raw = args.get(key);
  if (raw === undefined) return undefined;
  const v = Number(raw);
  return Number.isFinite(v) ? v : undefined;
}

/**
 * The day, at one place. The sky carries most of the mood in this game
 * (ADR-0007), so the sheet that matters most is the same view at every hour —
 * it shows whether the palette keyframes actually join up.
 */
const SHEET_MATRIX: ShotState[] = (
  ['predawn', 'dawn', 'morning', 'noon', 'afternoon', 'golden', 'sunset', 'dusk', 'twilight', 'night'] as const
).map((time) => ({ seed: 1, at: 1400, time, debug: false, label: time }));

/**
 * A sweep for judging the portrait framing by eye. Held at the same point on
 * the same curve so only the framing differs between frames.
 */
const COMPARE_MATRIX: ShotState[] = [
  { seed: 1, at: 780, time: 'day', debug: false, look: false, label: 'no look-ahead' },
  { seed: 1, at: 780, time: 'day', debug: false, label: 'look-ahead on' },
  { seed: 1, at: 780, time: 'day', debug: false, fov: 60, label: 'fov 60°' },
  { seed: 1, at: 780, time: 'day', debug: false, fov: 72, label: 'fov 72° (current)' },
  { seed: 1, at: 780, time: 'day', debug: false, fov: 84, label: 'fov 84°' },
  { seed: 1, at: 780, time: 'day', debug: false, aperture: 0.38, dash: 0.22, label: 'old bands 38/22' },
  { seed: 1, at: 780, time: 'day', debug: false, aperture: 0.46, dash: 0.15, label: 'new bands 46/15' },
  { seed: 1, at: 780, time: 'day', debug: false, aperture: 0.54, dash: 0.1, label: 'bands 54/10' },
];

/**
 * A run of frames through one stretch of road. Stills cannot show motion
 * (ADR-0008), but a strip through a corner is the closest a screenshot loop
 * gets: it shows what the view does as the road turns, which is exactly what
 * the look-ahead rig is for.
 */
function sequenceMatrix(): ShotState[] {
  const from = Number(args.get('from') ?? 640);
  const to = Number(args.get('to') ?? 940);
  const steps = Math.max(2, Number(args.get('steps') ?? 6));
  const look = args.get('look') !== '0';
  const out: ShotState[] = [];
  for (let i = 0; i < steps; i++) {
    const at = Math.round(from + ((to - from) * i) / (steps - 1));
    out.push({
      seed: Number(args.get('seed') ?? 1),
      at,
      time: args.get('time') ?? 'golden',
      debug,
      look,
      label: `${at}m${look ? '' : ' no-look'}`,
    });
  }
  return out;
}

/**
 * The car doing things, rather than the road being looked at.
 *
 * Each shot drives to the same point and then holds a fixed input for a couple
 * of seconds, so the body is caught where the physics put it. It is the only
 * way a still shows anything about Phase 2 at all — and even then it shows
 * where the lean ended up, never how it got there (ADR-0008).
 */
const HANDLING_MATRIX: ShotState[] = [
  { seed: 1, at: 900, time: 'day', debug: true, hold: { steer: 0, throttle: 0.6, brake: 0 }, holdS: 2, label: 'level (straight)' },
  { seed: 1, at: 900, time: 'day', debug: true, hold: { steer: 0.45, throttle: 0.6, brake: 0 }, holdS: 1.4, label: 'turning right' },
  { seed: 1, at: 900, time: 'day', debug: true, hold: { steer: -0.45, throttle: 0.6, brake: 0 }, holdS: 1.4, label: 'turning left' },
  { seed: 1, at: 900, time: 'day', debug: true, hold: { steer: 0, throttle: 0, brake: 1 }, holdS: 1, label: 'braking (dive)' },
  { seed: 1, at: 900, time: 'day', debug: false, cam: 'chase', hold: { steer: 0, throttle: 0.6, brake: 0 }, holdS: 2, label: 'chase level' },
  { seed: 1, at: 900, time: 'day', debug: false, cam: 'chase', hold: { steer: 0.45, throttle: 0.6, brake: 0 }, holdS: 1.4, label: 'chase turning right' },
  { seed: 1, at: 900, time: 'day', debug: true, cam: 'chase', hold: { steer: 1, throttle: 1, brake: 0 }, holdS: 4, label: 'chase off-road' },
];

let shotIndex = 0;

function nameFor(s: ShotState): string {
  if (s.label !== undefined) {
    return `${String(shotIndex).padStart(2, '0')}_${s.label.replace(/[^a-z0-9]+/gi, '-')}.png`;
  }
  const bits = [`s${s.seed}`, `${Math.round(s.at)}m`, s.time];
  if (s.fov !== undefined) bits.push(`fov${s.fov}`);
  if (s.aperture !== undefined) bits.push(`ap${s.aperture}`);
  if (s.look === false) bits.push('nolook');
  if (s.debug) bits.push('debug');
  return `${bits.join('_')}.png`;
}

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });

  const single: ShotState = {
    seed: Number(args.get('seed') ?? 1),
    at: Number(args.get('at') ?? 0),
    time: args.get('time') ?? 'golden',
    debug,
  };
  const fov = optionalNumber('fov');
  if (fov !== undefined) single.fov = fov;
  const aperture = optionalNumber('aperture');
  if (aperture !== undefined) single.aperture = aperture;
  const dash = optionalNumber('dash');
  if (dash !== undefined) single.dash = dash;
  if (args.get('look') === '0') single.look = false;

  const shots: ShotState[] = handling
    ? HANDLING_MATRIX
    : sequence
      ? sequenceMatrix()
      : compare
        ? COMPARE_MATRIX
        : sheet
          ? SHEET_MATRIX
          : [single];

  const harness = await startHarness();
  const written: string[] = [];

  try {
    const page = await harness.newPage(device);
    for (const shot of shots) {
      shotIndex++;
      await harness.load(page, shot);
      const stats = await page.evaluate(() => window.__dts?.stats());
      const file = join(outDir, nameFor(shot));
      await page.screenshot({ path: file });
      written.push(file);
      console.log(
        `${nameFor(shot).padEnd(28)} ` +
          `dist ${(shot.at / 1000).toFixed(2)} km  ` +
          `steps ${stats?.totalSteps ?? 0}  ` +
          `sim ${stats?.simMs.toFixed(2) ?? '?'} ms`,
      );
    }

    if (sheet || compare || sequence || handling) {
      const sheetFile = await buildContactSheet(harness, written, device);
      console.log(`\ncontact sheet: ${sheetFile}`);
    }
  } finally {
    await harness.close();
  }

  console.log(`\n${written.length} shot(s) → ${outDir}`);
  console.log('Stills only. Motion, lean and latency are not visible here (ADR-0008).');
}

/**
 * Composites the shots by laying them out in a page and photographing that.
 * Cheaper and more flexible than pulling in an image library, and the browser
 * is already running.
 */
async function buildContactSheet(
  harness: Awaited<ReturnType<typeof startHarness>>,
  files: string[],
  device: Device,
): Promise<string> {
  const thumbW = 240;
  const thumbH = Math.round((device.height / device.width) * thumbW);
  const cells = files
    .map((f) => {
      const name = f.split('/').pop() ?? f;
      return `<figure><img src="file://${f}" width="${thumbW}" height="${thumbH}"><figcaption>${name}</figcaption></figure>`;
    })
    .join('\n');

  const html = `<!doctype html><meta charset="utf-8">
<style>
  body { margin:0; padding:20px; background:#141416; color:#9aa0a6;
         font:12px/1.4 ui-monospace, monospace; }
  .grid { display:flex; flex-wrap:wrap; gap:16px; }
  figure { margin:0; }
  img { display:block; border-radius:3px; background:#000; }
  figcaption { padding-top:6px; }
</style>
<div class="grid">${cells}</div>`;

  const htmlFile = join(outDir, 'contact-sheet.html');
  await writeFile(htmlFile, html, 'utf8');

  const page = await harness.newPage({ width: 1200, height: 800, dpr: 1 });
  await page.goto(`file://${htmlFile}`, { waitUntil: 'load' });
  const sheetFile = join(outDir, 'contact-sheet.png');
  await page.screenshot({ path: sheetFile, fullPage: true });
  return sheetFile;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

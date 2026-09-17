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

/** The matrix a contact sheet covers. Widens as the phases land. */
const SHEET_MATRIX: ShotState[] = [
  { seed: 1, at: 0, time: 'day', debug: false },
  { seed: 1, at: 500, time: 'day', debug: false },
  { seed: 7, at: 1200, time: 'dusk', debug: false },
  { seed: 7, at: 1200, time: 'night', debug: false },
  { seed: 3, at: 5000, time: 'day', debug: true },
  { seed: 3, at: 5000, time: 'dusk', debug: true },
];

function nameFor(s: ShotState): string {
  return `s${s.seed}_${Math.round(s.at)}m_${s.time}${s.debug ? '_debug' : ''}.png`;
}

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });

  const shots: ShotState[] = sheet
    ? SHEET_MATRIX
    : [
        {
          seed: Number(args.get('seed') ?? 1),
          at: Number(args.get('at') ?? 0),
          time: (args.get('time') ?? 'day') as ShotState['time'],
          debug,
        },
      ];

  const harness = await startHarness();
  const written: string[] = [];

  try {
    const page = await harness.newPage(device);
    for (const shot of shots) {
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

    if (sheet) {
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

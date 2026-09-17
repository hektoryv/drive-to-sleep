/**
 * Frame-time capture over a scripted drive.
 *
 *   npm run perf -- --seconds 30 --at 2000
 *
 * IMPORTANT: this runs in headless Chromium on SwiftShader — software
 * rasterisation, no GPU. The absolute numbers mean nothing about a phone.
 * What it is good for is *relative* comparison across commits and catching
 * simulation-side regressions and allocation stalls, which show up as long
 * tail frames regardless of the rasteriser.
 *
 * Real device performance is measured in Phase 6, on a device.
 */

import { DEFAULT_DEVICE, parseArgs, startHarness } from './harness.js';

const args = parseArgs(process.argv.slice(2));
const seconds = Number(args.get('seconds') ?? 15);
const at = Number(args.get('at') ?? 1000);

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[i] ?? 0;
}

async function main(): Promise<void> {
  const harness = await startHarness();
  try {
    const page = await harness.newPage(DEFAULT_DEVICE);
    await harness.load(page, { seed: 1, at, time: 'day', debug: false });

    // Passed as source text rather than a function: tsx compiles this file
    // with esbuild's keepNames on, which rewrites named inner functions to
    // reference a `__name` helper that does not exist inside the page.
    const samples: number[] = await page.evaluate(`
      new Promise((resolve) => {
        const out = [];
        let last = performance.now();
        const end = last + ${seconds * 1000};
        requestAnimationFrame(function tick() {
          const now = performance.now();
          out.push(now - last);
          last = now;
          if (now < end) requestAnimationFrame(tick);
          else resolve(out);
        });
      })
    `);

    const stats = await page.evaluate(() => window.__dts?.stats());

    // The first handful of frames include shader compilation.
    const warm = samples.slice(5).sort((a, b) => a - b);
    console.log(`frames      ${warm.length} over ${seconds}s`);
    console.log(`p50         ${percentile(warm, 50).toFixed(2)} ms`);
    console.log(`p95         ${percentile(warm, 95).toFixed(2)} ms`);
    console.log(`p99         ${percentile(warm, 99).toFixed(2)} ms`);
    console.log(`max         ${(warm[warm.length - 1] ?? 0).toFixed(2)} ms`);
    console.log(`sim         ${stats?.simMs.toFixed(3) ?? '?'} ms/frame`);
    console.log(`sim steps   ${stats?.totalSteps ?? 0}`);
    console.log(`dropped     ${stats?.droppedFrames ?? 0}`);
    console.log('\nSoftware rasteriser — absolute numbers are not phone numbers.');
    console.log('Use this for commit-to-commit comparison. Device perf is Phase 6.');
  } finally {
    await harness.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

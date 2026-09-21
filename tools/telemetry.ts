/**
 * Drives the car and prints what the handling actually did.
 *
 *   npm run telemetry -- --seed 1 --seconds 300
 *
 * Screenshots cannot judge motion (ADR-0008), and Phase 2 is entirely motion.
 * This is the other half of the loop: numbers for the things a still cannot
 * show — how far the body leans, how close to the grip limit the car gets,
 * whether it ever runs out of road.
 *
 * It is still not a substitute for driving it. A car can produce impeccable
 * numbers and feel dead.
 */

import { DEFAULT_DEVICE, parseArgs, startHarness } from './harness.js';

interface Row {
  s: number;
  t: number;
  kmh: number;
  g: number;
  roll: number;
  steer: number;
  slip: number;
  surf: string;
}

interface Report {
  rows: Row[];
  peakRoll: number;
  peakG: number;
  peakSlip: number;
  offRoad: number;
  samples: number;
  minSpeed: number;
  maxSpeed: number;
  total: number;
}

const args = parseArgs(process.argv.slice(2));
const seed = Number(args.get('seed') ?? 1);
const seconds = Number(args.get('seconds') ?? 300);

const harness = await startHarness();
try {
  const page = await harness.newPage(DEFAULT_DEVICE);
  await harness.load(page, { seed, at: 0, time: 'day', debug: false });

  const steps = Math.round(seconds / 0.25);
  const every = Math.max(1, Math.round(steps / 12));

  const report = (await page.evaluate(`
    (() => {
      const api = window.__dts;
      api.setAutopilot(true);
      const rows = [];
      let peakRoll = 0, peakG = 0, peakSlip = 0, offRoad = 0;
      let minSpeed = Infinity, maxSpeed = 0;
      for (let i = 0; i < ${steps}; i++) {
        api.advanceSeconds(0.25);
        const t = api.telemetry();
        peakRoll = Math.max(peakRoll, Math.abs(t.rollDeg));
        peakG = Math.max(peakG, Math.abs(t.lateralG));
        peakSlip = Math.max(peakSlip, Math.abs(t.slipDeg));
        minSpeed = Math.min(minSpeed, t.speedKmh);
        maxSpeed = Math.max(maxSpeed, t.speedKmh);
        if (!t.onRoad) offRoad++;
        if (i % ${every} === 0) rows.push({
          s: Math.round(t.distanceM), t: +t.lateralM.toFixed(2),
          kmh: Math.round(t.speedKmh), g: +t.lateralG.toFixed(2),
          roll: +t.rollDeg.toFixed(2), steer: +t.steerDeg.toFixed(1),
          slip: +t.slipDeg.toFixed(1), surf: t.surface,
        });
      }
      return { rows, peakRoll, peakG, peakSlip, offRoad, samples: ${steps},
               minSpeed, maxSpeed, total: api.telemetry().distanceM };
    })()
  `)) as Report;

  const pad = (v: string | number, n: number): string => String(v).padStart(n);
  console.log(`seed ${seed}, ${seconds}s under autopilot\n`);
  console.log('       s      t    km/h      g    roll   steer   slip  surface');
  for (const r of report.rows) {
    console.log(
      pad(r.s, 8), pad(r.t, 6), pad(r.kmh, 7), pad(r.g, 6),
      pad(r.roll, 7), pad(r.steer, 7), pad(r.slip, 6), ' ' + r.surf,
    );
  }
  console.log(`\ndistance     ${(report.total / 1000).toFixed(2)} km`);
  console.log(`peak roll    ${report.peakRoll.toFixed(2)}°`);
  console.log(`peak lateral ${report.peakG.toFixed(2)} g`);
  console.log(`peak slip    ${report.peakSlip.toFixed(2)}°`);
  console.log(`speed        ${report.minSpeed.toFixed(0)}–${report.maxSpeed.toFixed(0)} km/h`);
  console.log(`off-road     ${report.offRoad} / ${report.samples} samples`);
  console.log('\nThe autopilot drives well within the limit by design. These are');
  console.log('sanity numbers, not the numbers a player would produce.');
} finally {
  await harness.close();
}

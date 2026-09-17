import { DEFAULT_DEVICE, parseArgs, startHarness } from './harness.js';

const args = parseArgs(process.argv.slice(2));
const h = await startHarness();
try {
  const page = await h.newPage(DEFAULT_DEVICE);
  await h.load(page, {
    seed: Number(args.get('seed') ?? 1),
    at: Number(args.get('at') ?? 1200),
    time: 'day',
    debug: false,
  });
  const report = await page.evaluate(() => window.__dts?.sceneReport());
  console.log(JSON.stringify(report, null, 2));
} finally {
  await h.close();
}

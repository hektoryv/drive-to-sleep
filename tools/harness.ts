/**
 * Shared plumbing for the screenshot and performance tools: a Vite dev server
 * and a Chromium page with the game loaded and warped to a known state.
 */

import { existsSync } from 'node:fs';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser, type Page } from 'playwright';

/**
 * Finds a Chromium to drive.
 *
 * The container ships browsers under PLAYWRIGHT_BROWSERS_PATH whose build
 * number won't generally match whatever the installed playwright package
 * expects, and downloading another one is not an option here. So: use an
 * explicitly provided binary if there is one, otherwise the stable symlink the
 * image provides, otherwise fall back to Playwright's own bundled browser.
 */
function resolveChromium(): string | undefined {
  const candidates = [
    process.env.CHROMIUM_PATH,
    `${process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers'}/chromium`,
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== '' && existsSync(c)) return c;
  }
  return undefined;
}

export interface ShotState {
  seed: number;
  /** Distance to fast-forward to before shooting, in metres. */
  at: number;
  time: 'day' | 'dusk' | 'night';
  debug: boolean;
  /** Framing overrides for a tuning sweep. Degrees for fov; fractions otherwise. */
  fov?: number;
  aperture?: number;
  dash?: number;
  /** Camera look-ahead, for before/after comparison. Defaults on. */
  look?: boolean;
  /** Caption used in a contact sheet, when the filename isn't the point. */
  label?: string;
}

export interface Device {
  width: number;
  height: number;
  dpr: number;
}

/** A middling modern Android phone in CSS pixels. Portrait, per ADR-0006. */
export const DEFAULT_DEVICE: Device = { width: 412, height: 915, dpr: 2 };

export interface Harness {
  server: ViteDevServer;
  browser: Browser;
  origin: string;
  newPage(device: Device): Promise<Page>;
  load(page: Page, state: ShotState): Promise<void>;
  close(): Promise<void>;
}

export async function startHarness(): Promise<Harness> {
  const server = await createServer({
    server: { port: 0, host: '127.0.0.1' },
    logLevel: 'warn',
  });
  await server.listen();

  const address = server.httpServer?.address();
  if (address === null || address === undefined || typeof address === 'string') {
    throw new Error('vite dev server did not report a usable address');
  }
  const origin = `http://127.0.0.1:${address.port}`;

  const executablePath = resolveChromium();
  const browser = await chromium.launch({
    ...(executablePath === undefined ? {} : { executablePath }),
    args: [
      // Running as root in a container.
      '--no-sandbox',
      // Headless Chromium has no GPU here, so WebGL runs on SwiftShader.
      // It renders correctly; it is not representative of real performance.
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
      '--disable-gpu-sandbox',
    ],
  });

  return {
    server,
    browser,
    origin,
    async newPage(device) {
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        deviceScaleFactor: device.dpr,
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      page.on('pageerror', (err) => console.error('[page error]', err.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') console.error('[page console]', msg.text());
      });
      return page;
    },
    async load(page, state) {
      const q = new URLSearchParams({
        seed: String(state.seed),
        time: state.time,
        debug: state.debug ? '1' : '0',
      });
      if (state.fov !== undefined) q.set('fov', String(state.fov));
      if (state.aperture !== undefined) q.set('aperture', String(state.aperture));
      if (state.dash !== undefined) q.set('dash', String(state.dash));
      if (state.look === false) q.set('look', '0');
      const url = `${origin}/?${q.toString()}`;
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__dts !== undefined, null, { timeout: 15000 });
      await page.evaluate(() => window.__dts?.ready);
      if (state.at > 0) {
        await page.evaluate((d) => window.__dts?.warpTo(d), state.at);
      }
      // Let a few real frames render from the warped state before looking.
      await settleFrames(page, 4);
    },
    async close() {
      await browser.close();
      await server.close();
    },
  };
}

/** Waits for `count` animation frames to actually be presented. */
export async function settleFrames(page: Page, count: number): Promise<void> {
  await page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
  }, count);
}

export function parseArgs(argv: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined || !a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out.set(key, next);
      i++;
    } else {
      out.set(key, 'true');
    }
  }
  return out;
}

import { describe, expect, it } from 'vitest';
import { createLoop } from '../src/core/loop.js';

/**
 * A controllable clock and frame scheduler, so the loop can be driven
 * deterministically without a browser.
 */
function makeHarness(stepHz = 120, maxSubSteps = 8) {
  let time = 0;
  let pending: ((t: number) => void) | null = null;
  const updates: number[] = [];
  const renders: number[] = [];

  const loop = createLoop(
    {
      update: (dt) => updates.push(dt),
      render: (alpha) => renders.push(alpha),
    },
    {
      stepHz,
      maxSubSteps,
      now: () => time,
      schedule: (cb) => {
        pending = cb;
        return 1;
      },
      cancel: () => {
        pending = null;
      },
    },
  );

  /** Advances wall-clock time by `ms` and delivers one frame. */
  function frame(ms: number): void {
    time += ms;
    const cb = pending;
    pending = null;
    cb?.(time);
  }

  return { loop, frame, updates, renders };
}

describe('fixed timestep', () => {
  it('always steps by exactly the fixed dt', () => {
    const h = makeHarness(120);
    h.loop.start();
    h.frame(0);
    for (let i = 0; i < 20; i++) h.frame(16.7);
    expect(h.updates.length).toBeGreaterThan(0);
    for (const dt of h.updates) expect(dt).toBeCloseTo(1 / 120, 12);
  });

  it('keeps simulated time in step with wall-clock time', () => {
    // The invariant that matters is that no time is lost: simulated time
    // tracks wall-clock to within one pending step. Asserting an exact step
    // count instead would be asserting floating-point residue — a frame that
    // falls a hair short defers a step to the next frame rather than dropping
    // it, which is correct.
    const h = makeHarness(120);
    h.loop.start();
    h.frame(0);
    for (let i = 0; i < 200; i++) h.frame(1000 / 60);
    const wallSeconds = 200 * (1 / 60);
    expect(h.loop.stats.simTime).toBeGreaterThan(wallSeconds - h.loop.stepDt);
    expect(h.loop.stats.simTime).toBeLessThanOrEqual(wallSeconds + h.loop.stepDt);
    expect(h.loop.stats.droppedFrames).toBe(0);
  });

  it('does not drift over an irregular frame rate', () => {
    const h = makeHarness(120);
    h.loop.start();
    h.frame(0);
    let wallMs = 0;
    // Jittery deltas, as a real device produces.
    for (let i = 0; i < 300; i++) {
      const dt = 8 + (i % 7) * 3.1;
      wallMs += dt;
      h.frame(dt);
    }
    expect(h.loop.stats.simTime).toBeCloseTo(wallMs / 1000, 1);
  });

  it('caps the backlog after a stall instead of spiralling', () => {
    const h = makeHarness(120, 8);
    h.loop.start();
    h.frame(0);
    h.updates.length = 0;
    h.frame(5000); // five seconds of stall — 600 steps' worth
    expect(h.updates.length).toBe(8);
    expect(h.loop.stats.droppedFrames).toBe(1);

    // And it recovers immediately rather than staying behind.
    h.updates.length = 0;
    h.frame(1000 / 60);
    expect(h.updates.length).toBe(2);
  });

  it('reports an interpolation alpha in [0, 1)', () => {
    const h = makeHarness(120);
    h.loop.start();
    h.frame(0);
    for (let i = 0; i < 30; i++) h.frame(7.3);
    for (const a of h.renders) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
  });

  it('renders once per frame regardless of step count', () => {
    const h = makeHarness(120);
    h.loop.start();
    h.frame(0);
    h.renders.length = 0;
    for (let i = 0; i < 12; i++) h.frame(33);
    expect(h.renders.length).toBe(12);
  });

  it('stops scheduling once stopped', () => {
    const h = makeHarness(120);
    h.loop.start();
    h.frame(0);
    h.loop.stop();
    h.updates.length = 0;
    h.frame(100);
    expect(h.updates.length).toBe(0);
  });
});

describe('advance', () => {
  it('runs the exact number of steps for a duration', () => {
    const h = makeHarness(120);
    expect(h.loop.advance(1)).toBe(120);
    expect(h.updates.length).toBe(120);
  });

  it('does not render', () => {
    const h = makeHarness(120);
    h.loop.advance(2);
    expect(h.renders.length).toBe(0);
  });

  it('is deterministic — the harness photographs a reproducible state', () => {
    const a = makeHarness(120);
    const b = makeHarness(120);
    a.loop.advance(3.7);
    b.loop.advance(3.7);
    expect(a.loop.stats.totalSteps).toBe(b.loop.stats.totalSteps);
    expect(a.loop.stats.simTime).toBeCloseTo(b.loop.stats.simTime, 12);
  });

  it('keeps simulated time consistent with the step count', () => {
    const h = makeHarness(120);
    h.loop.advance(5);
    expect(h.loop.stats.simTime).toBeCloseTo(5, 6);
  });
});

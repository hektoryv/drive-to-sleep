/**
 * Fixed-timestep game loop with render interpolation.
 *
 * The simulation advances in fixed increments regardless of display rate
 * (ADR-0002). This is not an optimisation — the attitude springs settle
 * differently at different step sizes, so a variable step would literally make
 * the car feel different on a 60 Hz phone than on a 120 Hz one, and tuning
 * would be chasing a moving target.
 *
 * Rendering receives `alpha`, the fraction between the previous and current
 * simulation states, so motion stays smooth when the display rate and the
 * simulation rate disagree (which is almost always).
 */

export interface LoopCallbacks {
  /** Advances the simulation by exactly `dt` seconds. Called 0..maxSubSteps times per frame. */
  update(dt: number): void;
  /**
   * Draws a frame. `alpha` is 0..1 between the last two simulation states;
   * interpolate presentation values with it. `frameDt` is wall-clock time
   * since the previous frame, for display-rate-dependent things only.
   */
  render(alpha: number, frameDt: number): void;
}

export interface LoopOptions {
  /** Simulation rate. 120 Hz — see docs/03-architecture.md. */
  stepHz?: number;
  /**
   * Maximum simulation steps per frame. Caps the "spiral of death" after a
   * stall (a long GC pause, the app returning from background): beyond this
   * the loop drops the backlog and lets time slip rather than trying to catch
   * up, which would stall it further.
   */
  maxSubSteps?: number;
  /** Injectable for tests and for the headless harness. */
  now?: () => number;
  /** Injectable for tests and for the headless harness. */
  schedule?: (cb: (t: number) => void) => number;
  cancel?: (handle: number) => void;
}

export interface LoopStats {
  /** Frames per second, derived from `frameMs` so the two always agree. */
  fps: number;
  /** Smoothed wall-clock milliseconds per frame. */
  frameMs: number;
  /** Smoothed milliseconds spent in update() per frame. */
  simMs: number;
  /** Smoothed milliseconds spent in render() per frame. */
  renderMs: number;
  /** Simulation steps taken on the last frame. */
  stepsLastFrame: number;
  /** Total simulation steps taken since the loop started. */
  totalSteps: number;
  /** Total simulated seconds. Authoritative clock for anything time-based. */
  simTime: number;
  /** Frames where the sub-step cap was hit, i.e. simulated time fell behind. */
  droppedFrames: number;
}

export interface Loop {
  readonly stats: Readonly<LoopStats>;
  readonly stepDt: number;
  readonly running: boolean;
  start(): void;
  stop(): void;
  /**
   * Runs simulation steps for `seconds` with no rendering, as fast as the CPU
   * allows. Used by the screenshot harness to fast-forward to a distance
   * (ADR-0008) and by tests. Deterministic: same input, same result.
   * Returns the number of steps taken.
   */
  advance(seconds: number): number;
}

const DEFAULT_STEP_HZ = 120;
const DEFAULT_MAX_SUB_STEPS = 8;
/** Exponential smoothing factor for the stats readouts. */
const STAT_SMOOTHING = 0.1;

export function createLoop(callbacks: LoopCallbacks, options: LoopOptions = {}): Loop {
  const stepHz = options.stepHz ?? DEFAULT_STEP_HZ;
  const maxSubSteps = options.maxSubSteps ?? DEFAULT_MAX_SUB_STEPS;
  const stepDt = 1 / stepHz;

  const now = options.now ?? (() => performance.now());
  const schedule =
    options.schedule ?? ((cb: (t: number) => void) => requestAnimationFrame(cb) as number);
  const cancel = options.cancel ?? ((h: number) => cancelAnimationFrame(h));

  const stats: LoopStats = {
    fps: 0,
    frameMs: 0,
    simMs: 0,
    renderMs: 0,
    stepsLastFrame: 0,
    totalSteps: 0,
    simTime: 0,
    droppedFrames: 0,
  };

  let running = false;
  let handle = 0;
  let accumulator = 0;
  let lastTime = 0;
  // An explicit flag, not `lastTime === 0`: performance.now() starts near zero
  // on a fresh page, so a zero sentinel re-triggers on real frames and every
  // frame delta collapses to a single step.
  let firstFrame = true;

  function frame(): void {
    if (!running) return;
    handle = schedule(frame);

    const frameStart = now();
    const frameDt = firstFrame ? stepDt : (frameStart - lastTime) / 1000;
    firstFrame = false;
    lastTime = frameStart;

    accumulator += frameDt;

    const simStart = now();
    let steps = 0;
    while (accumulator >= stepDt && steps < maxSubSteps) {
      callbacks.update(stepDt);
      accumulator -= stepDt;
      stats.simTime += stepDt;
      stats.totalSteps++;
      steps++;
    }
    if (accumulator >= stepDt) {
      // Backlog too deep to clear. Drop it — catching up would only make the
      // next frame later still.
      accumulator = 0;
      stats.droppedFrames++;
    }
    const simEnd = now();

    const alpha = accumulator / stepDt;
    callbacks.render(alpha, frameDt);
    const frameEnd = now();

    stats.stepsLastFrame = steps;
    smooth(stats, 'simMs', simEnd - simStart);
    smooth(stats, 'renderMs', frameEnd - simEnd);
    smooth(stats, 'frameMs', frameDt * 1000);
    // Derived, not separately smoothed: averaging 1/dt and averaging dt give
    // different answers, and a debug panel that shows "95 fps / 33 ms" at the
    // same time is worse than useless.
    stats.fps = stats.frameMs > 0 ? 1000 / stats.frameMs : 0;
  }

  function smooth(target: LoopStats, key: 'frameMs' | 'simMs' | 'renderMs', value: number): void {
    target[key] = target[key] === 0 ? value : target[key] + (value - target[key]) * STAT_SMOOTHING;
  }

  return {
    stats,
    stepDt,
    get running() {
      return running;
    },
    start() {
      if (running) return;
      running = true;
      firstFrame = true;
      lastTime = 0;
      accumulator = 0;
      handle = schedule(frame);
    },
    stop() {
      if (!running) return;
      running = false;
      cancel(handle);
    },
    advance(seconds: number): number {
      const steps = Math.round(seconds / stepDt);
      for (let i = 0; i < steps; i++) {
        callbacks.update(stepDt);
        stats.simTime += stepDt;
        stats.totalSteps++;
      }
      return steps;
    },
  };
}

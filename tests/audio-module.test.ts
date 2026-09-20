import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioGraph } from '../src/audio/graph.js';
import { createAudioModule } from '../src/audio/audio-module.js';
import { MASTER } from '../src/audio/tuning.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('audio lifecycle', () => {
  it('fades before suspending the audio clock on pause', async () => {
    vi.useFakeTimers();
    const suspend = vi.fn(async () => undefined);
    const context = {
      state: 'running',
      resume: vi.fn(async () => undefined),
      suspend,
    } as unknown as AudioContext;
    const graph = {
      context,
      update: vi.fn(),
      setRunning: vi.fn(),
      dispose: vi.fn(),
    } satisfies AudioGraph;
    const module = createAudioModule(() => graph);
    module.init?.({} as never);

    module.pause?.();
    expect(graph.setRunning).toHaveBeenCalledWith(false);
    expect(suspend).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(MASTER.FADE_S * 1000);
    expect(suspend).toHaveBeenCalledOnce();
  });

  it('cancels a pending suspend when disposed', async () => {
    vi.useFakeTimers();
    const suspend = vi.fn(async () => undefined);
    const graph = {
      context: { state: 'running', suspend } as unknown as AudioContext,
      update: vi.fn(),
      setRunning: vi.fn(),
      dispose: vi.fn(),
    } satisfies AudioGraph;
    const module = createAudioModule(() => graph);
    module.init?.({} as never);

    module.pause?.();
    module.dispose?.();
    await vi.runAllTimersAsync();
    expect(suspend).not.toHaveBeenCalled();
  });
});

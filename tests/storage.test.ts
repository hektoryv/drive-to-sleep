import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SAVE, loadSave, saveSave } from '../src/core/storage.js';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  clear(): void {
    this.map.clear();
  }
}

describe('save data', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  });

  it('returns defaults when nothing is stored', () => {
    expect(loadSave()).toEqual(DEFAULT_SAVE);
  });

  it('round-trips', () => {
    const data = { ...DEFAULT_SAVE, bestDistanceM: 12345, resume: { seed: 4, distanceM: 900 } };
    saveSave(data);
    expect(loadSave()).toEqual(data);
  });

  it('fills in fields a previous build did not write', () => {
    globalThis.localStorage.setItem('dts.save', JSON.stringify({ bestDistanceM: 500 }));
    const loaded = loadSave();
    expect(loaded.bestDistanceM).toBe(500);
    expect(loaded.settings).toEqual(DEFAULT_SAVE.settings);
  });

  it('survives corrupt data', () => {
    globalThis.localStorage.setItem('dts.save', '{not json');
    expect(loadSave()).toEqual(DEFAULT_SAVE);
  });

  it('survives storage being unavailable entirely', () => {
    // Private mode, blocked site data — the game must still run.
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    expect(() => loadSave()).not.toThrow();
    expect(() => saveSave(DEFAULT_SAVE)).not.toThrow();
    expect(loadSave()).toEqual(DEFAULT_SAVE);
  });
});

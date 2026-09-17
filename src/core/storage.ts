/**
 * Local persistence. Nothing leaves the device — there is no network in this
 * game at all (see docs/00-vision.md non-goals).
 *
 * Every access is guarded: localStorage throws in some WebView configurations
 * and returns null in others, and the game must run identically either way.
 * A storage failure is never an error the player sees.
 */

const PREFIX = 'dts.';

export interface SaveData {
  /** Best distance ever driven, in metres. */
  bestDistanceM: number;
  /** Where the last drive left off, so a drive continues across sessions. */
  resume: { seed: number; distanceM: number } | null;
  settings: {
    /** Inverts the throttle/brake axis for players who read "pull back = go". */
    invertY: boolean;
    /** null = auto-detect from measured frame times. */
    qualityTier: 'low' | 'medium' | 'high' | null;
    /** Multiplier on steering sensitivity, 0.5..1.5. */
    steerSensitivity: number;
  };
}

export const DEFAULT_SAVE: SaveData = {
  bestDistanceM: 0,
  resume: null,
  settings: {
    invertY: false,
    qualityTier: null,
    steerSensitivity: 1,
  },
};

function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, value);
  } catch {
    // Private mode, blocked site data, quota. Play on regardless.
  }
}

export function loadSave(): SaveData {
  const raw = read('save');
  if (raw === null) return structuredClone(DEFAULT_SAVE);
  try {
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    // Merge field by field so a save written by an older build stays usable.
    return {
      bestDistanceM: parsed.bestDistanceM ?? DEFAULT_SAVE.bestDistanceM,
      resume: parsed.resume ?? DEFAULT_SAVE.resume,
      settings: { ...DEFAULT_SAVE.settings, ...parsed.settings },
    };
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function saveSave(data: SaveData): void {
  write('save', JSON.stringify(data));
}

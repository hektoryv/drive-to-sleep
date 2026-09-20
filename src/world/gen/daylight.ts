/**
 * The sun, and the palette it implies.
 *
 * One phase value (0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk) drives
 * the sun's position and every colour in the world. Nothing else in the game
 * decides what colour anything is at a given time — the sky, the fog, the
 * terrain lighting and eventually the dashboard all read from here, which is
 * what stops them drifting apart.
 *
 * Pure. No three.js, no DOM.
 *
 * ## Palette discipline
 *
 * Each keyframe is about a dozen colours and they are not independent. The
 * rule that makes the whole thing read as one image (docs/02-art-direction.md):
 * **everything lit is warm, everything in shadow is violet.** Ambient is the
 * sky's colour, not grey. Fog is the horizon's colour, not white. Break either
 * and the scene falls apart into unrelated objects.
 *
 * The golden-hour keyframe is sampled from the art target in
 * `docs/reference/art-target.png` and is the one the others are built around.
 */

import { clamp, lerp, smootherstep } from '../../core/math.js';
import { DAY } from '../tuning.js';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Every colour the world needs at one moment. Mutated in place; never retained. */
export interface SkyPalette {
  /** Four-stop sky gradient, zenith down to horizon. Two stops is not enough: the
   *  violet-to-orange transit at dusk is the whole picture. */
  zenith: Rgb;
  upper: Rgb;
  mid: Rgb;
  horizon: Rgb;

  /** The sun's disc and the halo around it. */
  sunDisc: Rgb;
  sunHalo: Rgb;

  /** Clouds, lit and unlit. The gap between them is how three-dimensional they read. */
  cloudLit: Rgb;
  cloudShadow: Rgb;

  /** Distance fog. Always the horizon's colour, or a band appears at the skyline. */
  fog: Rgb;
  /** The directional light on terrain and road. */
  sunLight: Rgb;
  /** Fill light. The sky's colour, never grey. */
  ambient: Rgb;

  fogDensity: number;
  /** 0–1. How much of the sky the clouds cover. */
  cloudCover: number;
  /** 0–1. Stars fade in as the sky darkens. */
  starIntensity: number;
  /** 0–1. Drives the dashboard backlighting in Phase 4. */
  instrumentGlow: number;
}

interface Keyframe extends SkyPalette {
  phase: number;
}

function rgb(hex: number): Rgb {
  return {
    r: ((hex >> 16) & 0xff) / 255,
    g: ((hex >> 8) & 0xff) / 255,
    b: (hex & 0xff) / 255,
  };
}

/**
 * The day, as ten moments.
 *
 * Read down the `horizon` column and you can see the day happen: near-black
 * blue, then the first warmth, then clean daylight, then the long slide back
 * through gold and rose into indigo.
 */
const KEYFRAMES: Keyframe[] = [
  key(0.0, {
    zenith: 0x05070f, upper: 0x080c1a, mid: 0x0d1428, horizon: 0x18203c,
    sunDisc: 0xc8d4f0, sunHalo: 0x2a3a5e,
    cloudLit: 0x1c2440, cloudShadow: 0x0d1223,
    fog: 0x18203c, sunLight: 0x3c4a72, ambient: 0x141c33,
    fogDensity: 0.00034, cloudCover: 0.35, starIntensity: 1, instrumentGlow: 1,
  }),
  key(0.19, {
    zenith: 0x1a1f42, upper: 0x2d2a55, mid: 0x4e3a63, horizon: 0x7a4f60,
    sunDisc: 0xffd9a8, sunHalo: 0x8d5560,
    cloudLit: 0x6b4a63, cloudShadow: 0x2e2447,
    fog: 0x7a4f60, sunLight: 0x6a5570, ambient: 0x2f2c4e,
    fogDensity: 0.00040, cloudCover: 0.45, starIntensity: 0.45, instrumentGlow: 0.85,
  }),
  key(0.25, {
    zenith: 0x4a4b86, upper: 0x6f5a8e, mid: 0xb0708a, horizon: 0xf0956b,
    sunDisc: 0xfff0c4, sunHalo: 0xf5a05e,
    cloudLit: 0xe0887e, cloudShadow: 0x6d5279,
    fog: 0xe0906d, sunLight: 0xffbe86, ambient: 0x5c5a86,
    fogDensity: 0.00036, cloudCover: 0.5, starIntensity: 0.12, instrumentGlow: 0.5,
  }),
  key(0.34, {
    zenith: 0x3f74b4, upper: 0x6d9bc9, mid: 0xa8c4d8, horizon: 0xd6dcd6,
    sunDisc: 0xfffaea, sunHalo: 0xffe2b0,
    cloudLit: 0xf4efe4, cloudShadow: 0xa9b0bd,
    fog: 0xcfd8d8, sunLight: 0xfff2d8, ambient: 0x7f97b4,
    fogDensity: 0.00026, cloudCover: 0.4, starIntensity: 0, instrumentGlow: 0,
  }),
  key(0.5, {
    zenith: 0x2f6bb2, upper: 0x5b95cb, mid: 0x9dc0dc, horizon: 0xc9d9dd,
    sunDisc: 0xfffdf6, sunHalo: 0xfff4d8,
    cloudLit: 0xfbfaf6, cloudShadow: 0xb3bcc6,
    fog: 0xc2d3da, sunLight: 0xfff6e4, ambient: 0x7d9ab6,
    fogDensity: 0.00022, cloudCover: 0.32, starIntensity: 0, instrumentGlow: 0,
  }),
  key(0.66, {
    zenith: 0x3d6ea8, upper: 0x7d94bd, mid: 0xc4a9ae, horizon: 0xecb383,
    sunDisc: 0xfff8e0, sunHalo: 0xffd79a,
    cloudLit: 0xf6d5b4, cloudShadow: 0x9f8ca3,
    fog: 0xe0b49a, sunLight: 0xffe3b8, ambient: 0x8091b0,
    fogDensity: 0.00024, cloudCover: 0.42, starIntensity: 0, instrumentGlow: 0.1,
  }),
  // Golden hour — sampled from docs/reference/art-target.png.
  //
  // At 0.72 the sun sits about 6° above the horizon, which is what "golden
  // hour" means. The first version put this palette at 0.76, by which point
  // the sun is 4° *below* the horizon and there is no disc to see at all.
  key(0.72, {
    zenith: 0x7a74ac, upper: 0x8870a5, mid: 0xc9717b, horizon: 0xf9814c,
    sunDisc: 0xfee576, sunHalo: 0xfeb14a,
    cloudLit: 0xffa864, cloudShadow: 0xa86d8e,
    fog: 0xf08a5c, sunLight: 0xffc98a, ambient: 0x8a7aa8,
    fogDensity: 0.00030, cloudCover: 0.52, starIntensity: 0, instrumentGlow: 0.35,
  }),
  key(0.79, {
    zenith: 0x4c4a8e, upper: 0x6a5a96, mid: 0xa8628a, horizon: 0xe4703f,
    sunDisc: 0xffd27a, sunHalo: 0xf08a4a,
    cloudLit: 0xe07a5e, cloudShadow: 0x6c5183,
    fog: 0xd0704c, sunLight: 0xffa060, ambient: 0x5f5892,
    fogDensity: 0.00034, cloudCover: 0.55, starIntensity: 0.05, instrumentGlow: 0.7,
  }),
  key(0.86, {
    zenith: 0x1e2350, upper: 0x332f63, mid: 0x5a3c6c, horizon: 0x8f4a58,
    sunDisc: 0xffc890, sunHalo: 0x9a5058,
    cloudLit: 0x7a4a68, cloudShadow: 0x30284f,
    fog: 0x8a4a5a, sunLight: 0x74557a, ambient: 0x342f58,
    fogDensity: 0.00038, cloudCover: 0.5, starIntensity: 0.4, instrumentGlow: 0.95,
  }),
  key(1.0, {
    zenith: 0x05070f, upper: 0x080c1a, mid: 0x0d1428, horizon: 0x18203c,
    sunDisc: 0xc8d4f0, sunHalo: 0x2a3a5e,
    cloudLit: 0x1c2440, cloudShadow: 0x0d1223,
    fog: 0x18203c, sunLight: 0x3c4a72, ambient: 0x141c33,
    fogDensity: 0.00034, cloudCover: 0.35, starIntensity: 1, instrumentGlow: 1,
  }),
];

interface KeySpec {
  zenith: number; upper: number; mid: number; horizon: number;
  sunDisc: number; sunHalo: number;
  cloudLit: number; cloudShadow: number;
  fog: number; sunLight: number; ambient: number;
  fogDensity: number; cloudCover: number; starIntensity: number; instrumentGlow: number;
}

function key(phase: number, s: KeySpec): Keyframe {
  return {
    phase,
    zenith: rgb(s.zenith), upper: rgb(s.upper), mid: rgb(s.mid), horizon: rgb(s.horizon),
    sunDisc: rgb(s.sunDisc), sunHalo: rgb(s.sunHalo),
    cloudLit: rgb(s.cloudLit), cloudShadow: rgb(s.cloudShadow),
    fog: rgb(s.fog), sunLight: rgb(s.sunLight), ambient: rgb(s.ambient),
    fogDensity: s.fogDensity, cloudCover: s.cloudCover,
    starIntensity: s.starIntensity, instrumentGlow: s.instrumentGlow,
  };
}

export function makeSkyPalette(): SkyPalette {
  const k = KEYFRAMES[0] as Keyframe;
  return {
    zenith: { ...k.zenith }, upper: { ...k.upper }, mid: { ...k.mid }, horizon: { ...k.horizon },
    sunDisc: { ...k.sunDisc }, sunHalo: { ...k.sunHalo },
    cloudLit: { ...k.cloudLit }, cloudShadow: { ...k.cloudShadow },
    fog: { ...k.fog }, sunLight: { ...k.sunLight }, ambient: { ...k.ambient },
    fogDensity: k.fogDensity, cloudCover: k.cloudCover,
    starIntensity: k.starIntensity, instrumentGlow: k.instrumentGlow,
  };
}

function lerpRgb(out: Rgb, a: Rgb, b: Rgb, t: number): void {
  out.r = lerp(a.r, b.r, t);
  out.g = lerp(a.g, b.g, t);
  out.b = lerp(a.b, b.b, t);
}

/**
 * Fills `out` with the palette at `phase`. Allocation-free.
 *
 * Interpolation is smootherstep rather than linear: the eye is very good at
 * spotting the moment a colour ramp changes direction, and a linear blend
 * between keyframes puts a visible crease at every one of them.
 */
export function paletteAt(phase: number, out: SkyPalette): SkyPalette {
  const p = ((phase % 1) + 1) % 1;

  let i = 0;
  while (i < KEYFRAMES.length - 2 && (KEYFRAMES[i + 1] as Keyframe).phase <= p) i++;
  const a = KEYFRAMES[i] as Keyframe;
  const b = KEYFRAMES[i + 1] as Keyframe;
  const span = b.phase - a.phase;
  const t = smootherstep(span > 1e-9 ? (p - a.phase) / span : 0);

  lerpRgb(out.zenith, a.zenith, b.zenith, t);
  lerpRgb(out.upper, a.upper, b.upper, t);
  lerpRgb(out.mid, a.mid, b.mid, t);
  lerpRgb(out.horizon, a.horizon, b.horizon, t);
  lerpRgb(out.sunDisc, a.sunDisc, b.sunDisc, t);
  lerpRgb(out.sunHalo, a.sunHalo, b.sunHalo, t);
  lerpRgb(out.cloudLit, a.cloudLit, b.cloudLit, t);
  lerpRgb(out.cloudShadow, a.cloudShadow, b.cloudShadow, t);
  lerpRgb(out.fog, a.fog, b.fog, t);
  lerpRgb(out.sunLight, a.sunLight, b.sunLight, t);
  lerpRgb(out.ambient, a.ambient, b.ambient, t);

  out.fogDensity = lerp(a.fogDensity, b.fogDensity, t);
  out.cloudCover = lerp(a.cloudCover, b.cloudCover, t);
  out.starIntensity = lerp(a.starIntensity, b.starIntensity, t);
  out.instrumentGlow = lerp(a.instrumentGlow, b.instrumentGlow, t);
  return out;
}

export interface SunDirection {
  x: number;
  y: number;
  z: number;
  /** Sine of the elevation angle. Negative when the sun is below the horizon. */
  elevation: number;
}

export function makeSunDirection(): SunDirection {
  return { x: 0, y: 1, z: 0, elevation: 1 };
}

/**
 * Unit vector toward the sun at `phase`. Allocation-free.
 *
 * The azimuth sweeps a half turn from dawn to dusk, so over a drive the sun
 * ends up on every side of the car. The base azimuth is chosen so that golden
 * hour puts it ahead and slightly left of a car heading down -Z, which is the
 * composition the art target uses.
 */
export function sunDirectionAt(phase: number, out: SunDirection): SunDirection {
  const p = ((phase % 1) + 1) % 1;
  const elevationAngle = DAY.MAX_SUN_ELEVATION * Math.sin((p - 0.25) * Math.PI * 2);
  // A full turn per day, not a half turn. Sweeping only 180° from dawn to dusk
  // looks right all day and then snaps the sun through 180° at midnight, which
  // is invisible in a still and a hard cut in a long drive.
  const azimuth = (p - 0.25) * Math.PI * 2 + DAY.SUN_AZIMUTH_BASE;

  const cosE = Math.cos(elevationAngle);
  out.x = cosE * Math.sin(azimuth);
  out.y = Math.sin(elevationAngle);
  out.z = cosE * Math.cos(azimuth);
  out.elevation = out.y;
  return out;
}

/**
 * How lit the world is, 0–1. Rises a little before the sun clears the horizon
 * and lingers a little after it sets, because the sky keeps working for a
 * while after the sun has stopped.
 */
export function daylightAt(phase: number): number {
  const sun = sunDirectionAt(phase, makeSunDirection());
  return clamp((sun.elevation + 0.12) / 0.45, 0, 1);
}

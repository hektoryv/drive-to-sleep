/**
 * Scalar and vector maths. Pure, allocation-free in the hot path.
 *
 * Convention (docs/05-conventions.md): radians everywhere internally.
 * Degrees appear only in tuning constants and are converted once.
 */

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Clamp to [-1, 1]. Common enough to deserve a name. */
export function clamp11(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Inverse lerp, clamped. Returns where `v` sits in [a,b] as 0..1. */
export function invLerp(a: number, b: number, v: number): number {
  return a === b ? 0 : clamp((v - a) / (b - a), 0, 1);
}

/** Maps v from one range to another, clamped. */
export function remap(v: number, inA: number, inB: number, outA: number, outB: number): number {
  return lerp(outA, outB, invLerp(inA, inB, v));
}

/** Hermite smoothstep on 0..1. */
export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Quintic smootherstep — the interpolant Perlin noise wants (C2 continuous). */
export function smootherstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Wraps an angle to [-PI, PI). */
export function wrapAngle(a: number): number {
  let x = (a + Math.PI) % TAU;
  if (x < 0) x += TAU;
  return x - Math.PI;
}

/** Shortest signed angular difference from `a` to `b`. */
export function angleDelta(a: number, b: number): number {
  return wrapAngle(b - a);
}

/**
 * Frame-rate independent exponential approach.
 *
 * `rate` is per-second: after 1/rate seconds roughly 63% of the gap is closed.
 * Use this for anything that should ease toward a value without overshoot
 * (steering recentre, camera follow). For anything that should feel like it
 * has mass, use a spring instead — the overshoot is the point.
 */
export function approach(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

/** Moves toward a target at a fixed maximum rate per second. */
export function moveTowards(current: number, target: number, maxDelta: number): number {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + Math.sign(d) * maxDelta;
}

// ---------------------------------------------------------------------------
// Spring-damper
// ---------------------------------------------------------------------------

/**
 * A second-order damped spring. This is the single most important piece of
 * maths in the game: the car's roll, pitch and heave all run through it, and
 * the slight overshoot it produces at zeta < 1 is what reads as "weight"
 * (docs/01-design.md).
 *
 * Integrated semi-implicitly, which is stable at our fixed 120 Hz step and
 * costs almost nothing. Never call this with a variable dt — the whole reason
 * the simulation is fixed-step (ADR-0002) is that these springs settle
 * differently at different step sizes, which would make the car feel different
 * on different phones.
 */
export interface Spring {
  /** Current value. */
  x: number;
  /** Current velocity, units per second. */
  v: number;
  /** Undamped natural frequency in Hz. Higher = snappier. */
  freqHz: number;
  /** Damping ratio. 1 = critically damped; below 1 overshoots; 0.7 ≈ one soft bounce. */
  zeta: number;
}

export function makeSpring(freqHz: number, zeta: number, x = 0): Spring {
  return { x, v: 0, freqHz, zeta };
}

/** Advances a spring toward `target`. Mutates in place — no allocation. */
export function stepSpring(s: Spring, target: number, dt: number): number {
  const omega = TAU * s.freqHz;
  const accel = omega * omega * (target - s.x) - 2 * s.zeta * omega * s.v;
  s.v += accel * dt;
  s.x += s.v * dt;
  return s.x;
}

/** Kicks a spring's velocity — used for impacts and rumble. */
export function impulseSpring(s: Spring, deltaV: number): void {
  s.v += deltaV;
}

export function resetSpring(s: Spring, x = 0): void {
  s.x = x;
  s.v = 0;
}

// ---------------------------------------------------------------------------
// Vectors
//
// Mutable, out-parameter style. Deliberately not a class with operators: the
// hot path must not allocate (docs/05-conventions.md), and this makes every
// allocation site visible.
// ---------------------------------------------------------------------------

export interface Vec2 {
  x: number;
  y: number;
}
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function vec2(x = 0, y = 0): Vec2 {
  return { x, y };
}
export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function setVec2(out: Vec2, x: number, y: number): Vec2 {
  out.x = x;
  out.y = y;
  return out;
}
export function setVec3(out: Vec3, x: number, y: number, z: number): Vec3 {
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

export function copyVec3(out: Vec3, a: Vec3): Vec3 {
  out.x = a.x;
  out.y = a.y;
  out.z = a.z;
  return out;
}

export function lerpVec3(out: Vec3, a: Vec3, b: Vec3, t: number): Vec3 {
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.z = a.z + (b.z - a.z) * t;
  return out;
}

export function lenVec2(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}

export function distVec2(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

/** Squared distance — prefer this for comparisons, it avoids the sqrt. */
export function dist2Vec2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

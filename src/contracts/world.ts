/**
 * What the rest of the game may ask the world for.
 *
 * Pure: no three.js, no DOM. The simulation, the camera rig and the traffic
 * system all read the road through this and nothing else, so the environment
 * domain is free to change entirely how the road is generated and meshed
 * without anything outside `world/` noticing.
 */

/** What the wheels are on. Drives grip, drag and the rumble input. */
export type Surface = 'tarmac' | 'gravel' | 'grass';

/** The road's state at one point along it. Reused in place — never retained. */
export interface RoadSample {
  /** Distance along the centreline, metres. */
  s: number;
  /** Centreline position in world space. */
  x: number;
  y: number;
  z: number;
  /** Direction of travel, radians, same convention as ViewState.heading. */
  heading: number;
  /** Signed 1/radius. Positive curves right. */
  curvature: number;
  /** Rise over run. Positive climbs. */
  grade: number;
  /** Camber, radians. Positive banks for a right-hand corner. */
  bank: number;
  /** Half-width of the tarmac at this point, metres. */
  halfWidth: number;
}

export function makeRoadSample(): RoadSample {
  return { s: 0, x: 0, y: 0, z: 0, heading: 0, curvature: 0, grade: 0, bank: 0, halfWidth: 3.5 };
}

/**
 * Read-only access to the road.
 *
 * Every method is a pure function of distance, which is what lets traffic
 * spawn a kilometre ahead and the camera look into a corner the car has not
 * reached (ADR-0002). Implementations must not require that intermediate
 * distances have been visited first.
 */
export interface RoadQuery {
  /** Fills `out` with the road at distance `s` and returns it. Allocation-free. */
  sampleAt(s: number, out: RoadSample): RoadSample;

  /**
   * Heading at distance `s`. Separated from `sampleAt` because the camera rig
   * asks for this every frame and needs nothing else.
   */
  headingAt(s: number): number;

  /** Surface at a point, given lateral offset `t` from the centreline. */
  surfaceAt(s: number, t: number): Surface;

  /**
   * Converts a world position to road coordinates, writing into `out`.
   * `nearS` is a hint — the previous frame's distance — because the exact
   * search is expensive and the answer never moves far between frames.
   */
  toRoadSpace(x: number, z: number, nearS: number, out: { s: number; t: number }): void;

  /** Ensures generated data covers the span around `s`. Called once per step. */
  ensureSpan(s: number): void;
}

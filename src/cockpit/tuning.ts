/** Layered cockpit card composition. Owned by `cockpit/`. */

export interface CardPlacement {
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly pitch?: number;
  readonly yaw?: number;
  /** Near cards move more than far cards when the driver looks into a bend. */
  readonly parallax: number;
}

export const COCKPIT_CARDS = {
  CABIN_FILL: {
    width: 2.2, height: 2.3, x: 0, y: -1.95, z: -1.15, parallax: 0.2,
  },
  SHELL: {
    width: 1.65, height: 3.57, x: -0.03, y: -0.73, z: -1.1, parallax: 0.24,
  },
  DASH_TOP: {
    width: 2.25, height: 0.72, x: 0.14, y: -0.73, z: -0.91,
    pitch: -1.18, parallax: 0.38,
  },
  DASH_FACE: {
    width: 2.1, height: 0.55, x: 0.15, y: -0.99, z: -0.85, parallax: 0.42,
  },
  DRIVER_DOOR: {
    width: 0.8, height: 1.2, x: -0.42, y: -1.28, z: -0.62,
    yaw: 0.84, parallax: 0.68,
  },
  DASH_SHADOW: {
    width: 1.35, height: 0.34, x: -0.12, y: -1.15, z: -0.79,
    pitch: -0.32, parallax: 0.5,
  },
  WHEEL_SHADOW: {
    width: 0.62, height: 0.44, x: -0.13, y: -0.76, z: -0.47,
    pitch: -0.14, parallax: 0.72,
  },
  WHEEL: {
    width: 0.52, height: 0.52, x: -0.13, y: -0.73, z: -0.42,
    pitch: -0.14, parallax: 0.78,
  },
  STEERING_RATIO: 5.2,
  SHADOW_OPACITY_DAY: 0.34,
  SHADOW_OPACITY_NIGHT: 0.56,
} as const satisfies Record<string, CardPlacement | number>;

/** Imported cabin asset placement and lighting. Owned by `cockpit/`. */

export const COCKPIT_MODEL = {
  /**
   * Driver-eye point measured in the source GLB before metre normalisation.
   * The exporter made the whole car roughly four centimetres long; keeping
   * this point in source space lets the same length correction move the eye.
   */
  SOURCE_DRIVER_EYE: [0.0026, 0.0105, -0.0035] as const,
  /**
   * Optical staging only: the cockpit pass uses a much taller frustum than a
   * physical windscreen, so the full-scale cabin is offset inside that pass.
   * Uniform model scale remains exact and simulation/world metres are untouched.
   */
  VISUAL_Y_OFFSET_M: -0.12,
  /** The wheel is a distinct node even though it arrived in one GLB. */
  STEERING_WHEEL_NODE:
    '_D_B1_2A_CD_6D_B1_2A_CD_45_03_8C_25__D1_4A_6E_58_0',
  /**
   * Full-car material islands that put an opaque roof/headliner across the
   * portrait camera. The dashboard, gauges and wheel live in other nodes.
   */
  HIDDEN_SHELL_NODES: [
    '_A6_ED_F9_68_A6_ED_F9_68_45_03_8C_16___D5_D9_73_0',
    '_A6_ED_F9_68_A6_ED_F9_68_45_03_8C_16__D1_4A_6E_58_0',
    '_A6_ED_F9_68_A6_ED_F9_68_45_03_8C_16_Windows_0',
    '_A6_ED_F9_68_A6_ED_F9_68_45_03_8C_16___03_8C_17_0',
    '_A6_ED_F9_68_A6_ED_F9_68_45_03_8C_16_Mirror_0',
  ] as const,
  /** Visible steering-wheel rotation divided by road-wheel rotation. */
  STEERING_RATIO: 5.2,
  /** The source faces +Z; the game drives toward -Z. */
  YAW_RADIANS: Math.PI,
} as const;

export const CABIN_LIGHT = {
  KEY_DISTANCE_M: 8,
  KEY_INTENSITY: 8,
  AMBIENT_INTENSITY: 3.5,
  START_KEY: 0xffe2c0,
  START_AMBIENT: 0x69728b,
} as const;

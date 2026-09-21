/**
 * World generation constants. Owned by the `world` domain.
 *
 * Nothing outside `world/` reads this file. The rest of the game sees the road
 * through `contracts/world.ts` and has no idea how any of it is made.
 */

import { DEG } from '../core/math.js';

export const ROAD = {
  /** Centreline sample spacing, metres. Smaller = smoother road, more memory. */
  STATION_SPACING_M: 4,
  /** Stations per chunk. 128 × 4 m ≈ 512 m. */
  STATIONS_PER_CHUNK: 128,
  /** Live chunks kept behind and ahead of the player. */
  CHUNKS_BEHIND: 2,
  CHUNKS_AHEAD: 10,

  /**
   * Curvature noise. `SCALE` is metres per noise unit — larger means longer,
   * lazier corners. `AMPLITUDE` is peak 1/radius, so 1/250 m is the tightest
   * the noise alone will bend.
   */
  CURVATURE_SCALE_M: 340,
  CURVATURE_AMPLITUDE: 1 / 250,
  CURVATURE_OCTAVES: 3,
  /**
   * Shaping exponent on the curvature noise, applied before the amplitude.
   *
   * Raw fbm spends most of its time near zero — measured over 20 km it left
   * 57% of the road straighter than a 1.6 km radius, which is the same
   * "no rhythm" failure as all-medium-corners seen from the other side.
   * An exponent below 1 pushes typical values outward while leaving the peaks
   * where they are, so the road gets more middling corners without the
   * hairpins becoming absurd.
   *
   * Lower = busier road, fewer places to rest. 1.0 = raw noise.
   */
  CURVATURE_SHAPE: 0.62,

  /**
   * Grade noise. Gentler and much longer wavelength than curvature — hills are
   * a bigger feature than corners. 0.075 is a 7.5% gradient at the extreme.
   */
  GRADE_SCALE_M: 900,
  GRADE_AMPLITUDE: 0.075,
  GRADE_OCTAVES: 2,
  /** Long climbs and descents underneath the ordinary undulation. */
  GRADE_LONG_SCALE_M: 2600,
  GRADE_LONG_AMPLITUDE: 0.032,
  /** Hard safety limit. 0.14 is a fourteen-percent road grade. */
  MAX_GRADE: 0.14,

  /** Road half-width, metres, and how much it varies. */
  HALF_WIDTH_M: 3.6,
  HALF_WIDTH_VARIATION_M: 0.7,
  WIDTH_SCALE_M: 1300,

  /**
   * Banking. Real roads bank into corners; the amount is proportional to
   * curvature up to a cap. Higher = more dramatic, easier to over-do.
   */
  BANK_PER_CURVATURE: 190,
  BANK_MAX: 6 * DEG,

  /** Shoulder and verge widths either side of the tarmac, metres. */
  SHOULDER_M: 0.8,
  VERGE_M: 6.0,

  /** Painted line half-widths, metres. Centre is a solid double yellow. */
  CENTRE_LINE_M: 0.055,
  CENTRE_LINE_GAP_M: 0.055,
  EDGE_LINE_M: 0.06,
} as const;

/**
 * Road events — hand-authored shapes injected on top of the noise.
 *
 * This is the anti-monotony mechanism and the highest-leverage place to spend
 * tuning time. Pure noise produces a road with no rhythm: all medium corners,
 * no straights, nothing to anticipate. Events give it punctuation.
 */
export const EVENTS = {
  /** Mean distance between events, metres, and how much that varies. */
  SPACING_M: 620,
  SPACING_JITTER_M: 260,
  /** An event's influence fades in and out over this distance, metres. */
  BLEND_M: 90,
} as const;

/**
 * Telegraph poles and their wires.
 *
 * The roadside's *near-field* speed cue. Vegetation starts 7.5 m out because a
 * maintained verge is bare, which means nothing sweeps past close to the car —
 * and something passing close is most of what makes speed felt rather than
 * read. Every driving game since 1982 has had these, for this reason.
 */
export const ROADSIDE = {
  /**
   * Stations between poles. At 4 m spacing, 10 is a pole every 40 m — about
   * 1.4 s apart at 100 km/h. Fewer = a faster, busier rhythm; too few and it
   * becomes a picket fence.
   */
  POLE_EVERY_STATIONS: 10,
  /** Distance from the centreline, metres. Inside the vegetation, outside the verge. */
  POLE_OFFSET_M: 8.2,
  POLE_HEIGHT_M: 8.4,
  /** Variation in height, metres, so the line is not laser-straight. */
  POLE_HEIGHT_VARIATION_M: 0.6,
  /** Quad width as a multiple of height. Only has to contain the crossarm. */
  POLE_ASPECT: 0.34,

  /** Wires strung between consecutive poles. */
  WIRE_COUNT: 3,
  /** Crossarm half-span, metres — how far the outer wires sit from the post. */
  WIRE_SPAN_M: 0.62,
  /** Height of the crossarm as a fraction of the pole. */
  WIRE_HEIGHT: 0.86,
  /** How far a wire sags at mid-span, metres. Higher = older, more forgotten. */
  WIRE_SAG_M: 0.85,
  /** Segments per span. Enough that the catenary is a curve, not a vee. */
  WIRE_SEGMENTS: 7,

  // --- chevron signs ---
  //
  // The only piece of information the game gives the player in advance, and it
  // is given as scenery rather than as interface. There is no HUD to warn you
  // a corner is tight (docs/01-design.md §6), so the corner has to say so
  // itself — which is exactly what chevrons are for on a real road.

  /**
   * Curvature, 1/metres, above which a corner gets chevrons. 1/150 is a 150 m
   * radius. Lower threshold = signs on gentler bends, and the warning stops
   * meaning anything.
   */
  CHEVRON_MIN_CURVATURE: 1 / 150,
  /** Stations between signs through a marked corner. 4 is one every 16 m. */
  CHEVRON_EVERY_STATIONS: 4,
  /** Distance from the centreline, metres. Outside the verge, inside the poles. */
  CHEVRON_OFFSET_M: 6.9,
  /** Plate size and the height of its bottom edge above the ground, metres. */
  CHEVRON_WIDTH_M: 0.95,
  CHEVRON_PLATE_M: 0.78,
  CHEVRON_POST_M: 0.95,

  // --- guardrail ---
  /** Distance beyond the tarmac edge, metres. */
  GUARDRAIL_GAP_M: 0.72,
  /** Sample the terrain this far outside the rail to decide whether it drops away. */
  GUARDRAIL_DROP_SAMPLE_M: 18,
  /** Minimum fall beyond the shoulder before protection appears, metres. */
  GUARDRAIL_MIN_DROP_M: 1.65,
  GUARDRAIL_HEIGHT_M: 0.82,
  GUARDRAIL_BEAM_BOTTOM_M: 0.53,
  /** Support spacing in stations. Two at 4 m gives an 8 m graphic rhythm. */
  GUARDRAIL_POST_EVERY_STATIONS: 2,
  /** Join short threshold gaps, then reject short isolated runs. */
  GUARDRAIL_JOIN_GAP_STATIONS: 3,
  GUARDRAIL_MIN_RUN_STATIONS: 6,
} as const;

/**
 * Roadside vegetation — the dark shrub clusters the art target is full of.
 *
 * Billboards, per ADR-0003's 2.5D half. Everything here trades between a
 * roadside that feels inhabited and one that costs a frame.
 */
export const VEGETATION = {
  /**
   * Candidate plants per station, each one either placed or skipped. With
   * 4 m stations this is the *ceiling* on density, not the density.
   */
  PER_STATION: 3,
  /**
   * Fraction of candidates that survive, at the thickest. Lower = sparser
   * everywhere; the clumping comes from COVER_SCALE_M, not from here.
   */
  COVER_MAX: 0.62,
  /** Floor, so a clearing is a clearing and not a desert. */
  COVER_MIN: 0.06,
  /**
   * Metres over which cover rises and falls. Long enough that you drive
   * through a thicket and out the other side rather than past a texture.
   */
  COVER_SCALE_M: 260,

  /** Nearest and furthest a plant may stand from the centreline, metres. */
  NEAR_M: 7.5,
  FAR_M: 90,
  /**
   * Bias on the lateral distribution. Above 1 pushes plants outward, which
   * keeps the verge clear and the middle distance full.
   */
  LATERAL_BIAS: 1.7,

  /** Size range, metres. Width is derived from height. */
  MIN_HEIGHT_M: 1.1,
  MAX_HEIGHT_M: 3.4,
  /** Width as a multiple of height. Above 1 = squat and shrubby. */
  ASPECT: 1.15,
  /** Fraction that are the tall narrow kind rather than a mound. */
  SPIRE_FRACTION: 0.18,

  /**
   * How far a plant sinks into the ground, as a fraction of its height. A
   * billboard standing exactly on the surface shows a hard straight edge
   * where it meets the ground on a slope.
   */
  SINK: 0.06,
} as const;

export const TERRAIN = {
  /** How far the terrain ribbon extends either side of the road, metres. */
  WIDTH_M: 360,
  /**
   * Authored lateral samples for each side, metres from the centreline.
   * Most vertices live in the first 50 m where individual rock faces can be
   * seen; the far field keeps broad triangles where haze hides the spacing.
   */
  CROSS_SECTION_M: [6, 7.5, 9, 11, 14, 18, 23, 29, 37, 48, 62, 82, 108, 142, 188, 248, 308, 360],
  /** Fine relief laid over the authored large-scale landform, metres and scale. */
  RELIEF_M: 18,
  RELIEF_SCALE_M: 260,
  /**
   * How far from the road the terrain is held flat before relief takes over.
   * Without this, hills push through the tarmac.
   */
  FLAT_MARGIN_M: 7.5,
  BLEND_M: 24,
} as const;

/**
 * Kilometre-scale 3D compositions around the road.
 *
 * A feature cell fades to calm ground at both ends, so categorical scenes can
 * change without a seam. Heights are deliberately much larger than the fine
 * terrain noise: these values make a road sit on a mountainside rather than
 * on a wrinkled sheet.
 */
export const LANDFORMS = {
  CELL_M: 1320,
  EDGE_BLEND_M: 190,
  /** Where an engineered cutting or an exposed drop may begin. */
  BREAK_START_M: 8.5,
  /** Rising slopes develop more gradually than the near-sheer exposed edge. */
  WALL_FACE_ONE_BLEND_M: 11,
  WALL_LEDGE_M: 6,
  WALL_FACE_TWO_BLEND_M: 17,
  DROP_BLEND_M: 15,
  /** Shares of final wall height established by the two close rock faces. */
  WALL_FACE_ONE_SHARE: 0.11,
  WALL_FACE_TWO_SHARE: 0.16,
  DROP_NEAR_HEIGHT_SHARE: 0.76,
  /** Slow variation breaks a kilometre-long slope into shoulders and bowls. */
  MACRO_NOISE_SCALE_M: 390,
  MACRO_VARIATION: 0.24,
  /** Mountain scenes: open-side depth and closed-side wall height. */
  MOUNTAIN_DROP_M: 92,
  MOUNTAIN_WALL_M: 122,
  MOUNTAIN_PASS_WALL_M: 92,
  /** Desert scenes substitute canyon walls and basins for water. */
  DESERT_DROP_M: 54,
  DESERT_WALL_M: 92,
  /** Country keeps the same compositions at a gentler scale. */
  COUNTRY_DROP_M: 36,
  COUNTRY_WALL_M: 54,
  /** Fraction of feature cells that are lake shelves in eligible biomes. */
  MOUNTAIN_LAKE_CHANCE: 0.46,
  COUNTRY_LAKE_CHANCE: 0.28,
  /** Independent small relief on the two sides avoids mirrored terrain. */
  SIDE_NOISE_SCALE_M: 145,
  SIDE_NOISE_MOUNTAIN_M: 22,
  SIDE_NOISE_DESERT_M: 15,
  SIDE_NOISE_COUNTRY_M: 9,
  /** Short-scale displacement restricted to the close, rising rock side. */
  CRAG_SCALE_ALONG_M: 26,
  CRAG_SCALE_ACROSS_M: 18,
  CRAG_FADE_START_M: 72,
  CRAG_FADE_M: 58,
  CRAG_MOUNTAIN_M: 4.2,
  CRAG_DESERT_M: 3.4,
  CRAG_COUNTRY_M: 1.8,
} as const;

/** Real 3D water surfaces placed in mountain and country lake shelves. */
export const WATER = {
  /** Below this fade weight the surface is fully buried and emits no triangles. */
  ACTIVE_EPSILON: 0.015,
  /** Shore begins well outside the maintained verge and guardrail. */
  SHORE_M: 46,
  /** Stop just inside the terrain ribbon edge to hide the rectangular boundary. */
  OUTER_MARGIN_M: 8,
  /** Water plane below the lowest road station in its landscape cell. */
  BELOW_LOW_ROAD_M: 16,
  /** Lake floor is forced this far under the water so it cannot poke through. */
  FLOOR_CLEARANCE_M: 12,
  /** Sink feature ends below the terrain instead of ending in a hard cross-edge. */
  EDGE_SINK_M: 26,
  MOUNTAIN_COLOR: 0x365f78,
  COUNTRY_COLOR: 0x456f71,
} as const;

/**
 * Faceted near-field stones. They are real geometry where a billboard's
 * flatness would be obvious, then dither away into the authored roadside as
 * distance makes the extra volume impossible to read.
 */
export const NEAR_PROPS = {
  EVERY_STATIONS: 1,
  CHANCE: 0.2,
  NEAR_M: 7.2,
  FAR_M: 22,
  MIN_HEIGHT_M: 0.28,
  MAX_HEIGHT_M: 1.05,
  MIN_WIDTH_M: 0.4,
  MAX_WIDTH_M: 1.35,
  FADE_START_M: 58,
  FADE_END_M: 82,
} as const;

/** Large-scale regions. A cell is mostly one biome with a long blended entry. */
export const BIOMES = {
  /** Average authored region length. */
  CELL_M: 5600,
  /** Transition length at the start of each cell. */
  BLEND_M: 1400,
  /** Palette order matches `BiomeWeights`: mountain, desert, country. */
  TERRAIN_LOW: [0x5d554b, 0xa95f38, 0x59633b] as const,
  TERRAIN_HIGH: [0x807467, 0xc9854f, 0x7c8048] as const,
  TERRAIN_ROCK: [0x554f5e, 0x864450, 0x635b55] as const,
  VERGE: [0x685844, 0xa9643b, 0x647044] as const,
  SHOULDER: [0x6f5548, 0x8f523d, 0x6e5944] as const,
  PLANT_BASE: [0x213229, 0x46372c, 0x2e3b27] as const,
  PLANT_TIP: [0x425446, 0x776044, 0x667044] as const,
  /** Relative plant density by biome. */
  PLANT_COVER: [1.15, 0.42, 1.0] as const,
  /** Relative plant height by biome. */
  PLANT_HEIGHT: [1.32, 0.72, 1.0] as const,
  /** Mountain pine, desert cactus and country spire chances. */
  MOUNTAIN_SPIRE_CHANCE: 0.72,
  DESERT_CACTUS_CHANCE: 0.38,
  COUNTRY_SPIRE_CHANCE: 0.16,
} as const;

/** Height-aware atmospheric haze layered over the palette's distance fog. */
export const HEIGHT_FOG = {
  /** Fog plane relative to the road under the camera, metres. */
  BASE_ABOVE_ROAD_M: 4,
  /** Vertical scale of the haze. Larger lets it climb further up hills. */
  SCALE_M: 42,
  /** Contribution of height haze to the existing distance-fog curve. */
  STRENGTH: 0.72,
} as const;

export const SKY = {
  /** Sky shell radius. Must exceed the furthest ridge layer. */
  RADIUS_M: 6000,
  /** How fast the cloud decks slide, in noise units per second. Very slow. */
  CLOUD_DRIFT: 0.0035,
  /** Narrow noise thresholds give the clouds hard cut-paper edges. */
  CLOUD_HIGH_SOFTNESS: 0.026,
  CLOUD_LOW_SOFTNESS: 0.018,
  /** Moon is opposite the sun and becomes the cool night key. */
  MOON_DISC_COLOR: 0xd9e4ff,
  MOON_HALO_COLOR: 0x7183b8,
  MOON_LIGHT_COLOR: 0x6f83b8,
  MOON_LIGHT_STRENGTH: 0.34,
} as const;

/**
 * Distant mountain layers (ADR-0003). Four silhouettes at increasing
 * distance, each washed further toward the sky colour.
 */
export const RIDGES = {
  LAYERS: 4,
  /** Vertical strips per layer. More = finer crests, linearly more cost. */
  COLUMNS: 192,
  NEAREST_M: 1400,
  FURTHEST_M: 5200,
  /**
   * Peak height above the horizon plane, near layer and far layer. The near
   * layer at 420 m and 1.4 km away subtends about 17°, which is a proper
   * mountain rather than a bump on the skyline.
   */
  HEIGHT_NEAR_M: 420,
  HEIGHT_FAR_M: 1500,
  /** Relative silhouette height in mountain, desert and country regions. */
  BIOME_HEIGHT: [1.0, 0.54, 0.3] as const,
  /**
   * Metres per noise unit. Has to be well under the layer radius or the whole
   * ring falls inside one noise period and the range comes out as a single
   * bulge — larger is *not* lazier here, it is flatter.
   */
  SCALE_M: 620,
  /** How far the curtain hangs below the horizon, covering the terrain's edge. */
  SKIRT_M: 700,
  /** Height over which a ridge's base washes into haze. */
  BASE_FADE_M: 55,
} as const;

export const TIME = {
  /** Seconds for one full dawn-to-dawn cycle. ~25 minutes. */
  CYCLE_SECONDS: 25 * 60,
  /** Where the cycle starts on a fresh drive. 0 = midnight, 0.25 = dawn. */
  START_PHASE: 0.27,
} as const;

export const DAY = {
  /** Sun elevation at noon, radians. A mid-latitude sun, not a tropical one. */
  MAX_SUN_ELEVATION: 62 * DEG,
  /**
   * Where the sun sits at dawn. Chosen so golden hour puts it ahead and
   * slightly left of a car heading down -Z, which is the art target's
   * composition. The azimuth sweeps a full turn per day from here.
   */
  SUN_AZIMUTH_BASE: 0.63,
} as const;

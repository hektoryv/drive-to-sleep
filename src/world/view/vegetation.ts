/**
 * Roadside vegetation, as camera-facing billboards.
 *
 * The other half of ADR-0003: the road and terrain are real 3D, and the things
 * standing on them are flat. A shrub is a quad with a lumpy hole cut in it,
 * which at 30 m and under fog is indistinguishable from a shrub and costs two
 * triangles instead of three hundred.
 *
 * Three decisions worth knowing about:
 *
 * 1. **The billboard is built in the vertex shader**, not on the CPU. The
 *    buffer holds one anchor position repeated four times plus a corner
 *    offset; the shader expands it around the anchor in view space. Nothing is
 *    recomputed as the camera turns, so a quarter of a million vertices of
 *    shrubbery costs one draw call and no per-frame work at all.
 *
 * 2. **It is cylindrical, not spherical.** The expansion uses *world* up
 *    rather than the camera's up, so the plants stay vertical when the car
 *    leans into a corner. Using view-space up instead makes the whole
 *    roadside roll with the body, which reads as the world tilting.
 *
 * 3. **The silhouette is drawn, not sampled.** No texture: the shape is a
 *    handful of circles maxed together in the fragment shader and cut out with
 *    `discard`. That keeps the APK free of art assets, lets every plant have a
 *    different outline for one float of variation, and — because it discards
 *    rather than blends — needs no back-to-front sorting.
 */

import * as THREE from 'three';
import { fbm1, hash2D01 } from '../../core/rng.js';
import { BIOMES, VEGETATION } from '../tuning.js';
import { terrainHeightAt } from '../gen/terrain.js';
import {
  biomeWeightsAt,
  dominantBiome,
  makeBiomeWeights,
} from '../gen/biomes.js';
import type { Stations } from '../gen/stations.js';
import { WORLD_COMMON_GLSL, type WorldUniforms } from './materials.js';

const VERT = /* glsl */ `
  attribute vec2 corner;
  attribute vec2 size;
  attribute float variant;
  attribute float kind;
  attribute vec3 biome;

  varying vec2 vUv;
  varying float vVariant;
  varying float vKind;
  varying vec3 vBiome;
  varying vec3 vWorld;
  varying vec3 vNormal;

  void main() {
    vUv = corner + vec2(0.5, 0.0);
    vVariant = variant;
    vKind = kind;
    vBiome = biome;

    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;

    // The frame is built in *world* space and then carried into view space,
    // rather than the other way round. Two reasons: the up axis must be the
    // world's and not the camera's — the camera rolls with the car, and plants
    // that roll with it read as the whole world tilting — and the world-space
    // right is needed again below for the normal. Deriving it back out of the
    // view matrix would want inverse(), which GLSL ES 1.00 does not have.
    vec3 worldToCam = normalize(cameraPosition - world.xyz);
    vec3 worldRight = normalize(cross(vec3(0.0, 1.0, 0.0), worldToCam));

    vec4 mv = viewMatrix * world;
    mv.xyz += (viewMatrix * vec4(worldRight, 0.0)).xyz * (corner.x * size.x)
            + (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz * (corner.y * size.y);
    gl_Position = projectionMatrix * mv;

    // A fanned normal, so the side of the plant facing the sun lights up and
    // the other side falls to ambient. There is no real surface to take a
    // normal from, and a flat one would make every plant on the roadside
    // exactly as bright as its neighbour — which is what gives billboards away.
    vNormal = normalize(worldRight * corner.x * 1.8 + vec3(0.0, 0.45, 0.0) + worldToCam * 0.7);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uBaseMountain;
  uniform vec3 uBaseDesert;
  uniform vec3 uBaseCountry;
  uniform vec3 uTipMountain;
  uniform vec3 uTipDesert;
  uniform vec3 uTipCountry;
  varying vec2 vUv;
  varying float vVariant;
  varying float vKind;
  varying vec3 vBiome;
  ${WORLD_COMMON_GLSL}

  /**
   * Signed distance to a mound of overlapping lobes. Positive inside.
   * The variant rotates the lobes around, so no two plants share an outline.
   */
  float mound(vec2 p, float v) {
    float d = -1.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float a = v * 6.2831853 + fi * 1.9;
      vec2 c = vec2(cos(a) * 0.21, 0.24 + sin(a) * 0.10 + fi * 0.07);
      float r = 0.21 - fi * 0.021;
      d = max(d, r - length(p - c));
    }
    return d;
  }

  /** A tall narrow one — the thing that breaks a horizon of identical mounds. */
  float spire(vec2 p, float v) {
    float lean = (v - 0.5) * 0.12;
    vec2 q = vec2(p.x - lean * p.y * 2.0, p.y);
    // Width tapering to nothing at the top, so it comes to a point. The first
    // version held a constant-ish width and then cut the top off with a hard
    // clamp, which made every tall plant a flat-topped black obelisk.
    float w = 0.15 * pow(max(0.0, 1.0 - q.y), 0.55);
    return w - abs(q.x);
  }

  /** Sparse desert cactus: trunk plus two raised arms. */
  float cactus(vec2 p, float v) {
    float trunk = 0.09 - abs(p.x);
    float leftArm = min(0.055 - abs(p.x + 0.17), 0.38 - abs(p.y - 0.42));
    float rightArm = min(0.05 - abs(p.x - 0.16), 0.28 - abs(p.y - 0.54));
    float leftJoin = min(0.22 - abs(p.x + 0.08), 0.05 - abs(p.y - 0.31));
    float rightJoin = min(0.2 - abs(p.x - 0.08), 0.05 - abs(p.y - 0.43));
    return max(max(trunk, leftArm), max(rightArm, max(leftJoin, rightJoin))) + v * 0.005;
  }

  void main() {
    vec2 p = vec2(vUv.x - 0.5, vUv.y);
    float v = fract(vVariant);
    float d = vKind > 1.5
      ? cactus(p, fract(v * 29.0))
      : (vKind > 0.5 ? spire(p, fract(v * 37.0)) : mound(p, fract(v * 17.0)));

    // Hard cut. Blending would need these sorted back to front, and there are
    // thousands of them.
    if (d < 0.0) discard;

    // Darker at the base, where a real plant is in its own shadow, and a
    // touch lighter at the tips. Most of the colour is the lighting.
    vec3 base = uBaseMountain * vBiome.x + uBaseDesert * vBiome.y + uBaseCountry * vBiome.z;
    vec3 tip = uTipMountain * vBiome.x + uTipDesert * vBiome.y + uTipCountry * vBiome.z;
    vec3 albedo = mix(base, tip, smoothstep(0.0, 0.85, vUv.y));
    // Per-plant tint, so a thicket is not one flat colour.
    albedo *= 0.82 + 0.3 * fract(v * 53.0);

    gl_FragColor = vec4(applyFog(lightSurface(albedo, vNormal)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface Vegetation {
  readonly mesh: THREE.Mesh;
  rebuild(stations: Stations, originX: number, originY: number, originZ: number): void;
  dispose(): void;
}

/** Corner offsets, in the order the two triangles want them. */
const CORNERS: ReadonlyArray<readonly [number, number]> = [
  [-0.5, 0],
  [0.5, 0],
  [-0.5, 1],
  [0.5, 1],
];

export function createVegetation(shared: WorldUniforms, capacityStations: number): Vegetation {
  const maxPlants = capacityStations * VEGETATION.PER_STATION;
  const vertexCount = maxPlants * 4;

  const positions = new Float32Array(vertexCount * 3);
  const corners = new Float32Array(vertexCount * 2);
  const sizes = new Float32Array(vertexCount * 2);
  const variants = new Float32Array(vertexCount);
  const kinds = new Float32Array(vertexCount);
  const biomes = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(maxPlants * 6);

  // Corners and indices never change — only which plants are live, and where.
  for (let i = 0; i < maxPlants; i++) {
    for (let c = 0; c < 4; c++) {
      const corner = CORNERS[c] as readonly [number, number];
      const vi = i * 4 + c;
      corners[vi * 2] = corner[0];
      corners[vi * 2 + 1] = corner[1];
    }
    const a = i * 4;
    indices[i * 6] = a;
    indices[i * 6 + 1] = a + 1;
    indices[i * 6 + 2] = a + 2;
    indices[i * 6 + 3] = a + 1;
    indices[i * 6 + 4] = a + 3;
    indices[i * 6 + 5] = a + 2;
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttr = new THREE.BufferAttribute(positions, 3);
  const sizeAttr = new THREE.BufferAttribute(sizes, 2);
  const variantAttr = new THREE.BufferAttribute(variants, 1);
  const kindAttr = new THREE.BufferAttribute(kinds, 1);
  const biomeAttr = new THREE.BufferAttribute(biomes, 3);
  positionAttr.setUsage(THREE.DynamicDrawUsage);
  sizeAttr.setUsage(THREE.DynamicDrawUsage);
  variantAttr.setUsage(THREE.DynamicDrawUsage);
  kindAttr.setUsage(THREE.DynamicDrawUsage);
  biomeAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttr);
  geometry.setAttribute('corner', new THREE.BufferAttribute(corners, 2));
  geometry.setAttribute('size', sizeAttr);
  geometry.setAttribute('variant', variantAttr);
  geometry.setAttribute('kind', kindAttr);
  geometry.setAttribute('biome', biomeAttr);
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      ...shared,
      uBaseMountain: { value: new THREE.Color(BIOMES.PLANT_BASE[0]) },
      uBaseDesert: { value: new THREE.Color(BIOMES.PLANT_BASE[1]) },
      uBaseCountry: { value: new THREE.Color(BIOMES.PLANT_BASE[2]) },
      uTipMountain: { value: new THREE.Color(BIOMES.PLANT_TIP[0]) },
      uTipDesert: { value: new THREE.Color(BIOMES.PLANT_TIP[1]) },
      uTipCountry: { value: new THREE.Color(BIOMES.PLANT_TIP[2]) },
    },
    // The silhouette is cut with discard, so this is an opaque surface that
    // happens to have holes in it. Depth writes, no sorting, no transparency.
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  const biome = makeBiomeWeights();
  mesh.frustumCulled = false;
  // After the terrain, so the ground is already in the depth buffer and most
  // of the discarded fragments never shade.
  mesh.renderOrder = 2;

  /**
   * How thickly planted this stretch of road is, 0..1.
   *
   * A slow noise field along the road rather than a constant, so vegetation
   * comes in thickets with clearings between them. A uniform scatter reads as
   * wallpaper however well each individual plant is drawn.
   */
  function coverAt(s: number, seed: number): number {
    const n = fbm1(s / VEGETATION.COVER_SCALE_M, seed + 7717, {
      octaves: 2,
      lacunarity: 2,
      gain: 0.5,
    });
    const u = Math.min(1, Math.max(0, n * 0.5 + 0.5));
    return VEGETATION.COVER_MIN + (VEGETATION.COVER_MAX - VEGETATION.COVER_MIN) * u;
  }

  function rebuild(stations: Stations, originX: number, originY: number, originZ: number): void {
    const first = stations.firstIndex;
    const rows = Math.min(capacityStations, stations.nextIndex - first);
    if (rows < 2) {
      geometry.setDrawRange(0, 0);
      return;
    }

    let plant = 0;

    for (let row = 0; row < rows - 1; row++) {
      const index = first + row;
      const slot = index % stations.capacity;
      const nextSlot = (index + 1) % stations.capacity;

      const ax = stations.x[slot] ?? 0;
      const ay = stations.y[slot] ?? 0;
      const az = stations.z[slot] ?? 0;
      const bx = stations.x[nextSlot] ?? ax;
      const by = stations.y[nextSlot] ?? ay;
      const bz = stations.z[nextSlot] ?? az;
      const heading = stations.heading[slot] ?? 0;

      const rx = Math.cos(heading);
      const rz = -Math.sin(heading);

      const s0 = index * stations.spacing;
      biomeWeightsAt(s0, stations.seed, biome);
      const biomeCover =
        biome.mountain * BIOMES.PLANT_COVER[0] +
        biome.desert * BIOMES.PLANT_COVER[1] +
        biome.country * BIOMES.PLANT_COVER[2];
      const cover = Math.min(1, coverAt(s0, stations.seed) * biomeCover);

      for (let k = 0; k < VEGETATION.PER_STATION; k++) {
        if (plant >= maxPlants) break;

        // Every decision below comes from the station index and the slot, so a
        // plant is in the same place whichever direction the window scrolled
        // in and however many times it has been rebuilt.
        const roll = hash2D01(index, k, stations.seed + 101);
        if (roll > cover) continue;

        // Slide along the segment and interpolate the centreline, so plants do
        // not land on a 4 m grid. Interpolating rather than reusing the
        // station's own height matters on a gradient: half a station of error
        // is enough to leave a shrub hanging in the air.
        const along = hash2D01(index, k + 31, stations.seed + 211);
        const cx = ax + (bx - ax) * along;
        const cy = ay + (by - ay) * along;
        const cz = az + (bz - az) * along;
        const s = s0 + along * stations.spacing;

        const side = hash2D01(index, k + 67, stations.seed + 313) < 0.5 ? -1 : 1;
        const spread = hash2D01(index, k + 97, stations.seed + 419);
        const t =
          side *
          (VEGETATION.NEAR_M +
            (VEGETATION.FAR_M - VEGETATION.NEAR_M) * Math.pow(spread, VEGETATION.LATERAL_BIAS));

        const grow = hash2D01(index, k + 131, stations.seed + 523);
        const heightScale =
          biome.mountain * BIOMES.PLANT_HEIGHT[0] +
          biome.desert * BIOMES.PLANT_HEIGHT[1] +
          biome.country * BIOMES.PLANT_HEIGHT[2];
        const height =
          (VEGETATION.MIN_HEIGHT_M + (VEGETATION.MAX_HEIGHT_M - VEGETATION.MIN_HEIGHT_M) * grow) *
          heightScale;
        const variant = hash2D01(index, k + 173, stations.seed + 631);
        const selectedBiome = dominantBiome(
          biome,
          hash2D01(index, k + 191, stations.seed + 691),
        );
        const kindRoll = hash2D01(index, k + 211, stations.seed + 743);
        const kind = selectedBiome === 0
          ? (kindRoll < BIOMES.MOUNTAIN_SPIRE_CHANCE ? 1 : 0)
          : selectedBiome === 1
            ? (kindRoll < BIOMES.DESERT_CACTUS_CHANCE ? 2 : 0)
            : (kindRoll < BIOMES.COUNTRY_SPIRE_CHANCE ? 1 : 0);

        const groundY = terrainHeightAt(s, t, cy, stations.seed);

        const base = plant * 4;
        for (let c = 0; c < 4; c++) {
          const vi = base + c;
          positions[vi * 3] = cx + rx * t - originX;
          positions[vi * 3 + 1] = groundY - height * VEGETATION.SINK - originY;
          positions[vi * 3 + 2] = cz + rz * t - originZ;
          sizes[vi * 2] = height * VEGETATION.ASPECT;
          sizes[vi * 2 + 1] = height;
          variants[vi] = variant;
          kinds[vi] = kind;
          biomes[vi * 3] = biome.mountain;
          biomes[vi * 3 + 1] = biome.desert;
          biomes[vi * 3 + 2] = biome.country;
        }
        plant++;
      }
    }

    geometry.setDrawRange(0, plant * 6);
    positionAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    variantAttr.needsUpdate = true;
    kindAttr.needsUpdate = true;
    biomeAttr.needsUpdate = true;
    mesh.position.set(originX, originY, originZ);
  }

  return {
    mesh,
    rebuild,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

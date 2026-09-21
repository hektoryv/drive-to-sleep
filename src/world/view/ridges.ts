/**
 * Distant mountains, as layered silhouettes.
 *
 * The 2.5D half of ADR-0003. Each layer is a curtain of geometry wrapped
 * around the camera at a fixed radius, with its top edge cut to a ridge line.
 * Four of them at increasing distances, each washed further toward the sky's
 * colour, and the horizon has depth.
 *
 * ## Why they still have parallax
 *
 * A backdrop pinned to the camera reads as painted on, which is exactly what
 * it would be. So the ridge height at a given bearing is sampled from the
 * *world position that bearing points at* — `camera + radius · direction` —
 * rather than from the bearing alone. Drive a kilometre and the near layer
 * shifts against the far one by the right amount, because the points being
 * sampled really did move by different fractions of their distance.
 *
 * That means the curtain has to be rebuilt as the camera moves. It is rebuilt
 * on a distance threshold rather than every frame: a few hundred vertices of
 * noise is cheap, but not free, and at these distances nothing changes
 * visibly over five metres.
 */

import * as THREE from 'three';
import { clamp } from '../../core/math.js';
import { fbm2, gradNoise2 } from '../../core/rng.js';
import { RIDGES } from '../tuning.js';
import {
  biomeWeightsAt,
  makeBiomeWeights,
  type BiomeWeights,
} from '../gen/biomes.js';
import type { WorldUniforms } from './materials.js';

const RIDGE_VERT = /* glsl */ `
  attribute float depth;
  varying float vDepth;
  varying float vHeight;
  void main() {
    vDepth = depth;
    vHeight = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RIDGE_FRAG = /* glsl */ `
  uniform vec3 uFogColor;
  uniform vec3 uNear;
  uniform vec3 uFar;
  uniform float uBaseFade;
  varying float vDepth;
  varying float vHeight;

  void main() {
    // Aerial perspective: further layers lose contrast and drift toward the
    // sky. This one blend is what turns four flat cut-outs into distance.
    vec3 rock = mix(uNear, uFar, vDepth);
    vec3 col = mix(rock, uFogColor, vDepth * 0.72);

    // Haze pooling in the valleys — the base of each ridge washes out into
    // the layer behind it instead of ending on a hard line.
    float base = smoothstep(0.0, uBaseFade, vHeight);
    col = mix(uFogColor, col, base);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface Ridges {
  readonly group: THREE.Group;
  /** Rebuilds if the camera has moved far enough to matter. */
  update(
    cameraX: number,
    cameraY: number,
    cameraZ: number,
    distanceM: number,
    worldSeed: number,
  ): void;
  apply(nearColor: THREE.Color, farColor: THREE.Color): void;
  dispose(): void;
}

interface Layer {
  mesh: THREE.Mesh;
  positions: Float32Array;
  attr: THREE.BufferAttribute;
  radius: number;
  /** 0 for the nearest layer, 1 for the furthest. */
  depth: number;
  seed: number;
  heightM: number;
}

/**
 * The ridge line at a world position, in metres above the horizon plane.
 *
 * Genuinely 2D. The first version collapsed x and z onto a single diagonal —
 * `(x + z) / scale` — which is cheaper and completely wrong: every bearing
 * around the ring mapped into about one noise period, so the "mountains" came
 * out as one gentle bulge, and opposite sides of the horizon were identical.
 *
 * Ridged rather than plain fbm: mountains have sharp crests and soft valleys,
 * and symmetric noise gives rounded lumps that read as hills.
 */
function ridgeHeight(
  x: number,
  z: number,
  seed: number,
  scale: number,
  biome: Readonly<BiomeWeights>,
): number {
  const u = x / scale;
  const v = z / scale;
  let height = 0;

  if (biome.mountain > 0) {
    let crest = 0;
    let amp = 1;
    let freq = 1;
    let norm = 0;
    for (let o = 0; o < 4; o++) {
      crest += (1 - Math.abs(gradNoise2(u * freq, v * freq, seed + o * 613))) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    crest = norm > 0 ? crest / norm : 0;

    // A slow undulation lets whole stretches of the range rise and fall.
    const massif = fbm2(u * 0.18, v * 0.18, seed + 991, {
      octaves: 2,
      lacunarity: 2,
      gain: 0.5,
    });
    const mountain = clamp(crest * 0.85 + massif * 0.35 - 0.12, 0.03, 1.5);
    height += mountain * biome.mountain * RIDGES.BIOME_HEIGHT[0];
  }

  if (biome.desert > 0) {
    // Broad stepped crowns read as mesas rather than alpine peaks.
    const desertMass = fbm2(u * 0.34, v * 0.34, seed + 1877, {
      octaves: 3,
      lacunarity: 2,
      gain: 0.46,
    });
    const desert = clamp(
      Math.floor(clamp(desertMass * 0.85 + 0.58, 0.08, 1.1) * 5) / 5,
      0.06,
      1.1,
    );
    height += desert * biome.desert * RIDGES.BIOME_HEIGHT[1];
  }

  if (biome.country > 0) {
    // Country uses only the slow field: overlapping hills, no serrated crest.
    const countryMass = fbm2(u * 0.2, v * 0.2, seed + 3253, {
      octaves: 2,
      lacunarity: 2,
      gain: 0.42,
    });
    const country = clamp(countryMass * 0.45 + 0.42, 0.05, 0.82);
    height += country * biome.country * RIDGES.BIOME_HEIGHT[2];
  }

  return height;
}

export function createRidges(shared: WorldUniforms): Ridges {
  const group = new THREE.Group();
  // Deliberately no renderOrder on the group. In three.js a Group's
  // renderOrder becomes the *groupOrder* of everything under it, and
  // groupOrder is compared before each object's own renderOrder. Setting it
  // here promoted all four ridge layers ahead of the sky, which is a
  // full-screen shell that writes no depth — so the sky painted straight over
  // them and they were invisible while still costing four draw calls.

  const uniforms = {
    uFogColor: shared.uFogColor,
    uNear: { value: new THREE.Color(0x6f5f8e) },
    uFar: { value: new THREE.Color(0x9a8fb4) },
    uBaseFade: { value: RIDGES.BASE_FADE_M },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: RIDGE_VERT,
    fragmentShader: RIDGE_FRAG,
    uniforms,
    // Drawn as a backdrop: it must never occlude terrain, and terrain that
    // reaches this far has already resolved to fog colour anyway.
    depthWrite: false,
    // The camera stands inside the curtain, and which way its faces point
    // depends on which way round the ring is wound. A few hundred triangles
    // is not worth being clever about.
    side: THREE.DoubleSide,
  });

  const layers: Layer[] = [];
  const columns = RIDGES.COLUMNS;
  const biome = makeBiomeWeights();

  for (let i = 0; i < RIDGES.LAYERS; i++) {
    const depth = RIDGES.LAYERS > 1 ? i / (RIDGES.LAYERS - 1) : 0;
    const radius = RIDGES.NEAREST_M + (RIDGES.FURTHEST_M - RIDGES.NEAREST_M) * depth;
    const heightM = RIDGES.HEIGHT_NEAR_M + (RIDGES.HEIGHT_FAR_M - RIDGES.HEIGHT_NEAR_M) * depth;

    const vertexCount = (columns + 1) * 2;
    const positions = new Float32Array(vertexCount * 3);
    const depths = new Float32Array(vertexCount).fill(depth);
    const indices = new Uint32Array(columns * 6);

    for (let c = 0; c < columns; c++) {
      const a = c * 2;
      indices[c * 6] = a;
      indices[c * 6 + 1] = a + 1;
      indices[c * 6 + 2] = a + 2;
      indices[c * 6 + 3] = a + 1;
      indices[c * 6 + 4] = a + 3;
      indices[c * 6 + 5] = a + 2;
    }

    const geometry = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(positions, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', attr);
    geometry.setAttribute('depth', new THREE.BufferAttribute(depths, 1));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    // Furthest first, so nearer ranges paint over them. `i` counts outward
    // from the nearest layer, so the order has to be reversed.
    mesh.renderOrder = -50 + (RIDGES.LAYERS - 1 - i);
    group.add(mesh);

    layers.push({ mesh, positions, attr, radius, depth, seed: 4200 + i * 977, heightM });
  }

  function rebuild(
    cameraX: number,
    cameraY: number,
    cameraZ: number,
    distanceM: number,
    worldSeed: number,
  ): void {
    biomeWeightsAt(distanceM, worldSeed, biome);
    for (const layer of layers) {
      const { positions, radius, heightM, seed } = layer;
      for (let c = 0; c <= columns; c++) {
        const angle = (c / columns) * Math.PI * 2;
        const dx = Math.sin(angle);
        const dz = Math.cos(angle);
        // The world point this bearing aims at — the source of the parallax.
        const wx = cameraX + dx * radius;
        const wz = cameraZ + dz * radius;
        const h = ridgeHeight(wx, wz, seed + worldSeed * 101, RIDGES.SCALE_M, biome) * heightM;

        const top = c * 2;
        const bottom = top + 1;
        positions[top * 3] = dx * radius;
        positions[top * 3 + 1] = h;
        positions[top * 3 + 2] = dz * radius;
        // Well below the horizon, so the skirt covers the gap between the end
        // of the terrain ribbon and the base of the range.
        positions[bottom * 3] = dx * radius;
        positions[bottom * 3 + 1] = -RIDGES.SKIRT_M;
        positions[bottom * 3 + 2] = dz * radius;
      }
      layer.attr.needsUpdate = true;
      // Kept at the camera's height so the ridge line sits on the true
      // horizon rather than climbing as the road does.
      layer.mesh.position.set(cameraX, cameraY, cameraZ);
    }
  }

  return {
    group,

    update(cameraX, cameraY, cameraZ, distanceM, worldSeed) {
      // Rebuilt every frame. An earlier version only re-sampled after the
      // camera had moved a few metres, which is the obvious optimisation and
      // was also a bug: the staleness test let the curtain stop updating
      // entirely, and four invisible layers are not cheaper than four visible
      // ones. It is ~1,500 vertices of 1D noise — measure before optimising.
      rebuild(cameraX, cameraY, cameraZ, distanceM, worldSeed);
    },

    apply(nearColor, farColor) {
      uniforms.uNear.value.copy(nearColor);
      uniforms.uFar.value.copy(farColor);
    },

    dispose() {
      for (const layer of layers) layer.mesh.geometry.dispose();
      material.dispose();
    },
  };
}

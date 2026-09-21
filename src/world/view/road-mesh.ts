/**
 * Sweeps the road's cross-section along the centreline into geometry.
 *
 * ## Rebuild strategy
 *
 * One buffer for the whole live window, rewritten in place whenever the window
 * advances by a whole chunk — about every 17 seconds at cruising speed. Not
 * per-chunk meshes: the live road runs 6.6 km and the far plane is at 4 km, so
 * the far end of the buffer is always at least half a kilometre beyond
 * anything visible and nothing can pop. One mesh, one draw call, no chunk
 * lifecycle to get wrong.
 *
 * ## Floating origin
 *
 * Vertex positions are stored relative to a rebase point near the camera, and
 * the mesh carries that point as its transform. A float32 at 500 km has a 6 cm
 * resolution — visible jitter in road geometry — while three.js composes the
 * model-view matrix on the CPU in float64, so keeping the vertices small and
 * the offset in the matrix preserves precision however far you drive.
 *
 * Nothing allocates after construction.
 */

import * as THREE from 'three';
import { ROAD } from '../tuning.js';
import { terrainHeightAt } from '../gen/terrain.js';
import { biomeWeightsAt, makeBiomeWeights } from '../gen/biomes.js';
import type { Stations } from '../gen/stations.js';

/**
 * The cross-section, as lateral offsets. Only seven points wide: the road's
 * *materials* — tarmac, shoulder, verge, painted lines — are drawn
 * analytically in the fragment shader from the lateral coordinate, so geometry
 * is needed only where the surface actually changes shape.
 *
 * Offsets are expressed as (multiple of half-width, plus fixed metres), since
 * the road's width varies along its length.
 */
const PROFILE: Array<{ widthScale: number; offsetM: number; drop: number }> = [
  { widthScale: 0, offsetM: -ROAD.VERGE_M, drop: 1 },
  { widthScale: -1, offsetM: -ROAD.SHOULDER_M, drop: 0.12 },
  { widthScale: -1, offsetM: 0, drop: 0 },
  { widthScale: 0, offsetM: 0, drop: 0 },
  { widthScale: 1, offsetM: 0, drop: 0 },
  { widthScale: 1, offsetM: ROAD.SHOULDER_M, drop: 0.12 },
  { widthScale: 0, offsetM: ROAD.VERGE_M, drop: 1 },
];

const ACROSS = PROFILE.length;

export interface RoadMesh {
  readonly mesh: THREE.Mesh;
  /**
   * Rewrites the geometry for the current station window.
   * `originX/Y/Z` is the rebase point — see the note above.
   */
  rebuild(stations: Stations, originX: number, originY: number, originZ: number): void;
  dispose(): void;
}

export function createRoadMesh(material: THREE.Material, capacityStations: number): RoadMesh {
  const vertexCount = capacityStations * ACROSS;
  const quadCount = (capacityStations - 1) * (ACROSS - 1);

  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const lateral = new Float32Array(vertexCount);
  const halfWidths = new Float32Array(vertexCount);
  const biomes = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(quadCount * 6);

  const geometry = new THREE.BufferGeometry();
  const positionAttr = new THREE.BufferAttribute(positions, 3);
  const normalAttr = new THREE.BufferAttribute(normals, 3);
  const lateralAttr = new THREE.BufferAttribute(lateral, 1);
  const halfWidthAttr = new THREE.BufferAttribute(halfWidths, 1);
  const biomeAttr = new THREE.BufferAttribute(biomes, 3);
  positionAttr.setUsage(THREE.DynamicDrawUsage);
  normalAttr.setUsage(THREE.DynamicDrawUsage);
  lateralAttr.setUsage(THREE.DynamicDrawUsage);
  halfWidthAttr.setUsage(THREE.DynamicDrawUsage);
  biomeAttr.setUsage(THREE.DynamicDrawUsage);

  geometry.setAttribute('position', positionAttr);
  geometry.setAttribute('normal', normalAttr);
  geometry.setAttribute('lateral', lateralAttr);
  geometry.setAttribute('halfWidth', halfWidthAttr);
  geometry.setAttribute('biome', biomeAttr);
  const indexAttr = new THREE.BufferAttribute(indices, 1);
  indexAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setIndex(indexAttr);

  const mesh = new THREE.Mesh(geometry, material);
  const biome = makeBiomeWeights();
  // The mesh spans kilometres and is always in view; culling it against a
  // bounding sphere that would have to be recomputed on every rebuild is
  // strictly wasted work.
  mesh.frustumCulled = false;

  function rebuild(stations: Stations, originX: number, originY: number, originZ: number): void {
    const first = stations.firstIndex;
    const last = stations.nextIndex - 1;
    const rows = Math.min(capacityStations, last - first + 1);
    if (rows < 2) {
      geometry.setDrawRange(0, 0);
      return;
    }

    for (let row = 0; row < rows; row++) {
      const index = first + row;
      const slot = index % stations.capacity;

      const sx = stations.x[slot] ?? 0;
      const sy = stations.y[slot] ?? 0;
      const sz = stations.z[slot] ?? 0;
      const heading = stations.heading[slot] ?? 0;
      const bank = stations.bank[slot] ?? 0;
      const halfWidth = stations.halfWidth[slot] ?? ROAD.HALF_WIDTH_M;
      const s = index * stations.spacing;
      biomeWeightsAt(s, stations.seed, biome);

      // Right-hand normal of the direction of travel.
      const rx = Math.cos(heading);
      const rz = -Math.sin(heading);

      // Superelevation: the cross-section rotates about the forward axis, so
      // the outside of the corner rises. Positive curvature bends right, so a
      // positive bank lifts the left-hand (negative) side.
      const cosBank = Math.cos(bank);
      const sinBank = Math.sin(bank);

      for (let col = 0; col < ACROSS; col++) {
        const p = PROFILE[col] as (typeof PROFILE)[number];
        const t = p.widthScale * halfWidth + p.offsetM;
        const vi = row * ACROSS + col;

        let y: number;
        if (p.drop >= 1) {
          // The outer verge takes its height straight from the terrain field,
          // so the two meshes meet by construction rather than by agreement.
          y = terrainHeightAt(s, t, sy, stations.seed);
        } else {
          y = sy - t * sinBank - p.drop;
        }

        positions[vi * 3] = sx + rx * t * cosBank - originX;
        positions[vi * 3 + 1] = y - originY;
        positions[vi * 3 + 2] = sz + rz * t * cosBank - originZ;
        lateral[vi] = t;
        halfWidths[vi] = halfWidth;
        biomes[vi * 3] = biome.mountain;
        biomes[vi * 3 + 1] = biome.desert;
        biomes[vi * 3 + 2] = biome.country;
      }
    }

    writeIndices(indices, rows, ACROSS);
    computeNormals(positions, normals, indices, rows * ACROSS, (rows - 1) * (ACROSS - 1) * 6);

    geometry.setDrawRange(0, (rows - 1) * (ACROSS - 1) * 6);
    positionAttr.needsUpdate = true;
    normalAttr.needsUpdate = true;
    lateralAttr.needsUpdate = true;
    halfWidthAttr.needsUpdate = true;
    biomeAttr.needsUpdate = true;
    indexAttr.needsUpdate = true;

    mesh.position.set(originX, originY, originZ);
  }

  return {
    mesh,
    rebuild,
    dispose() {
      geometry.dispose();
    },
  };
}

/**
 * Two triangles per quad.
 *
 * Winding is (a, b, c) / (b, d, c) so that `(v1-v0) x (v2-v0)` comes out as
 * right × forward, which points up. Getting this backwards inverts every
 * normal in the world and lights the whole landscape from underneath.
 */
export function writeIndices(indices: Uint32Array, rows: number, across: number): void {
  let w = 0;
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < across - 1; col++) {
      const a = row * across + col;
      const b = a + 1;
      const c = a + across;
      const d = c + 1;
      indices[w++] = a;
      indices[w++] = b;
      indices[w++] = c;
      indices[w++] = b;
      indices[w++] = d;
      indices[w++] = c;
    }
  }
}

/**
 * Face-area-weighted vertex normals, written in place.
 *
 * Hand-rolled rather than `computeVertexNormals()` because that reallocates
 * the normal attribute every call, and this runs on a rebuild while the player
 * is driving — an allocation there is a stutter.
 */
export function computeNormals(
  positions: Float32Array,
  normals: Float32Array,
  indices: Uint32Array,
  vertexCount: number,
  indexCount: number,
): void {
  normals.fill(0, 0, vertexCount * 3);

  for (let i = 0; i < indexCount; i += 3) {
    const ia = (indices[i] ?? 0) * 3;
    const ib = (indices[i + 1] ?? 0) * 3;
    const ic = (indices[i + 2] ?? 0) * 3;

    const ax = positions[ia] ?? 0;
    const ay = positions[ia + 1] ?? 0;
    const az = positions[ia + 2] ?? 0;
    const e1x = (positions[ib] ?? 0) - ax;
    const e1y = (positions[ib + 1] ?? 0) - ay;
    const e1z = (positions[ib + 2] ?? 0) - az;
    const e2x = (positions[ic] ?? 0) - ax;
    const e2y = (positions[ic + 1] ?? 0) - ay;
    const e2z = (positions[ic + 2] ?? 0) - az;

    // Unnormalised cross product, so larger faces weigh more.
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;

    normals[ia] = (normals[ia] ?? 0) + nx;
    normals[ia + 1] = (normals[ia + 1] ?? 0) + ny;
    normals[ia + 2] = (normals[ia + 2] ?? 0) + nz;
    normals[ib] = (normals[ib] ?? 0) + nx;
    normals[ib + 1] = (normals[ib + 1] ?? 0) + ny;
    normals[ib + 2] = (normals[ib + 2] ?? 0) + nz;
    normals[ic] = (normals[ic] ?? 0) + nx;
    normals[ic + 1] = (normals[ic + 1] ?? 0) + ny;
    normals[ic + 2] = (normals[ic + 2] ?? 0) + nz;
  }

  for (let v = 0; v < vertexCount; v++) {
    const o = v * 3;
    const x = normals[o] ?? 0;
    const y = normals[o + 1] ?? 0;
    const z = normals[o + 2] ?? 0;
    const len = Math.hypot(x, y, z);
    if (len > 1e-12) {
      normals[o] = x / len;
      normals[o + 1] = y / len;
      normals[o + 2] = z / len;
    } else {
      normals[o] = 0;
      normals[o + 1] = 1;
      normals[o + 2] = 0;
    }
  }
}

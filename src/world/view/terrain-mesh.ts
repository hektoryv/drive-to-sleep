/**
 * Terrain ribbons either side of the road.
 *
 * Swept along the same stations as the road and sampled in road coordinates,
 * so the inner edge takes its height from exactly the same function the road's
 * outer verge does. The two meshes meet because they cannot do otherwise.
 *
 * Samples are spaced non-linearly across the ribbon — dense near the road
 * where the eye is, sparse at the far edge where fog is about to take over
 * anyway. That buys most of the apparent resolution for a third of the
 * vertices.
 */

import * as THREE from 'three';
import { ROAD, TERRAIN } from '../tuning.js';
import { terrainHeightAt } from '../gen/terrain.js';
import { biomeWeightsAt, makeBiomeWeights } from '../gen/biomes.js';
import type { Stations } from '../gen/stations.js';
import { computeNormals } from './road-mesh.js';

/**
 * Lateral offsets for one side, from the verge outward. Cubic-ish spacing:
 * `pow(u, 2.2)` puts roughly half the samples in the first fifth of the width.
 */
function buildSideOffsets(): number[] {
  const out: number[] = [];
  for (let i = 0; i < TERRAIN.SAMPLES_ACROSS; i++) {
    const u = i / (TERRAIN.SAMPLES_ACROSS - 1);
    out.push(ROAD.VERGE_M + (TERRAIN.WIDTH_M - ROAD.VERGE_M) * Math.pow(u, 2.2));
  }
  return out;
}

const SIDE = buildSideOffsets();
/** Left side outermost-inward, then right side innermost-outward. */
const PROFILE: number[] = [...SIDE.map((t) => -t).reverse(), ...SIDE];
const ACROSS = PROFILE.length;
/** The column pair straddling the road itself, which the road mesh covers. */
const SEAM_COLUMN = SIDE.length - 1;

export interface TerrainMesh {
  readonly mesh: THREE.Mesh;
  rebuild(stations: Stations, originX: number, originY: number, originZ: number): void;
  dispose(): void;
}

export function createTerrainMesh(material: THREE.Material, capacityStations: number): TerrainMesh {
  const vertexCount = capacityStations * ACROSS;
  // One fewer quad per row, because the strip across the road is skipped.
  const quadCount = (capacityStations - 1) * (ACROSS - 2);

  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const biomes = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(quadCount * 6);

  const geometry = new THREE.BufferGeometry();
  const positionAttr = new THREE.BufferAttribute(positions, 3);
  const normalAttr = new THREE.BufferAttribute(normals, 3);
  const biomeAttr = new THREE.BufferAttribute(biomes, 3);
  positionAttr.setUsage(THREE.DynamicDrawUsage);
  normalAttr.setUsage(THREE.DynamicDrawUsage);
  biomeAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttr);
  geometry.setAttribute('normal', normalAttr);
  geometry.setAttribute('biome', biomeAttr);
  const indexAttr = new THREE.BufferAttribute(indices, 1);
  indexAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setIndex(indexAttr);

  const mesh = new THREE.Mesh(geometry, material);
  const biome = makeBiomeWeights();
  mesh.frustumCulled = false;
  // Drawn after the road so that where the two surfaces coincide at the verge,
  // the road wins the depth test rather than flickering against it.
  mesh.renderOrder = 1;

  function rebuild(stations: Stations, originX: number, originY: number, originZ: number): void {
    const first = stations.firstIndex;
    const rows = Math.min(capacityStations, stations.nextIndex - first);
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
      const s = index * stations.spacing;
      biomeWeightsAt(s, stations.seed, biome);

      const rx = Math.cos(heading);
      const rz = -Math.sin(heading);

      for (let col = 0; col < ACROSS; col++) {
        const t = PROFILE[col] ?? 0;
        const vi = row * ACROSS + col;
        positions[vi * 3] = sx + rx * t - originX;
        positions[vi * 3 + 1] = terrainHeightAt(s, t, sy, stations.seed) - originY;
        positions[vi * 3 + 2] = sz + rz * t - originZ;
        biomes[vi * 3] = biome.mountain;
        biomes[vi * 3 + 1] = biome.desert;
        biomes[vi * 3 + 2] = biome.country;
      }
    }

    let w = 0;
    for (let row = 0; row < rows - 1; row++) {
      for (let col = 0; col < ACROSS - 1; col++) {
        if (col === SEAM_COLUMN) continue;
        const a = row * ACROSS + col;
        const b = a + 1;
        const c = a + ACROSS;
        const d = c + 1;
        indices[w++] = a;
        indices[w++] = b;
        indices[w++] = c;
        indices[w++] = b;
        indices[w++] = d;
        indices[w++] = c;
      }
    }

    computeNormals(positions, normals, indices, rows * ACROSS, w);
    geometry.setDrawRange(0, w);
    positionAttr.needsUpdate = true;
    normalAttr.needsUpdate = true;
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

/** Low-poly 3D lake surfaces for mountain and country landscape cells. */

import * as THREE from 'three';
import { LANDFORMS, ROAD, TERRAIN, WATER } from '../tuning.js';
import { landscapeAt, makeLandscapeSample } from '../gen/landscape.js';
import type { Stations } from '../gen/stations.js';

const SIDES = 2;
const VERTS_PER_SIDE = 2;
const VERTS_PER_ROW = SIDES * VERTS_PER_SIDE;

export interface Water {
  readonly mesh: THREE.Mesh;
  rebuild(stations: Stations, originX: number, originY: number, originZ: number): void;
  dispose(): void;
}

export function createWater(material: THREE.Material, capacityStations: number): Water {
  const positions = new Float32Array(capacityStations * VERTS_PER_ROW * 3);
  const normals = new Float32Array(capacityStations * VERTS_PER_ROW * 3);
  const country = new Float32Array(capacityStations * VERTS_PER_ROW);
  const indices = new Uint32Array((capacityStations - 1) * SIDES * 6);
  const maxCells = Math.ceil((capacityStations * ROAD.STATION_SPACING_M) / LANDFORMS.CELL_M) + 4;
  const cellMinY = new Float64Array(maxCells);
  const sample = makeLandscapeSample();
  const nextSample = makeLandscapeSample();

  const geometry = new THREE.BufferGeometry();
  const positionAttr = new THREE.BufferAttribute(positions, 3);
  const normalAttr = new THREE.BufferAttribute(normals, 3);
  const countryAttr = new THREE.BufferAttribute(country, 1);
  positionAttr.setUsage(THREE.DynamicDrawUsage);
  normalAttr.setUsage(THREE.DynamicDrawUsage);
  countryAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttr);
  geometry.setAttribute('normal', normalAttr);
  geometry.setAttribute('country', countryAttr);
  const indexAttr = new THREE.BufferAttribute(indices, 1);
  indexAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setIndex(indexAttr);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;

  function rebuild(stations: Stations, originX: number, originY: number, originZ: number): void {
    const first = stations.firstIndex;
    const rows = Math.min(capacityStations, stations.nextIndex - first);
    if (rows < 2) {
      geometry.setDrawRange(0, 0);
      return;
    }

    const firstS = first * stations.spacing;
    const baseCell = Math.floor(firstS / LANDFORMS.CELL_M) - 1;
    cellMinY.fill(Infinity);

    // A lake is horizontal within its landscape cell. Anchor it below the
    // lowest road station in that cell so every visible shore remains a drop.
    for (let row = 0; row < rows; row++) {
      const index = first + row;
      const slot = index % stations.capacity;
      const s = index * stations.spacing;
      landscapeAt(s, stations.seed, sample);
      if (sample.leftLake <= WATER.ACTIVE_EPSILON && sample.rightLake <= WATER.ACTIVE_EPSILON) continue;
      const ci = sample.cell - baseCell;
      if (ci < 0 || ci >= cellMinY.length) continue;
      cellMinY[ci] = Math.min(cellMinY[ci] ?? Infinity, stations.y[slot] ?? 0);
    }

    for (let row = 0; row < rows; row++) {
      const index = first + row;
      const slot = index % stations.capacity;
      const s = index * stations.spacing;
      const sx = stations.x[slot] ?? 0;
      const sy = stations.y[slot] ?? 0;
      const sz = stations.z[slot] ?? 0;
      const heading = stations.heading[slot] ?? 0;
      const rx = Math.cos(heading);
      const rz = -Math.sin(heading);
      landscapeAt(s, stations.seed, sample);

      const ci = sample.cell - baseCell;
      const minY = ci >= 0 && ci < cellMinY.length ? (cellMinY[ci] ?? sy) : sy;
      const planeY = (Number.isFinite(minY) ? minY : sy) - WATER.BELOW_LOW_ROAD_M;

      for (let sideIndex = 0; sideIndex < SIDES; sideIndex++) {
        const side = sideIndex === 0 ? -1 : 1;
        const strength = side < 0 ? sample.leftLake : sample.rightLake;
        const y = planeY - (1 - strength) * WATER.EDGE_SINK_M - originY;
        const innerT = side * WATER.SHORE_M;
        const outerT = side * (TERRAIN.WIDTH_M - WATER.OUTER_MARGIN_M);
        const firstVertex = row * VERTS_PER_ROW + sideIndex * VERTS_PER_SIDE;
        writeVertex(firstVertex, innerT, y, sample.biome === 2 ? 1 : 0, sx, sz, rx, rz, originX, originZ);
        writeVertex(firstVertex + 1, outerT, y, sample.biome === 2 ? 1 : 0, sx, sz, rx, rz, originX, originZ);
      }
    }

    let w = 0;
    for (let row = 0; row < rows - 1; row++) {
      const s = (first + row) * stations.spacing;
      const nextS = s + stations.spacing;
      landscapeAt(s, stations.seed, sample);
      landscapeAt(nextS, stations.seed, nextSample);
      for (let sideIndex = 0; sideIndex < SIDES; sideIndex++) {
        const aStrength = sideIndex === 0 ? sample.leftLake : sample.rightLake;
        const bStrength = sideIndex === 0 ? nextSample.leftLake : nextSample.rightLake;
        if (
          aStrength <= WATER.ACTIVE_EPSILON ||
          bStrength <= WATER.ACTIVE_EPSILON ||
          sample.cell !== nextSample.cell
        ) {
          continue;
        }
        const a = row * VERTS_PER_ROW + sideIndex * VERTS_PER_SIDE;
        const b = a + 1;
        const c = a + VERTS_PER_ROW;
        const d = c + 1;
        indices[w++] = a;
        indices[w++] = c;
        indices[w++] = b;
        indices[w++] = b;
        indices[w++] = c;
        indices[w++] = d;
      }
    }

    geometry.setDrawRange(0, w);
    positionAttr.needsUpdate = true;
    normalAttr.needsUpdate = true;
    countryAttr.needsUpdate = true;
    indexAttr.needsUpdate = true;
    mesh.position.set(originX, originY, originZ);
  }

  function writeVertex(
    vertex: number,
    t: number,
    y: number,
    countryMix: number,
    centreX: number,
    centreZ: number,
    rightX: number,
    rightZ: number,
    originX: number,
    originZ: number,
  ): void {
    positions[vertex * 3] = centreX + rightX * t - originX;
    positions[vertex * 3 + 1] = y;
    positions[vertex * 3 + 2] = centreZ + rightZ * t - originZ;
    normals[vertex * 3] = 0;
    normals[vertex * 3 + 1] = 1;
    normals[vertex * 3 + 2] = 0;
    country[vertex] = countryMix;
  }

  return {
    mesh,
    rebuild,
    dispose() {
      geometry.dispose();
    },
  };
}

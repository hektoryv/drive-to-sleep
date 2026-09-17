/**
 * The environment, as a single module.
 *
 * Owns generation *and* its rendering: the road fields, the station store, the
 * meshes, the sky. Everything it draws goes into its own scene subtree, and
 * everything it exposes goes through the `road` service. Nothing outside
 * `world/` imports anything inside it (ADR-0011), so this whole domain can be
 * rewritten without the cockpit, the HUD or the simulation noticing.
 */

import type * as THREE from 'three';
import type { GameModule, ModuleContext } from '../contracts/module.js';
import type { CarView } from '../contracts/vehicle.js';
import type { ViewState } from '../contracts/view.js';
import { ROAD } from './tuning.js';
import { createRoad, type WorldRoad } from './gen/road-query.js';
import { createRoadMesh, type RoadMesh } from './view/road-mesh.js';
import { createTerrainMesh, type TerrainMesh } from './view/terrain-mesh.js';
import { createSky, type Sky } from './view/sky.js';
import {
  createRoadMaterial,
  createTerrainMaterial,
  createWorldUniforms,
  type WorldUniforms,
} from './view/materials.js';

/** Rebuild the meshes when the generated window has advanced by this much. */
const REBUILD_EVERY_STATIONS = ROAD.STATIONS_PER_CHUNK;

export function createWorldModule(): GameModule {
  let ctx: ModuleContext | undefined;
  let road: WorldRoad | undefined;
  let car: CarView | undefined;

  let uniforms: WorldUniforms | undefined;
  let roadMesh: RoadMesh | undefined;
  let terrainMesh: TerrainMesh | undefined;
  let sky: Sky | undefined;
  let roadMaterial: THREE.ShaderMaterial | undefined;
  let terrainMaterial: THREE.ShaderMaterial | undefined;

  let lastBuiltNextIndex = -Infinity;
  let builtCount = 0;

  const capacity = (ROAD.CHUNKS_BEHIND + ROAD.CHUNKS_AHEAD + 1) * ROAD.STATIONS_PER_CHUNK;

  function rebuild(): void {
    if (road === undefined || roadMesh === undefined || terrainMesh === undefined) return;
    const stations = road.stations;

    // Rebase near the car, so vertex positions stay small however far the
    // drive has gone. See the note in view/road-mesh.ts.
    const anchor = Math.max(
      stations.firstIndex,
      Math.min(stations.nextIndex - 1, Math.round((car?.distanceM ?? 0) / stations.spacing)),
    );
    const slot = anchor % stations.capacity;
    const ox = stations.x[slot] ?? 0;
    const oy = stations.y[slot] ?? 0;
    const oz = stations.z[slot] ?? 0;

    roadMesh.rebuild(stations, ox, oy, oz);
    terrainMesh.rebuild(stations, ox, oy, oz);

    lastBuiltNextIndex = stations.nextIndex;
    builtCount++;
    ctx?.events.emit('chunkChange', {
      built: builtCount,
      recycled: Math.max(0, stations.firstIndex),
      liveChunks: Math.round((stations.nextIndex - stations.firstIndex) / ROAD.STATIONS_PER_CHUNK),
    });
  }

  return {
    name: 'world',

    init(context) {
      ctx = context;
      road = createRoad(context.seed);
      context.services.provide('road', road);

      uniforms = createWorldUniforms();
      roadMaterial = createRoadMaterial(uniforms);
      terrainMaterial = createTerrainMaterial(uniforms);

      roadMesh = createRoadMesh(roadMaterial, capacity);
      terrainMesh = createTerrainMesh(terrainMaterial, capacity);
      sky = createSky(uniforms);

      context.scene.add(sky.mesh, terrainMesh.mesh, roadMesh.mesh);
    },

    start(context) {
      car = context.services.require('car');
      road?.ensureSpan(0);
      rebuild();
    },

    step() {
      if (road === undefined) return;
      road.ensureSpan(car?.distanceM ?? 0);
      if (road.stations.nextIndex - lastBuiltNextIndex >= REBUILD_EVERY_STATIONS) rebuild();
    },

    frame(_alpha: number, view: Readonly<ViewState>) {
      sky?.follow(view.x, view.y, view.z);
    },

    dispose() {
      roadMesh?.dispose();
      terrainMesh?.dispose();
      sky?.dispose();
      roadMaterial?.dispose();
      terrainMaterial?.dispose();
    },
  };
}

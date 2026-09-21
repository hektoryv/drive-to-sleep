/**
 * The environment, as a single module.
 *
 * Owns generation *and* its rendering: the road fields, the station store, the
 * meshes, the sky. Everything it draws goes into its own scene subtree, and
 * everything it exposes goes through the `road` service. Nothing outside
 * `world/` imports anything inside it (ADR-0011), so this whole domain can be
 * rewritten without the cockpit, the HUD or the simulation noticing.
 */

import * as THREE from 'three';
import type { GameModule, ModuleContext } from '../contracts/module.js';
import type { CarView } from '../contracts/vehicle.js';
import type { DaylightView } from '../contracts/daylight.js';
import type { ViewState } from '../contracts/view.js';
import { HEIGHT_FOG, ROAD, TIME } from './tuning.js';
import {
  daylightAt,
  makeSkyPalette,
  makeSunDirection,
  paletteAt,
  sunDirectionAt,
  type SkyPalette,
  type SunDirection,
} from './gen/daylight.js';
import { createRidges, type Ridges } from './view/ridges.js';
import { createRoad, type WorldRoad } from './gen/road-query.js';
import { createRoadMesh, type RoadMesh } from './view/road-mesh.js';
import { createTerrainMesh, type TerrainMesh } from './view/terrain-mesh.js';
import { createSky, type Sky } from './view/sky.js';
import { createVegetation, type Vegetation } from './view/vegetation.js';
import { createNearProps, type NearProps } from './view/near-props.js';
import { createRoadside, type Roadside } from './view/roadside.js';
import {
  createRoadMaterial,
  createTerrainMaterial,
  createWorldUniforms,
  setSrgb,
  type WorldUniforms,
} from './view/materials.js';

/** Rebuild the meshes when the generated window has advanced by this much. */
const REBUILD_EVERY_STATIONS = ROAD.STATIONS_PER_CHUNK;

/** How much darker than the cloud-shadow tone the nearest range sits. */
const RIDGE_NEAR_DARKEN = 0.55;

export interface WorldModule extends GameModule {
  /** Sets the time of day, 0 = midnight, 0.5 = noon, 0.76 = golden hour. */
  setTimePhase(phase: number): void;
  /** Stops the clock, so a screenshot is taken at exactly the time asked for. */
  setTimeFrozen(frozen: boolean): void;
  readonly timePhase: number;
}

export function createWorldModule(): WorldModule {
  let ctx: ModuleContext | undefined;
  let road: WorldRoad | undefined;
  let car: CarView | undefined;

  let uniforms: WorldUniforms | undefined;
  let roadMesh: RoadMesh | undefined;
  let terrainMesh: TerrainMesh | undefined;
  let sky: Sky | undefined;
  let ridges: Ridges | undefined;
  let vegetation: Vegetation | undefined;
  let nearProps: NearProps | undefined;
  let roadside: Roadside | undefined;
  let roadMaterial: THREE.ShaderMaterial | undefined;
  let terrainMaterial: THREE.ShaderMaterial | undefined;

  let lastBuiltNextIndex = -Infinity;
  let builtCount = 0;

  const capacity = (ROAD.CHUNKS_BEHIND + ROAD.CHUNKS_AHEAD + 1) * ROAD.STATIONS_PER_CHUNK;

  // The time of day. One value, driving the sun and every colour in the world
  // (world/gen/daylight.ts) — nothing else decides what colour anything is.
  const palette: SkyPalette = makeSkyPalette();
  const sun: SunDirection = makeSunDirection();
  let timePhase = TIME.START_PHASE;
  let timeFrozen = false;

  // Ridge rock colours, derived from the palette each frame rather than
  // authored separately, so they cannot drift away from the sky.
  const ridgeNear = new THREE.Color();
  const ridgeFar = new THREE.Color();

  /**
   * The `daylight` service. A live view onto the same palette the sky is
   * drawn from — getters rather than a copy, so a consumer reading it during
   * `frame()` sees this frame's values and nothing has to be kept in step.
   */
  const daylightView: DaylightView = {
    get phase() {
      return timePhase;
    },
    get sunX() {
      return sun.x;
    },
    get sunY() {
      return sun.y;
    },
    get sunZ() {
      return sun.z;
    },
    get sunLight() {
      return palette.sunLight;
    },
    get ambient() {
      return palette.ambient;
    },
    get daylight() {
      return daylightAt(timePhase);
    },
    get instrumentGlow() {
      return palette.instrumentGlow;
    },
  };

  function applyDaylight(): void {
    if (sky === undefined) return;
    paletteAt(timePhase, palette);
    sunDirectionAt(timePhase, sun);
    sky.apply(palette, sun.x, sun.y, sun.z);

    // Distant rock, derived from the palette so it cannot drift away from the
    // sky. The near range takes the cloud-shadow tone darkened — rock in
    // shadow is the darkest thing on the skyline — and the far range sits at
    // the sky's mid tone, which is most of what makes the layers separate.
    setSrgb(ridgeNear, palette.cloudShadow);
    ridgeNear.multiplyScalar(RIDGE_NEAR_DARKEN);
    setSrgb(ridgeFar, palette.mid);
    ridges?.apply(ridgeNear, ridgeFar);
  }

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
    vegetation?.rebuild(stations, ox, oy, oz);
    nearProps?.rebuild(stations, ox, oy, oz);
    roadside?.rebuild(stations, ox, oy, oz);

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
      context.services.provide('daylight', daylightView);

      uniforms = createWorldUniforms();
      roadMaterial = createRoadMaterial(uniforms);
      terrainMaterial = createTerrainMaterial(uniforms);

      roadMesh = createRoadMesh(roadMaterial, capacity);
      terrainMesh = createTerrainMesh(terrainMaterial, capacity);
      sky = createSky(uniforms);
      ridges = createRidges(uniforms);
      vegetation = createVegetation(uniforms, capacity);
      nearProps = createNearProps(uniforms, capacity);
      roadside = createRoadside(uniforms, capacity);

      context.scene.add(
        sky.mesh,
        ridges.group,
        terrainMesh.mesh,
        roadMesh.mesh,
        vegetation.mesh,
        nearProps.mesh,
        roadside.group,
      );
      applyDaylight();
    },

    start(context) {
      car = context.services.require('car');
      road?.ensureSpan(0);
      rebuild();
    },

    step(dt) {
      if (road === undefined) return;
      road.ensureSpan(car?.distanceM ?? 0);
      if (road.stations.nextIndex - lastBuiltNextIndex >= REBUILD_EVERY_STATIONS) rebuild();

      if (!timeFrozen) {
        timePhase = (timePhase + dt / TIME.CYCLE_SECONDS) % 1;
        applyDaylight();
      }
      sky?.step(dt);
    },

    frame(_alpha: number, view: Readonly<ViewState>) {
      sky?.follow(view.x, view.y, view.z);
      ridges?.update(view.x, view.y, view.z);
      if (uniforms !== undefined) {
        uniforms.uFogBaseY.value = view.y + HEIGHT_FOG.BASE_ABOVE_ROAD_M;
      }
    },

    setTimePhase(phase: number) {
      timePhase = ((phase % 1) + 1) % 1;
      applyDaylight();
    },

    setTimeFrozen(frozen: boolean) {
      timeFrozen = frozen;
    },

    get timePhase() {
      return timePhase;
    },

    dispose() {
      roadMesh?.dispose();
      terrainMesh?.dispose();
      sky?.dispose();
      ridges?.dispose();
      vegetation?.dispose();
      nearProps?.dispose();
      roadside?.dispose();
      roadMaterial?.dispose();
      terrainMaterial?.dispose();
    },
  };
}

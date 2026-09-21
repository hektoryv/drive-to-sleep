/**
 * Real low-poly geometry for the roadside's nearest visual band.
 *
 * The main vegetation population remains one-draw-call billboards. At close
 * range those reveal their flatness, so these tiny faceted stones occupy the
 * same visual layer and dither out between 58 and 82 metres. This keeps depth
 * and changing self-shadow beside the car without spending geometry across
 * the full six-kilometre generated window.
 */

import * as THREE from 'three';
import { hash2D01 } from '../../core/rng.js';
import { BIOMES, NEAR_PROPS } from '../tuning.js';
import { biomeWeightsAt, makeBiomeWeights } from '../gen/biomes.js';
import { terrainHeightAt } from '../gen/terrain.js';
import type { Stations } from '../gen/stations.js';
import { WORLD_COMMON_GLSL, type WorldUniforms } from './materials.js';

const VERT = /* glsl */ `
  attribute vec3 biome;
  varying vec3 vBiome;
  varying vec3 vWorld;
  varying vec3 vNormal;

  void main() {
    vBiome = biome;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uMountain;
  uniform vec3 uDesert;
  uniform vec3 uCountry;
  uniform float uFadeStart;
  uniform float uFadeEnd;
  varying vec3 vBiome;
  ${WORLD_COMMON_GLSL}

  void main() {
    float distanceM = length(vWorld - cameraPosition);
    float visibility = 1.0 - smoothstep(uFadeStart, uFadeEnd, distanceM);

    vec3 albedo = uMountain * vBiome.x + uDesert * vBiome.y + uCountry * vBiome.z;
    gl_FragColor = vec4(applyFog(lightSurface(albedo, vNormal)), visibility);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface NearProps {
  readonly mesh: THREE.Mesh;
  rebuild(stations: Stations, originX: number, originY: number, originZ: number): void;
  dispose(): void;
}

/** Four triangular faces: enough facets to catch both sun and moon. */
const VERTICES_PER_STONE = 12;

export function createNearProps(shared: WorldUniforms, capacityStations: number): NearProps {
  const maxStones = Math.ceil(capacityStations / NEAR_PROPS.EVERY_STATIONS) * 2;
  const positions = new Float32Array(maxStones * VERTICES_PER_STONE * 3);
  const normals = new Float32Array(positions.length);
  const biomes = new Float32Array(positions.length);

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

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      ...shared,
      uMountain: { value: new THREE.Color(BIOMES.TERRAIN_ROCK[0]) },
      uDesert: { value: new THREE.Color(BIOMES.TERRAIN_ROCK[1]) },
      uCountry: { value: new THREE.Color(BIOMES.TERRAIN_ROCK[2]) },
      uFadeStart: { value: NEAR_PROPS.FADE_START_M },
      uFadeEnd: { value: NEAR_PROPS.FADE_END_M },
    },
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  const biome = makeBiomeWeights();

  function rebuild(stations: Stations, originX: number, originY: number, originZ: number): void {
    const first = stations.firstIndex;
    const rows = Math.min(capacityStations, stations.nextIndex - first);
    let stone = 0;
    let vertexInStone = 0;

    function vertex(
      x: number,
      y: number,
      z: number,
      nx: number,
      ny: number,
      nz: number,
    ): void {
      const vi = stone * VERTICES_PER_STONE + vertexInStone;
      positions[vi * 3] = x - originX;
      positions[vi * 3 + 1] = y - originY;
      positions[vi * 3 + 2] = z - originZ;
      normals[vi * 3] = nx;
      normals[vi * 3 + 1] = ny;
      normals[vi * 3 + 2] = nz;
      biomes[vi * 3] = biome.mountain;
      biomes[vi * 3 + 1] = biome.desert;
      biomes[vi * 3 + 2] = biome.country;
      vertexInStone++;
    }

    function triangle(
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
      cx: number, cy: number, cz: number,
    ): void {
      const ux = bx - ax;
      const uy = by - ay;
      const uz = bz - az;
      const vx = cx - ax;
      const vy = cy - ay;
      const vz = cz - az;
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const inv = 1 / Math.max(0.0001, Math.hypot(nx, ny, nz));
      nx *= inv;
      ny *= inv;
      nz *= inv;
      vertex(ax, ay, az, nx, ny, nz);
      vertex(bx, by, bz, nx, ny, nz);
      vertex(cx, cy, cz, nx, ny, nz);
    }

    for (let row = 0; row < rows - 1; row++) {
      const index = first + row;
      if (index % NEAR_PROPS.EVERY_STATIONS !== 0) continue;
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

      for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
        if (stone >= maxStones) break;
        if (hash2D01(index, sideIndex, stations.seed + 1901) > NEAR_PROPS.CHANCE) continue;

        const side = sideIndex === 0 ? -1 : 1;
        const along = hash2D01(index, sideIndex + 7, stations.seed + 1931);
        const centreX = ax + (bx - ax) * along;
        const centreY = ay + (by - ay) * along;
        const centreZ = az + (bz - az) * along;
        const s = index * stations.spacing + along * stations.spacing;
        const t = side * (
          NEAR_PROPS.NEAR_M +
          (NEAR_PROPS.FAR_M - NEAR_PROPS.NEAR_M) * hash2D01(index, sideIndex + 13, stations.seed + 1973)
        );
        const x = centreX + rx * t;
        const z = centreZ + rz * t;
        const y = terrainHeightAt(s, t, centreY, stations.seed);
        const width = NEAR_PROPS.MIN_WIDTH_M +
          (NEAR_PROPS.MAX_WIDTH_M - NEAR_PROPS.MIN_WIDTH_M) *
          hash2D01(index, sideIndex + 19, stations.seed + 1997);
        const height = NEAR_PROPS.MIN_HEIGHT_M +
          (NEAR_PROPS.MAX_HEIGHT_M - NEAR_PROPS.MIN_HEIGHT_M) *
          hash2D01(index, sideIndex + 23, stations.seed + 2011);
        const angle = hash2D01(index, sideIndex + 29, stations.seed + 2039) * Math.PI;
        const qx = Math.cos(angle) * width;
        const qz = Math.sin(angle) * width;
        const px = -qz * 0.72;
        const pz = qx * 0.72;
        const apexX = x + qx * 0.09;
        const apexZ = z + qz * 0.09;

        biomeWeightsAt(s, stations.seed, biome);
        vertexInStone = 0;
        triangle(x + qx, y, z + qz, x + px, y, z + pz, apexX, y + height, apexZ);
        triangle(x + px, y, z + pz, x - qx, y, z - qz, apexX, y + height, apexZ);
        triangle(x - qx, y, z - qz, x - px, y, z - pz, apexX, y + height, apexZ);
        triangle(x - px, y, z - pz, x + qx, y, z + qz, apexX, y + height, apexZ);
        stone++;
      }
    }

    geometry.setDrawRange(0, stone * VERTICES_PER_STONE);
    positionAttr.needsUpdate = true;
    normalAttr.needsUpdate = true;
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

/**
 * Telegraph poles and their wires.
 *
 * The roadside's near-field speed cue. Vegetation stands 7.5 m out and further,
 * because a maintained verge is bare — which means nothing passes *close* to
 * the car, and something passing close is most of what makes speed felt rather
 * than read off a dial. Poles every 40 m are the oldest fix in the genre.
 *
 * Two objects, because they want different primitives:
 *
 * - **The poles** are billboards, built the same way the vegetation is
 *   (`view/vegetation.ts`). A pole is a cylinder, and a cylinder has the same
 *   silhouette from every angle, so there is nothing a real one would give you.
 * - **The wires** are line segments with a catenary sag, strung between
 *   consecutive poles. They are what turns a row of posts into a road that
 *   goes somewhere.
 *
 * ## The thin-line problem
 *
 * A pole is about 0.18 m wide. At 150 m that is a fraction of a pixel, and a
 * silhouette cut with `discard` either vanishes or flickers between frames as
 * the sample point crosses it — the same failure that makes distant power
 * lines shimmer in most games. The fix is the one the road markings already
 * use: `fwidth` gives the uv covered by one pixel, so the post is never drawn
 * narrower than that. Distant poles get slightly too wide instead of
 * disappearing, which is much the better error.
 */

import * as THREE from 'three';
import { hash01, hash2D01 } from '../../core/rng.js';
import { ROADSIDE } from '../tuning.js';
import { terrainHeightAt } from '../gen/terrain.js';
import type { Stations } from '../gen/stations.js';
import { WORLD_COMMON_GLSL, type WorldUniforms } from './materials.js';

const POLE_VERT = /* glsl */ `
  attribute vec2 corner;
  attribute vec2 size;

  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormal;

  void main() {
    vUv = corner + vec2(0.5, 0.0);

    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;

    // World-space frame, carried into view space — same reasoning as the
    // vegetation billboards, and for the same reason: world up, not the
    // camera's, or the whole roadside rolls when the car leans.
    vec3 worldToCam = normalize(cameraPosition - world.xyz);
    vec3 worldRight = normalize(cross(vec3(0.0, 1.0, 0.0), worldToCam));

    vec4 mv = viewMatrix * world;
    mv.xyz += (viewMatrix * vec4(worldRight, 0.0)).xyz * (corner.x * size.x)
            + (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz * (corner.y * size.y);
    gl_Position = projectionMatrix * mv;

    vNormal = normalize(worldRight * corner.x * 1.2 + vec3(0.0, 0.3, 0.0) + worldToCam * 1.1);
  }
`;

const POLE_FRAG = /* glsl */ `
  uniform vec3 uWood;
  varying vec2 vUv;
  ${WORLD_COMMON_GLSL}

  void main() {
    // One pixel, in uv. Nothing below is allowed to be thinner than this.
    float px = fwidth(vUv.x);
    float py = fwidth(vUv.y);

    float dx = abs(vUv.x - 0.5);

    // The post. Tapers very slightly toward the top, as a trunk does.
    float postHalf = max(0.052 * (1.0 - 0.18 * vUv.y), px * 0.6);
    bool post = dx < postHalf;

    // The crossarm, and the short insulator pins standing on it.
    float armY = ${ROADSIDE.WIRE_HEIGHT.toFixed(3)};
    float armHalf = max(0.008, py * 0.6);
    bool arm = abs(vUv.y - armY) < armHalf && dx < 0.44;

    float pin = abs(fract(vUv.x * 4.0 + 0.5) - 0.5) / 4.0;
    bool insulator =
      vUv.y > armY && vUv.y < armY + max(0.022, py * 1.5) && dx < 0.44 && pin < max(0.012, px);

    if (!post && !arm && !insulator) discard;

    // Creosoted wood, a touch lighter on the arm so it separates against the
    // sky rather than reading as one black cross.
    vec3 albedo = uWood * (arm || insulator ? 1.18 : 1.0);
    // Vertical grain: a slow band, just enough that a pole close to the camera
    // is not a flat rectangle of one colour.
    albedo *= 0.9 + 0.12 * fract(vUv.y * 6.0);

    gl_FragColor = vec4(applyFog(lightSurface(albedo, vNormal)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const WIRE_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const WIRE_FRAG = /* glsl */ `
  uniform vec3 uWire;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec3 vWorld;

  void main() {
    // Fogged on exactly the same curve as everything else, written out rather
    // than shared because a line has no normal and nothing to light.
    float dist = length(vWorld - cameraPosition);
    float f = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
    gl_FragColor = vec4(mix(uWire, uFogColor, clamp(f, 0.0, 1.0)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface Roadside {
  readonly group: THREE.Group;
  rebuild(stations: Stations, originX: number, originY: number, originZ: number): void;
  dispose(): void;
}

const CORNERS: ReadonlyArray<readonly [number, number]> = [
  [-0.5, 0],
  [0.5, 0],
  [-0.5, 1],
  [0.5, 1],
];

export function createRoadside(shared: WorldUniforms, capacityStations: number): Roadside {
  const maxPoles = Math.ceil(capacityStations / ROADSIDE.POLE_EVERY_STATIONS) + 2;

  // --- poles -------------------------------------------------------------

  const poleVertices = maxPoles * 4;
  const polePositions = new Float32Array(poleVertices * 3);
  const poleCorners = new Float32Array(poleVertices * 2);
  const poleSizes = new Float32Array(poleVertices * 2);
  const poleIndices = new Uint32Array(maxPoles * 6);

  for (let i = 0; i < maxPoles; i++) {
    for (let c = 0; c < 4; c++) {
      const corner = CORNERS[c] as readonly [number, number];
      const vi = i * 4 + c;
      poleCorners[vi * 2] = corner[0];
      poleCorners[vi * 2 + 1] = corner[1];
    }
    const a = i * 4;
    poleIndices[i * 6] = a;
    poleIndices[i * 6 + 1] = a + 1;
    poleIndices[i * 6 + 2] = a + 2;
    poleIndices[i * 6 + 3] = a + 1;
    poleIndices[i * 6 + 4] = a + 3;
    poleIndices[i * 6 + 5] = a + 2;
  }

  const poleGeometry = new THREE.BufferGeometry();
  const polePositionAttr = new THREE.BufferAttribute(polePositions, 3);
  const poleSizeAttr = new THREE.BufferAttribute(poleSizes, 2);
  polePositionAttr.setUsage(THREE.DynamicDrawUsage);
  poleSizeAttr.setUsage(THREE.DynamicDrawUsage);
  poleGeometry.setAttribute('position', polePositionAttr);
  poleGeometry.setAttribute('corner', new THREE.BufferAttribute(poleCorners, 2));
  poleGeometry.setAttribute('size', poleSizeAttr);
  poleGeometry.setIndex(new THREE.BufferAttribute(poleIndices, 1));

  const poleMaterial = new THREE.ShaderMaterial({
    vertexShader: POLE_VERT,
    fragmentShader: POLE_FRAG,
    uniforms: { ...shared, uWood: { value: new THREE.Color(0x4a3f36) } },
    side: THREE.DoubleSide,
  });

  const poleMesh = new THREE.Mesh(poleGeometry, poleMaterial);
  poleMesh.frustumCulled = false;
  poleMesh.renderOrder = 2;

  // --- wires -------------------------------------------------------------

  const wireVertices = maxPoles * ROADSIDE.WIRE_COUNT * ROADSIDE.WIRE_SEGMENTS * 2;
  const wirePositions = new Float32Array(wireVertices * 3);

  const wireGeometry = new THREE.BufferGeometry();
  const wirePositionAttr = new THREE.BufferAttribute(wirePositions, 3);
  wirePositionAttr.setUsage(THREE.DynamicDrawUsage);
  wireGeometry.setAttribute('position', wirePositionAttr);

  const wireMaterial = new THREE.ShaderMaterial({
    vertexShader: WIRE_VERT,
    fragmentShader: WIRE_FRAG,
    uniforms: {
      uWire: { value: new THREE.Color(0x24201d) },
      uFogColor: shared.uFogColor,
      uFogDensity: shared.uFogDensity,
    },
  });

  const wireMesh = new THREE.LineSegments(wireGeometry, wireMaterial);
  wireMesh.frustumCulled = false;
  wireMesh.renderOrder = 3;

  const group = new THREE.Group();
  group.add(poleMesh, wireMesh);

  // Scratch for one rebuild's pole anchors — the crossarm position and the
  // road's right vector at each, which is what the wires need to be strung.
  // Pre-allocated, because rebuild runs while the game is running.
  const armX = new Float64Array(maxPoles);
  const armY = new Float64Array(maxPoles);
  const armZ = new Float64Array(maxPoles);
  const armRx = new Float64Array(maxPoles);
  const armRz = new Float64Array(maxPoles);

  function rebuild(stations: Stations, originX: number, originY: number, originZ: number): void {
    const first = stations.firstIndex;
    const rows = Math.min(capacityStations, stations.nextIndex - first);
    if (rows < 2) {
      poleGeometry.setDrawRange(0, 0);
      wireGeometry.setDrawRange(0, 0);
      return;
    }

    // Which side the line runs down. Fixed for the whole drive: real lines do
    // not hop the road, and one that did would read as a glitch rather than as
    // a detail.
    const side = hash01(stations.seed, 9001) < 0.5 ? -1 : 1;
    const t = side * ROADSIDE.POLE_OFFSET_M;

    let pole = 0;

    for (let row = 0; row < rows; row++) {
      const index = first + row;
      // Keyed on the absolute index, so a pole stays where it was put however
      // many times the window has scrolled over it.
      if (index % ROADSIDE.POLE_EVERY_STATIONS !== 0) continue;
      if (pole >= maxPoles) break;

      const slot = index % stations.capacity;
      const sx = stations.x[slot] ?? 0;
      const sy = stations.y[slot] ?? 0;
      const sz = stations.z[slot] ?? 0;
      const heading = stations.heading[slot] ?? 0;
      const s = index * stations.spacing;

      const rx = Math.cos(heading);
      const rz = -Math.sin(heading);

      const height =
        ROADSIDE.POLE_HEIGHT_M +
        (hash2D01(index, 5, stations.seed + 733) - 0.5) * 2 * ROADSIDE.POLE_HEIGHT_VARIATION_M;

      const baseX = sx + rx * t;
      const baseZ = sz + rz * t;
      const baseY = terrainHeightAt(s, t, sy, stations.seed);

      const v = pole * 4;
      for (let c = 0; c < 4; c++) {
        const vi = v + c;
        polePositions[vi * 3] = baseX - originX;
        polePositions[vi * 3 + 1] = baseY - originY;
        polePositions[vi * 3 + 2] = baseZ - originZ;
        poleSizes[vi * 2] = height * ROADSIDE.POLE_ASPECT;
        poleSizes[vi * 2 + 1] = height;
      }

      armX[pole] = baseX;
      armY[pole] = baseY + height * ROADSIDE.WIRE_HEIGHT;
      armZ[pole] = baseZ;
      armRx[pole] = rx;
      armRz[pole] = rz;
      pole++;
    }

    poleGeometry.setDrawRange(0, pole * 6);
    polePositionAttr.needsUpdate = true;
    poleSizeAttr.needsUpdate = true;

    // Wires. One catenary per span per wire, subdivided so it is a curve.
    let w = 0;
    for (let i = 0; i + 1 < pole; i++) {
      const ax = armX[i] ?? 0;
      const ay = armY[i] ?? 0;
      const az = armZ[i] ?? 0;
      const bx = armX[i + 1] ?? ax;
      const by = armY[i + 1] ?? ay;
      const bz = armZ[i + 1] ?? az;

      for (let k = 0; k < ROADSIDE.WIRE_COUNT; k++) {
        // Offset along the crossarm, which lies across the road at each end.
        const lane =
          ROADSIDE.WIRE_COUNT > 1
            ? (k / (ROADSIDE.WIRE_COUNT - 1) - 0.5) * 2 * ROADSIDE.WIRE_SPAN_M
            : 0;
        const aox = ax + (armRx[i] ?? 0) * lane;
        const aoz = az + (armRz[i] ?? 0) * lane;
        const box = bx + (armRx[i + 1] ?? 0) * lane;
        const boz = bz + (armRz[i + 1] ?? 0) * lane;

        for (let seg = 0; seg < ROADSIDE.WIRE_SEGMENTS; seg++) {
          const u0 = seg / ROADSIDE.WIRE_SEGMENTS;
          const u1 = (seg + 1) / ROADSIDE.WIRE_SEGMENTS;
          for (const u of [u0, u1]) {
            // A parabola is a close enough catenary at this span, and it is
            // the sag that says "abandoned road", not the exact curve.
            const sag = ROADSIDE.WIRE_SAG_M * 4 * u * (1 - u);
            wirePositions[w * 3] = aox + (box - aox) * u - originX;
            wirePositions[w * 3 + 1] = ay + (by - ay) * u - sag - originY;
            wirePositions[w * 3 + 2] = aoz + (boz - aoz) * u - originZ;
            w++;
          }
        }
      }
    }

    wireGeometry.setDrawRange(0, w);
    wirePositionAttr.needsUpdate = true;

    poleMesh.position.set(originX, originY, originZ);
    wireMesh.position.set(originX, originY, originZ);
  }

  return {
    group,
    rebuild,
    dispose() {
      poleGeometry.dispose();
      poleMaterial.dispose();
      wireGeometry.dispose();
      wireMaterial.dispose();
    },
  };
}

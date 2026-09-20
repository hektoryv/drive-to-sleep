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
import { chevronPlacement, needsChevrons } from '../gen/signage.js';
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

const CHEVRON_VERT = /* glsl */ `
  attribute vec2 face;
  attribute float turn;

  varying vec2 vUv;
  varying float vTurn;
  varying vec3 vWorld;
  varying vec3 vNormal;

  void main() {
    vUv = face;
    vTurn = turn;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const CHEVRON_FRAG = /* glsl */ `
  uniform vec3 uPlate;
  uniform vec3 uInk;
  uniform vec3 uPost;
  uniform float uPlateBottom;
  varying vec2 vUv;
  varying float vTurn;
  ${WORLD_COMMON_GLSL}

  void main() {
    float px = fwidth(vUv.x);

    if (vUv.y < uPlateBottom) {
      // The post. Thin, and never narrower than a pixel — the same guard the
      // telegraph poles need, for the same reason.
      if (abs(vUv.x - 0.5) > max(0.055, px * 0.6)) discard;
      gl_FragColor = vec4(applyFog(lightSurface(uPost, vNormal)), 1.0);
    } else {
      // The plate. Local coordinates, with a dark border all the way round so
      // the sign reads as an object rather than as a floating pattern.
      vec2 q = vec2(vUv.x, (vUv.y - uPlateBottom) / (1.0 - uPlateBottom));
      float border = min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y));

      // Chevrons: a V, repeated across the plate. k is 0 at the plate's
      // waist and 1 at top and bottom, so each band bends into an arrow,
      // and the turn attribute flips it to point into the corner.
      //
      // The sign of the k term is the whole direction of the arrow, and it
      // was wrong the first time: every sign pointed out of its corner
      // rather than into it, which is worse than no sign at all. Checked by
      // printing the pattern as text rather than by squinting at a plate
      // twenty pixels wide.
      float k = abs(q.y - 0.5) * 2.0;
      float x = (q.x - 0.5) * vTurn;
      float pattern = fract((x + k * 0.28) * 2.4 + 0.5);

      vec3 albedo = pattern < 0.5 ? uInk : uPlate;
      albedo = mix(uInk, albedo, smoothstep(0.0, max(0.045, px * 1.5), border));

      gl_FragColor = vec4(applyFog(lightSurface(albedo, vNormal)), 1.0);
    }

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

  // --- chevron signs -----------------------------------------------------

  const maxChevrons = Math.ceil(capacityStations / ROADSIDE.CHEVRON_EVERY_STATIONS) + 2;
  const chevronVertices = maxChevrons * 4;
  const chevronPositions = new Float32Array(chevronVertices * 3);
  const chevronNormals = new Float32Array(chevronVertices * 3);
  const chevronFaces = new Float32Array(chevronVertices * 2);
  const chevronTurns = new Float32Array(chevronVertices);
  const chevronIndices = new Uint32Array(maxChevrons * 6);

  for (let i = 0; i < maxChevrons; i++) {
    for (let c = 0; c < 4; c++) {
      const corner = CORNERS[c] as readonly [number, number];
      const vi = i * 4 + c;
      // The plate is a real oriented quad, not a billboard: a sign that turned
      // to follow the camera would still be readable from behind, which is the
      // one thing a sign must not be.
      chevronFaces[vi * 2] = corner[0] + 0.5;
      chevronFaces[vi * 2 + 1] = corner[1];
    }
    const a = i * 4;
    chevronIndices[i * 6] = a;
    chevronIndices[i * 6 + 1] = a + 1;
    chevronIndices[i * 6 + 2] = a + 2;
    chevronIndices[i * 6 + 3] = a + 1;
    chevronIndices[i * 6 + 4] = a + 3;
    chevronIndices[i * 6 + 5] = a + 2;
  }

  const chevronGeometry = new THREE.BufferGeometry();
  const chevronPositionAttr = new THREE.BufferAttribute(chevronPositions, 3);
  const chevronNormalAttr = new THREE.BufferAttribute(chevronNormals, 3);
  const chevronTurnAttr = new THREE.BufferAttribute(chevronTurns, 1);
  chevronPositionAttr.setUsage(THREE.DynamicDrawUsage);
  chevronNormalAttr.setUsage(THREE.DynamicDrawUsage);
  chevronTurnAttr.setUsage(THREE.DynamicDrawUsage);
  chevronGeometry.setAttribute('position', chevronPositionAttr);
  chevronGeometry.setAttribute('normal', chevronNormalAttr);
  chevronGeometry.setAttribute('face', new THREE.BufferAttribute(chevronFaces, 2));
  chevronGeometry.setAttribute('turn', chevronTurnAttr);
  chevronGeometry.setIndex(new THREE.BufferAttribute(chevronIndices, 1));

  const chevronTotalM = ROADSIDE.CHEVRON_POST_M + ROADSIDE.CHEVRON_PLATE_M;

  const chevronMaterial = new THREE.ShaderMaterial({
    vertexShader: CHEVRON_VERT,
    fragmentShader: CHEVRON_FRAG,
    uniforms: {
      ...shared,
      uPlate: { value: new THREE.Color(0xe8c85a) },
      uInk: { value: new THREE.Color(0x201c18) },
      uPost: { value: new THREE.Color(0x8d8880) },
      uPlateBottom: { value: ROADSIDE.CHEVRON_POST_M / chevronTotalM },
    },
    // Visible from behind as a blank back, which is what a real sign does.
    side: THREE.DoubleSide,
  });

  const chevronMesh = new THREE.Mesh(chevronGeometry, chevronMaterial);
  chevronMesh.frustumCulled = false;
  chevronMesh.renderOrder = 2;

  const group = new THREE.Group();
  group.add(poleMesh, wireMesh, chevronMesh);

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
      chevronGeometry.setDrawRange(0, 0);
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

    // Chevrons. Only on corners tight enough that the warning means something,
    // and only on the *outside* of the bend — which is where they go on a real
    // road, because the outside is where you end up if you get it wrong.
    let chevron = 0;
    for (let row = 0; row < rows; row++) {
      const index = first + row;
      if (index % ROADSIDE.CHEVRON_EVERY_STATIONS !== 0) continue;
      if (chevron >= maxChevrons) break;

      const slot = index % stations.capacity;
      const curvature = stations.curvature[slot] ?? 0;
      if (!needsChevrons(curvature)) continue;

      const sx = stations.x[slot] ?? 0;
      const sy = stations.y[slot] ?? 0;
      const sz = stations.z[slot] ?? 0;
      const heading = stations.heading[slot] ?? 0;
      const s = index * stations.spacing;

      // Which side, and which way the arrows face. Both come from gen/signage,
      // which is pure and tested — the convention is easy to invert silently.
      const { side: chevronSide, turn } = chevronPlacement(curvature);
      const ct = chevronSide * ROADSIDE.CHEVRON_OFFSET_M;

      const rx = Math.cos(heading);
      const rz = -Math.sin(heading);
      const baseX = sx + rx * ct;
      const baseZ = sz + rz * ct;
      const baseY = terrainHeightAt(s, ct, sy, stations.seed);

      // The plate faces back down the road, at the driver coming into the
      // corner. Forward is (-sin h, -cos h), so the normal is its negation.
      const nx = Math.sin(heading);
      const nz = Math.cos(heading);

      const halfW = ROADSIDE.CHEVRON_WIDTH_M * 0.5;
      const v = chevron * 4;
      for (let c = 0; c < 4; c++) {
        const corner = CORNERS[c] as readonly [number, number];
        const vi = v + c;
        chevronPositions[vi * 3] = baseX + rx * (corner[0] * 2 * halfW) - originX;
        chevronPositions[vi * 3 + 1] = baseY + corner[1] * chevronTotalM - originY;
        chevronPositions[vi * 3 + 2] = baseZ + rz * (corner[0] * 2 * halfW) - originZ;
        chevronNormals[vi * 3] = nx;
        chevronNormals[vi * 3 + 1] = 0;
        chevronNormals[vi * 3 + 2] = nz;
        chevronTurns[vi] = turn;
      }
      chevron++;
    }

    chevronGeometry.setDrawRange(0, chevron * 6);
    chevronPositionAttr.needsUpdate = true;
    chevronNormalAttr.needsUpdate = true;
    chevronTurnAttr.needsUpdate = true;
    chevronMesh.position.set(originX, originY, originZ);

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
      chevronGeometry.dispose();
      chevronMaterial.dispose();
    },
  };
}

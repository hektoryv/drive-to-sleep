/**
 * PHASE 0 PLACEHOLDER.
 *
 * A sky and a ground grid, and nothing else. This exists so the framing, the
 * field of view, the horizon placement and the screenshot harness can all be
 * verified before the real world generator arrives in Phase 1, at which point
 * this file is deleted.
 *
 * It is deliberately crude. The one thing it is not crude about is scale: the
 * grid is in real metres and the marker band is a real road width, so the
 * framing judgements made against it carry over.
 */

import * as THREE from 'three';
import {
  PATH_A1,
  PATH_A2,
  PATH_K1,
  PATH_K2,
  PATH_PHASE,
} from '../world/placeholder-path.js';

/** Crude stand-in for the Phase 3 time-of-day system. Three fixed moods. */
export type PlaceholderTime = 'day' | 'dusk' | 'night';

interface Palette {
  zenith: THREE.Color;
  horizon: THREE.Color;
  ground: THREE.Color;
  grid: THREE.Color;
  road: THREE.Color;
  fogDensity: number;
}

const PALETTES: Record<PlaceholderTime, Palette> = {
  day: {
    zenith: new THREE.Color(0x2c5f96),
    horizon: new THREE.Color(0xbcd0dc),
    ground: new THREE.Color(0x6a7358),
    grid: new THREE.Color(0x8e9679),
    road: new THREE.Color(0x3b3b3e),
    fogDensity: 0.0016,
  },
  dusk: {
    zenith: new THREE.Color(0x1d2749),
    horizon: new THREE.Color(0xd98b53),
    ground: new THREE.Color(0x4a4238),
    grid: new THREE.Color(0x6d5c48),
    road: new THREE.Color(0x2a2724),
    fogDensity: 0.0022,
  },
  night: {
    zenith: new THREE.Color(0x070b18),
    horizon: new THREE.Color(0x1b2338),
    ground: new THREE.Color(0x14161c),
    grid: new THREE.Color(0x232833),
    road: new THREE.Color(0x0e0f12),
    fogDensity: 0.0030,
  },
};

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    // Direction from the camera to this point on the sky shell, in world space.
    vec4 world = modelMatrix * vec4(position, 1.0);
    vDir = normalize(world.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  varying vec3 vDir;

  void main() {
    float h = vDir.y;
    vec3 col;
    if (h >= 0.0) {
      // Biased upward so the warm horizon band stays tight rather than
      // washing halfway up the sky.
      col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.45));
    } else {
      // Held at the horizon colour well below the horizon line. The ground
      // plane is clipped by the far plane while fog has already resolved
      // everything to the horizon colour, so without this the sky's lower
      // hemisphere shows through as a visible band just under the horizon.
      col = mix(uHorizon, uGround, pow(clamp(-h, 0.0, 1.0), 2.2));
    }
    gl_FragColor = vec4(col, 1.0);
    // Raw ShaderMaterials don't get these for free the way built-in materials
    // do, and without them the filmic tonemapping from ADR-0007 is bypassed.
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const GROUND_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const GROUND_FRAG = /* glsl */ `
  uniform vec3 uGround;
  uniform vec3 uGrid;
  uniform vec3 uRoad;
  uniform vec3 uHorizon;
  uniform float uFogDensity;
  uniform float uRoadHalfWidth;
  // (A1, K1, A2, K2) of the placeholder centreline, plus its phase. Evaluated
  // per pixel so the road band follows the same curve the car does.
  uniform vec4 uPath;
  uniform float uPathPhase;
  varying vec3 vWorld;

  float pathX(float s) {
    return uPath.x * sin(uPath.y * s) + uPath.z * sin(uPath.w * s + uPathPhase);
  }

  // Antialiased grid lines: width is derived from the screen-space derivative,
  // so lines stay one pixel wide into the distance instead of aliasing apart.
  float gridLine(vec2 p, float spacing, float thickness) {
    vec2 g = abs(fract(p / spacing - 0.5) - 0.5) * spacing;
    vec2 d = fwidth(p) * thickness;
    vec2 line = smoothstep(d, vec2(0.0), g);
    return max(line.x, line.y);
  }

  void main() {
    vec2 p = vWorld.xz;

    vec3 col = uGround;

    // Road band, following the same centreline the car does. Lateral offset is
    // measured along x rather than perpendicular to the path, which widens the
    // band slightly in the corners — invisible at these slopes, and the real
    // road in Phase 1 is swept geometry rather than a shader trick anyway.
    float s = -p.y;
    float lateral = p.x - pathX(s);
    float road = 1.0 - smoothstep(uRoadHalfWidth - 0.15, uRoadHalfWidth + 0.15, abs(lateral));
    col = mix(col, uRoad, road);

    // Centre line, so the curve reads at a glance.
    float centre = 1.0 - smoothstep(0.06, 0.12, abs(lateral));
    col = mix(col, uGrid, centre * 0.5 * road);

    float fine = gridLine(p, 10.0, 1.0);
    float coarse = gridLine(p, 100.0, 1.6);
    col = mix(col, uGrid, fine * 0.30);
    col = mix(col, uGrid, coarse * 0.45);

    // Exponential-squared distance fog, resolved to the horizon colour.
    float dist = length(vWorld - cameraPosition);
    float f = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
    col = mix(col, uHorizon, clamp(f, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface PlaceholderScene {
  scene: THREE.Scene;
  setTime(time: PlaceholderTime): void;
  /** Keeps the ground and sky centred on the camera so both feel unbounded. */
  follow(x: number, z: number): void;
  dispose(): void;
}

export function createPlaceholderScene(initialTime: PlaceholderTime = 'day'): PlaceholderScene {
  const scene = new THREE.Scene();

  // Uniform objects are held directly rather than looked up through the
  // material's uniform map on every change: the map is index-signature typed,
  // so every access would need a non-null assertion, and this is both safer
  // and cheaper.
  const u = {
    zenith: { value: new THREE.Color() },
    skyHorizon: { value: new THREE.Color() },
    skyGround: { value: new THREE.Color() },
    ground: { value: new THREE.Color() },
    grid: { value: new THREE.Color() },
    road: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    fogDensity: { value: 0.0016 },
    // Half of a typical two-lane road, matching the widths Phase 1 will use.
    roadHalfWidth: { value: 3.5 },
    path: { value: new THREE.Vector4(PATH_A1, PATH_K1, PATH_A2, PATH_K2) },
    pathPhase: { value: PATH_PHASE },
  };

  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: u.zenith,
      uHorizon: u.skyHorizon,
      uGround: u.skyGround,
    },
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), skyMat);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);

  const groundMat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
    uniforms: {
      uGround: u.ground,
      uGrid: u.grid,
      uRoad: u.road,
      uHorizon: u.horizon,
      uFogDensity: u.fogDensity,
      uRoadHalfWidth: u.roadHalfWidth,
      uPath: u.path,
      uPathPhase: u.pathPhase,
    },
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.frustumCulled = false;
  scene.add(ground);

  function setTime(time: PlaceholderTime): void {
    const p = PALETTES[time];
    u.zenith.value.copy(p.zenith);
    u.skyHorizon.value.copy(p.horizon);
    u.skyGround.value.copy(p.ground);
    u.ground.value.copy(p.ground);
    u.grid.value.copy(p.grid);
    u.road.value.copy(p.road);
    u.horizon.value.copy(p.horizon);
    u.fogDensity.value = p.fogDensity;
  }

  setTime(initialTime);

  return {
    scene,
    setTime,
    follow(x: number, z: number) {
      // Snapped to the coarse grid so the grid appears to scroll past a fixed
      // world rather than sliding with the camera. The plane is 8 km across,
      // so snapping never exposes an edge.
      ground.position.x = Math.round(x / 100) * 100;
      ground.position.z = Math.round(z / 100) * 100;
      sky.position.x = x;
      sky.position.z = z;
    },
    dispose() {
      sky.geometry.dispose();
      skyMat.dispose();
      ground.geometry.dispose();
      groundMat.dispose();
    },
  };
}

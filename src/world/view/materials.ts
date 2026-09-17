/**
 * Shaders for the world's surfaces. Owned by the `world` domain.
 *
 * Road markings, shoulders and verges are drawn *analytically* from the
 * lateral coordinate rather than from textures or extra geometry: a line is
 * `smoothstep` over a screen-space derivative, so it stays one pixel wide into
 * the distance instead of aliasing into a shimmering mess, and costs no
 * vertices and no texture memory.
 *
 * All the lighting here is one directional term and one ambient term. Per
 * ADR-0007 the look comes from sky, fog and palette, not from shading models.
 */

import * as THREE from 'three';

/** Uniforms shared by every world surface, so sun and fog can never disagree. */
export interface WorldUniforms {
  uSunDir: { value: THREE.Vector3 };
  uSunColor: { value: THREE.Color };
  uAmbient: { value: THREE.Color };
  uFogColor: { value: THREE.Color };
  uFogDensity: { value: number };
}

export function createWorldUniforms(): WorldUniforms {
  return {
    uSunDir: { value: new THREE.Vector3(0.42, 0.55, 0.72).normalize() },
    uSunColor: { value: new THREE.Color(0xfff0dc) },
    uAmbient: { value: new THREE.Color(0x5a6b82) },
    uFogColor: { value: new THREE.Color(0xbcd0dc) },
    uFogDensity: { value: 0.00022 },
  };
}

/** Shared GLSL: lighting and fog, so every surface resolves identically. */
const COMMON = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uAmbient;
  uniform vec3 uFogColor;
  uniform float uFogDensity;

  varying vec3 vWorld;
  varying vec3 vNormal;

  vec3 lightSurface(vec3 albedo, vec3 n) {
    // Half-lambert: the unlit side lifts toward ambient instead of going
    // black. Nothing in this world is ever pure black (ADR-0007).
    float ndl = dot(normalize(n), uSunDir) * 0.5 + 0.5;
    return albedo * (uAmbient + uSunColor * ndl * ndl);
  }

  vec3 applyFog(vec3 col) {
    float dist = length(vWorld - cameraPosition);
    float f = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
    return mix(col, uFogColor, clamp(f, 0.0, 1.0));
  }
`;

const ROAD_VERT = /* glsl */ `
  attribute float lateral;
  attribute float halfWidth;
  varying float vLateral;
  varying float vHalfWidth;
  varying vec3 vWorld;
  varying vec3 vNormal;

  void main() {
    vLateral = lateral;
    vHalfWidth = halfWidth;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const ROAD_FRAG = /* glsl */ `
  uniform vec3 uTarmac;
  uniform vec3 uShoulder;
  uniform vec3 uVerge;
  uniform vec3 uLine;
  uniform float uShoulderWidth;
  uniform float uCentreLine;
  uniform float uEdgeLine;
  varying float vLateral;
  varying float vHalfWidth;
  ${COMMON}

  // One antialiased band, centred on "centre" with half-width "hw".
  // GLSL reserves "half" in some profiles, hence the abbreviation.
  float band(float x, float centre, float hw) {
    float d = abs(x - centre) - hw;
    return 1.0 - smoothstep(0.0, fwidth(x) * 1.2, d);
  }

  void main() {
    float lat = vLateral;
    float dist = abs(lat);

    vec3 albedo = uVerge;
    albedo = mix(albedo, uShoulder, band(dist, 0.0, vHalfWidth + uShoulderWidth));
    albedo = mix(albedo, uTarmac, band(dist, 0.0, vHalfWidth));

    // Markings. The edge lines sit just inside the tarmac, as they do on a
    // real road — painted on the surface, not at the boundary.
    float centre = band(lat, 0.0, uCentreLine);
    float edge = band(dist, vHalfWidth - uEdgeLine * 3.0, uEdgeLine);
    albedo = mix(albedo, uLine, max(centre, edge) * 0.85);

    gl_FragColor = vec4(applyFog(lightSurface(albedo, vNormal)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const TERRAIN_VERT = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormal;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const TERRAIN_FRAG = /* glsl */ `
  uniform vec3 uLow;
  uniform vec3 uHigh;
  uniform vec3 uRock;
  ${COMMON}

  void main() {
    // Two cues, both cheap and both doing a lot of work: height tints the
    // ground from valley to upland, and steepness exposes rock. Between them
    // a single noise field reads as terrain rather than as a lumpy sheet.
    float height = clamp(vWorld.y / 40.0 + 0.5, 0.0, 1.0);
    float steep = 1.0 - clamp(normalize(vNormal).y, 0.0, 1.0);
    vec3 albedo = mix(uLow, uHigh, height);
    albedo = mix(albedo, uRock, smoothstep(0.35, 0.72, steep));
    gl_FragColor = vec4(applyFog(lightSurface(albedo, vNormal)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createRoadMaterial(shared: WorldUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: ROAD_VERT,
    fragmentShader: ROAD_FRAG,
    uniforms: {
      ...shared,
      uTarmac: { value: new THREE.Color(0x3a3b3f) },
      uShoulder: { value: new THREE.Color(0x5b5651) },
      uVerge: { value: new THREE.Color(0x6a7358) },
      uLine: { value: new THREE.Color(0xd8d2c0) },
      uShoulderWidth: { value: 0.8 },
      uCentreLine: { value: 0.08 },
      uEdgeLine: { value: 0.06 },
    },
  });
}

export function createTerrainMaterial(shared: WorldUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: TERRAIN_VERT,
    fragmentShader: TERRAIN_FRAG,
    uniforms: {
      ...shared,
      uLow: { value: new THREE.Color(0x66714f) },
      uHigh: { value: new THREE.Color(0x8a8f6a) },
      uRock: { value: new THREE.Color(0x6d6a63) },
    },
  });
}

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
import { BIOMES, HEIGHT_FOG, ROAD, SKY } from '../tuning.js';

/**
 * Writes an authored palette colour into a THREE.Color.
 *
 * Palette values are sRGB — they were sampled off an image — but `setRGB`
 * defaults to the renderer's *linear* working space. Passing them through
 * unconverted reads every mid-tone about twice as bright as intended and
 * washes the whole scene out to pastel. This exists so that conversion lives
 * in one place rather than being remembered at each call site.
 */
export function setSrgb(target: THREE.Color, c: { r: number; g: number; b: number }): void {
  target.setRGB(c.r, c.g, c.b, THREE.SRGBColorSpace);
}

/** Uniforms shared by every world surface, so sun and fog can never disagree. */
export interface WorldUniforms {
  uSunDir: { value: THREE.Vector3 };
  uSunColor: { value: THREE.Color };
  uAmbient: { value: THREE.Color };
  uFogColor: { value: THREE.Color };
  uFogDensity: { value: number };
  uFogBaseY: { value: number };
  uFogHeightFalloff: { value: number };
  uFogHeightStrength: { value: number };
  uMoonDir: { value: THREE.Vector3 };
  uMoonColor: { value: THREE.Color };
  uMoonStrength: { value: number };
}

export function createWorldUniforms(): WorldUniforms {
  return {
    uSunDir: { value: new THREE.Vector3(0.42, 0.55, 0.72).normalize() },
    uSunColor: { value: new THREE.Color(0xfff0dc) },
    uAmbient: { value: new THREE.Color(0x5a6b82) },
    uFogColor: { value: new THREE.Color(0xbcd0dc) },
    uFogDensity: { value: 0.00022 },
    uFogBaseY: { value: HEIGHT_FOG.BASE_ABOVE_ROAD_M },
    uFogHeightFalloff: { value: 1 / HEIGHT_FOG.SCALE_M },
    uFogHeightStrength: { value: HEIGHT_FOG.STRENGTH },
    uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonColor: { value: new THREE.Color(SKY.MOON_LIGHT_COLOR) },
    uMoonStrength: { value: 0 },
  };
}

/**
 * Shared GLSL: lighting and fog, so every surface resolves identically.
 *
 * Exported because the vegetation billboards need to fog on exactly the same
 * curve as the terrain they stand on. Two fog implementations that agree
 * today will disagree the first time one of them is tuned.
 */
export const WORLD_COMMON_GLSL = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uAmbient;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uFogBaseY;
  uniform float uFogHeightFalloff;
  uniform float uFogHeightStrength;
  uniform vec3 uMoonDir;
  uniform vec3 uMoonColor;
  uniform float uMoonStrength;

  varying vec3 vWorld;
  varying vec3 vNormal;

  vec3 lightSurface(vec3 albedo, vec3 n) {
    // Half-lambert: the unlit side lifts toward ambient instead of going
    // black. Nothing in this world is ever pure black (ADR-0007).
    float ndl = dot(normalize(n), uSunDir) * 0.5 + 0.5;
    float moonNdl = max(dot(normalize(n), uMoonDir), 0.0);
    return albedo * (
      uAmbient + uSunColor * ndl * ndl + uMoonColor * moonNdl * uMoonStrength
    );
  }

  vec3 applyFog(vec3 col) {
    float dist = length(vWorld - cameraPosition);
    float baseFog = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
    float lowY = min(vWorld.y, cameraPosition.y);
    float heightFog = exp(-max(0.0, lowY - uFogBaseY) * uFogHeightFalloff);
    float f = baseFog * mix(1.0, heightFog, uFogHeightStrength);
    return mix(col, uFogColor, clamp(f, 0.0, 1.0));
  }
`;

const ROAD_VERT = /* glsl */ `
  attribute float lateral;
  attribute float halfWidth;
  attribute vec3 biome;
  varying float vLateral;
  varying float vHalfWidth;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vBiome;

  void main() {
    vLateral = lateral;
    vHalfWidth = halfWidth;
    vBiome = biome;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const ROAD_FRAG = /* glsl */ `
  uniform vec3 uTarmac;
  uniform vec3 uShoulderMountain;
  uniform vec3 uShoulderDesert;
  uniform vec3 uShoulderCountry;
  uniform vec3 uVergeMountain;
  uniform vec3 uVergeDesert;
  uniform vec3 uVergeCountry;
  uniform vec3 uCentreLineColour;
  uniform vec3 uEdgeLineColour;
  uniform float uShoulderWidth;
  uniform float uCentreLine;
  uniform float uCentreGap;
  uniform float uEdgeLine;
  varying float vLateral;
  varying float vHalfWidth;
  varying vec3 vBiome;
  ${WORLD_COMMON_GLSL}

  // One antialiased band, centred on "centre" with half-width "hw".
  // GLSL reserves "half" in some profiles, hence the abbreviation.
  float band(float x, float centre, float hw) {
    float d = abs(x - centre) - hw;
    return 1.0 - smoothstep(0.0, fwidth(x) * 1.2, d);
  }

  void main() {
    float lat = vLateral;
    float dist = abs(lat);

    vec3 verge = uVergeMountain * vBiome.x + uVergeDesert * vBiome.y + uVergeCountry * vBiome.z;
    vec3 shoulder = uShoulderMountain * vBiome.x + uShoulderDesert * vBiome.y + uShoulderCountry * vBiome.z;
    vec3 albedo = verge;
    albedo = mix(albedo, shoulder, band(dist, 0.0, vHalfWidth + uShoulderWidth));
    albedo = mix(albedo, uTarmac, band(dist, 0.0, vHalfWidth));

    // Markings. The edge lines sit just inside the tarmac, as they do on a
    // real road — painted on the surface, not at the boundary.
    float centreOffset = uCentreGap + uCentreLine;
    float centre = max(
      band(lat, -centreOffset, uCentreLine),
      band(lat, centreOffset, uCentreLine)
    );
    float edge = band(dist, vHalfWidth - uEdgeLine * 3.0, uEdgeLine);
    albedo = mix(albedo, uCentreLineColour, centre * 0.92);
    albedo = mix(albedo, uEdgeLineColour, edge * 0.85);

    gl_FragColor = vec4(applyFog(lightSurface(albedo, vNormal)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const TERRAIN_VERT = /* glsl */ `
  attribute vec3 biome;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vBiome;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vBiome = biome;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const TERRAIN_FRAG = /* glsl */ `
  uniform vec3 uLowMountain;
  uniform vec3 uLowDesert;
  uniform vec3 uLowCountry;
  uniform vec3 uHighMountain;
  uniform vec3 uHighDesert;
  uniform vec3 uHighCountry;
  uniform vec3 uRockMountain;
  uniform vec3 uRockDesert;
  uniform vec3 uRockCountry;
  varying vec3 vBiome;
  ${WORLD_COMMON_GLSL}

  void main() {
    // Two cues, both cheap and both doing a lot of work: height tints the
    // ground from valley to upland, and steepness exposes rock. Between them
    // a single noise field reads as terrain rather than as a lumpy sheet.
    float height = clamp(vWorld.y / 40.0 + 0.5, 0.0, 1.0);
    float steep = 1.0 - clamp(normalize(vNormal).y, 0.0, 1.0);
    vec3 low = uLowMountain * vBiome.x + uLowDesert * vBiome.y + uLowCountry * vBiome.z;
    vec3 high = uHighMountain * vBiome.x + uHighDesert * vBiome.y + uHighCountry * vBiome.z;
    vec3 rock = uRockMountain * vBiome.x + uRockDesert * vBiome.y + uRockCountry * vBiome.z;
    vec3 albedo = mix(low, high, height);
    albedo = mix(albedo, rock, smoothstep(0.35, 0.72, steep));
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
      uTarmac: { value: new THREE.Color(0x45404a) },
      uShoulderMountain: color(BIOMES.SHOULDER[0]),
      uShoulderDesert: color(BIOMES.SHOULDER[1]),
      uShoulderCountry: color(BIOMES.SHOULDER[2]),
      uVergeMountain: color(BIOMES.VERGE[0]),
      uVergeDesert: color(BIOMES.VERGE[1]),
      uVergeCountry: color(BIOMES.VERGE[2]),
      uCentreLineColour: { value: new THREE.Color(0xe9a11b) },
      uEdgeLineColour: { value: new THREE.Color(0xd8d2c0) },
      uShoulderWidth: { value: 0.8 },
      uCentreLine: { value: ROAD.CENTRE_LINE_M },
      uCentreGap: { value: ROAD.CENTRE_LINE_GAP_M },
      uEdgeLine: { value: ROAD.EDGE_LINE_M },
    },
  });
}

export function createTerrainMaterial(shared: WorldUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: TERRAIN_VERT,
    fragmentShader: TERRAIN_FRAG,
    uniforms: {
      ...shared,
      uLowMountain: color(BIOMES.TERRAIN_LOW[0]),
      uLowDesert: color(BIOMES.TERRAIN_LOW[1]),
      uLowCountry: color(BIOMES.TERRAIN_LOW[2]),
      uHighMountain: color(BIOMES.TERRAIN_HIGH[0]),
      uHighDesert: color(BIOMES.TERRAIN_HIGH[1]),
      uHighCountry: color(BIOMES.TERRAIN_HIGH[2]),
      uRockMountain: color(BIOMES.TERRAIN_ROCK[0]),
      uRockDesert: color(BIOMES.TERRAIN_ROCK[1]),
      uRockCountry: color(BIOMES.TERRAIN_ROCK[2]),
    },
  });
}

function color(hex: number): { value: THREE.Color } {
  return { value: new THREE.Color(hex) };
}

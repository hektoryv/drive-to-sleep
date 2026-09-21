/**
 * The sky: gradient, sun, clouds, stars.
 *
 * Carries most of the mood in the game, and per ADR-0007 most of the
 * good-lookingness too. Three things it does that the Phase 1 placeholder
 * did not, all taken from the art target:
 *
 * 1. **Four gradient stops, not two.** The violet-to-orange transit at dusk
 *    is the whole picture, and it cannot be expressed as one blend.
 * 2. **A visible sun disc with a halo**, which is what makes the sky a place
 *    with a light source in it rather than a coloured backdrop.
 * 3. **Flat, hard-edged clouds.** The art target's clouds are cut-paper
 *    slabs — quantised, horizontal, unmistakably graphic. That look comes
 *    from thresholding noise *hard*; soft fluffy clouds would put a different
 *    game behind the windscreen.
 *
 * All of it is one shader on one sphere. No geometry, no textures, one draw
 * call — clouds included.
 */

import * as THREE from 'three';
import type { SkyPalette } from '../gen/daylight.js';
import { SKY } from '../tuning.js';
import { setSrgb, type WorldUniforms } from './materials.js';

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vDir = normalize(world.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uUpper;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uSunDisc;
  uniform vec3 uSunHalo;
  uniform vec3 uCloudLit;
  uniform vec3 uCloudShadow;
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  uniform vec3 uMoonDisc;
  uniform vec3 uMoonHalo;
  uniform float uMoonStrength;
  uniform float uCloudCover;
  uniform float uStars;
  uniform float uDrift;
  varying vec3 vDir;

  // --- noise -------------------------------------------------------------

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += valueNoise(p) * amp;
      p *= 2.07;
      amp *= 0.5;
    }
    return sum;
  }

  // --- gradient ----------------------------------------------------------

  // Four stops, each reached at a hand-placed height rather than evenly, so
  // the warm band stays pinned near the horizon instead of washing upward.
  vec3 skyGradient(float h) {
    float t = clamp(h, 0.0, 1.0);
    if (t < 0.10) return mix(uHorizon, uMid, smoothstep(0.0, 0.10, t));
    if (t < 0.32) return mix(uMid, uUpper, smoothstep(0.10, 0.32, t));
    return mix(uUpper, uZenith, smoothstep(0.32, 0.85, t));
  }

  // --- clouds ------------------------------------------------------------

  // Two decks at different scales, both flattened hard in elevation so they
  // read as horizontal slabs rather than blobs, and both thresholded with a
  // narrow band so the edges come out crisp.
  vec4 cloudLayer(float azimuth, float elevation, float scale, float squash,
                  float drift, float cover, float softness) {
    vec2 uv = vec2(azimuth * scale + drift, elevation * scale * squash);
    float n = fbm(uv);
    float edge = 1.0 - cover;
    float mask = smoothstep(edge, edge + softness, n);
    // A second, coarser threshold inside the shape gives the stepped
    // interior the art target has — clouds lit in two flat tones, not a ramp.
    float core = smoothstep(edge + softness * 1.6, edge + softness * 3.0, n);
    return vec4(mask, core, n, 0.0);
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;

    vec3 col = skyGradient(h * 1.15);

    // Below the horizon, hold the horizon colour rather than fading to a
    // ground tone: terrain and ridges cover this, and any disagreement shows
    // up as a band exactly at the skyline.
    if (h < 0.0) col = mix(uHorizon, col, exp(h * 14.0));

    float sunDot = dot(dir, uSunDir);
    float moonDot = dot(dir, uMoonDir);

    // Halo first, so the disc sits inside its own glow.
    float halo = pow(max(sunDot, 0.0), 220.0) * 0.55 + pow(max(sunDot, 0.0), 14.0) * 0.30;
    col += uSunHalo * halo;

    // A wide, low wash along the horizon on the sun's side. This is what
    // makes a sunset look like it has a direction.
    float towardSun = max(dot(normalize(vec3(dir.x, 0.0, dir.z)),
                              normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0);
    float horizonGlow = pow(towardSun, 3.0) * exp(-abs(h) * 7.0) * 0.35;
    col += uSunHalo * horizonGlow;

    // The moon is a restrained opposite-sun disc, not a second daytime sun.
    // It appears only with the stars and supplies the world's cool night key.
    float moonHalo = pow(max(moonDot, 0.0), 90.0) * 0.22;
    float moonDisc = smoothstep(0.99972, 0.99986, moonDot);
    col += (uMoonHalo * moonHalo + uMoonDisc * moonDisc) * uMoonStrength;

    // Stars, before the clouds so the clouds occlude them.
    if (uStars > 0.001 && h > -0.02) {
      vec2 sp = vec2(atan(dir.z, dir.x) * 9.0, asin(clamp(h, -1.0, 1.0)) * 9.0);
      float s = hash(floor(sp * 12.0));
      float star = smoothstep(0.9965, 0.9995, s) * smoothstep(0.0, 0.25, h);
      col += vec3(star) * uStars;
    }

    // Clouds. Elevation is used directly rather than via an angle so the
    // decks stay flat overhead instead of converging at the zenith.
    float azimuth = atan(dir.z, dir.x);
    float elevation = h;

    if (elevation > -0.03) {
      // High deck: fine, fast, catches the light first.
      vec4 high = cloudLayer(azimuth, elevation, 1.35, 4.2, uDrift * 0.6,
                             uCloudCover * 0.85, ${SKY.CLOUD_HIGH_SOFTNESS.toFixed(3)});
      // Low deck: broad slabs sitting on the horizon.
      vec4 low = cloudLayer(azimuth + 2.4, elevation, 0.75, 7.5, uDrift,
                            uCloudCover, ${SKY.CLOUD_LOW_SOFTNESS.toFixed(3)});

      // Both fade out near the horizon, where a cloud would be too far away
      // to resolve, and thin toward the zenith.
      float band = smoothstep(0.0, 0.10, elevation) * (1.0 - smoothstep(0.45, 0.95, elevation));

      float lit = clamp(towardSun * 1.3, 0.0, 1.0);
      vec3 highCol = mix(uCloudShadow, uCloudLit, clamp(high.y + lit * 0.55, 0.0, 1.0));
      vec3 lowCol = mix(uCloudShadow, uCloudLit, clamp(low.y * 0.8 + lit * 0.8, 0.0, 1.0));

      col = mix(col, lowCol, low.x * band * 0.92);
      col = mix(col, highCol, high.x * band * 0.7);
    }

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface Sky {
  readonly mesh: THREE.Mesh;
  /** Keeps the shell centred on the camera so it never feels like a room. */
  follow(x: number, y: number, z: number): void;
  /** Pushes the current palette and sun direction into the shader. */
  apply(palette: Readonly<SkyPalette>, sunX: number, sunY: number, sunZ: number): void;
  /** Advances the slow cloud drift. */
  step(dt: number): void;
  dispose(): void;
}

function uniformColor(): { value: THREE.Color } {
  return { value: new THREE.Color() };
}

export function createSky(shared: WorldUniforms): Sky {
  const u = {
    uZenith: uniformColor(),
    uUpper: uniformColor(),
    uMid: uniformColor(),
    uHorizon: uniformColor(),
    uSunDisc: uniformColor(),
    uSunHalo: uniformColor(),
    uCloudLit: uniformColor(),
    uCloudShadow: uniformColor(),
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDisc: { value: new THREE.Color(SKY.MOON_DISC_COLOR) },
    uMoonHalo: { value: new THREE.Color(SKY.MOON_HALO_COLOR) },
    uMoonStrength: { value: 0 },
    uCloudCover: { value: 0.4 },
    uStars: { value: 0 },
    uDrift: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: u,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(SKY.RADIUS_M, 48, 24), material);
  // Drawn before everything, including the ridges that sit in front of it.
  mesh.renderOrder = -100;
  mesh.frustumCulled = false;

  let drift = 0;

  return {
    mesh,

    follow(x, y, z) {
      mesh.position.set(x, y, z);
    },

    apply(palette, sunX, sunY, sunZ) {
      setSrgb(u.uZenith.value, palette.zenith);
      setSrgb(u.uUpper.value, palette.upper);
      setSrgb(u.uMid.value, palette.mid);
      setSrgb(u.uHorizon.value, palette.horizon);
      setSrgb(u.uSunDisc.value, palette.sunDisc);
      setSrgb(u.uSunHalo.value, palette.sunHalo);
      setSrgb(u.uCloudLit.value, palette.cloudLit);
      setSrgb(u.uCloudShadow.value, palette.cloudShadow);
      u.uSunDir.value.set(sunX, sunY, sunZ);
      u.uMoonDir.value.set(-sunX, Math.max(-sunY, 0.04), -sunZ).normalize();
      u.uCloudCover.value = palette.cloudCover;
      u.uStars.value = palette.starIntensity;
      u.uMoonStrength.value = palette.starIntensity;

      // The fog colour is the sky's horizon colour, from this one place.
      // Anything else puts a visible seam at the skyline.
      shared.uFogColor.value.copy(u.uHorizon.value);
      shared.uFogDensity.value = palette.fogDensity;
      setSrgb(shared.uSunColor.value, palette.sunLight);
      setSrgb(shared.uAmbient.value, palette.ambient);
      // Light comes *from* the sun, so the shading vector points at it. Held
      // just above the horizon: once the sun sets the terrain should go to
      // ambient, not light itself from below.
      shared.uSunDir.value.set(sunX, Math.max(sunY, 0.04), sunZ).normalize();
      shared.uMoonDir.value.copy(u.uMoonDir.value);
      shared.uMoonStrength.value = palette.starIntensity * SKY.MOON_LIGHT_STRENGTH;
    },

    step(dt) {
      drift += dt * SKY.CLOUD_DRIFT;
      u.uDrift.value = drift;
    },

    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * Cabin shading.
 *
 * One material for the whole interior, so every surface in the car resolves
 * the same way and the cabin reads as one moulded object rather than as a
 * collection of props.
 *
 * No scene lights: three.js lights are global to a scene, and a domain that is
 * supposed to be sealed has no business changing how anything else is lit. The
 * key is a uniform instead, and the cockpit module points it at the sun.
 *
 * Both normals and the world-space key are transformed into view space in the
 * vertex shader. That matters because most cabin pieces are rotated locally:
 * treating their object-space normals as cabin-space normals lights a raked
 * dash and an upright dash as if they were the same surface.
 */

import * as THREE from 'three';
import { CABIN_LIGHT } from './tuning.js';
import type { Rgb } from '../contracts/daylight.js';

/**
 * Writes a palette colour into a THREE.Color as sRGB.
 *
 * `world/view/materials.ts` has the same three lines and the same comment, and
 * they stay separate: domains do not import one another (ADR-0011), and a
 * shared utility module for one call is a worse trade than the duplication.
 * Palette values are sRGB — `setRGB` would otherwise read them as linear and
 * every mid-tone comes out about twice as bright as intended.
 */
export function setSrgb(target: THREE.Color, c: Rgb): void {
  target.setRGB(c.r, c.g, c.b, THREE.SRGBColorSpace);
}

const VERT = /* glsl */ `
  uniform vec3 uKeyWorld;
  varying vec3 vNormalView;
  varying vec3 vKeyView;
  varying float vViewY;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vKeyView = normalize(mat3(viewMatrix) * uKeyWorld);
    vViewY = viewPosition.y;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uAlbedo;
  uniform vec3 uKeyColour;
  uniform float uKeyStrength;
  uniform vec3 uAmbientColour;
  uniform float uAmbient;
  varying vec3 vNormalView;
  varying vec3 vKeyView;
  varying float vViewY;

  void main() {
    vec3 n = normalize(vNormalView);

    // Half-lambert, as everywhere else in this game (ADR-0007): the unlit side
    // lifts toward ambient rather than going black.
    float ndl = dot(n, normalize(vKeyView)) * 0.5 + 0.5;
    vec3 lit = uAmbientColour * uAmbient + uKeyColour * (uKeyStrength * ndl * ndl);

    // Everything in the cabin gets darker toward the bottom of the frame,
    // which is the one cue that the light is coming from the windscreen. It
    // does most of the work of making a handful of boxes read as an interior.
    float depth = smoothstep(-0.75, 0.05, vViewY);
    lit *= 0.45 + 0.55 * depth;

    gl_FragColor = vec4(uAlbedo * lit, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createCabinMaterial(colour: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uAlbedo: { value: new THREE.Color(colour) },
      uKeyWorld: {
        value: new THREE.Vector3(CABIN_LIGHT.KEY[0], CABIN_LIGHT.KEY[1], CABIN_LIGHT.KEY[2]),
      },
      uKeyColour: { value: new THREE.Color(0xfff0dc) },
      uKeyStrength: { value: CABIN_LIGHT.KEY_STRENGTH },
      uAmbientColour: { value: new THREE.Color(0x5a6b82) },
      uAmbient: { value: CABIN_LIGHT.AMBIENT },
    },
  });
}

/**
 * Points every cabin material at the world-space sun at once.
 *
 * The sun is held above the cabin's horizontal however low it really is: once
 * it sets, an interior should fall to ambient rather than start being lit from
 * under the floor. Same guard the terrain uses (`world/view/sky.ts`).
 */
export function applyCabinLight(
  materials: readonly THREE.ShaderMaterial[],
  sun: THREE.Vector3,
  key: THREE.Color,
  ambient: THREE.Color,
  strength: number,
): void {
  for (const m of materials) {
    const dir = m.uniforms.uKeyWorld?.value as THREE.Vector3 | undefined;
    if (dir !== undefined) dir.copy(sun);
    (m.uniforms.uKeyColour?.value as THREE.Color | undefined)?.copy(key);
    (m.uniforms.uAmbientColour?.value as THREE.Color | undefined)?.copy(ambient);
    if (m.uniforms.uKeyStrength !== undefined) m.uniforms.uKeyStrength.value = strength;
  }
}

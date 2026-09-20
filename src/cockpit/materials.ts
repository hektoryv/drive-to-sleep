/**
 * Cabin shading.
 *
 * One material for the whole interior, so every surface in the car resolves
 * the same way and the cabin reads as one moulded object rather than as a
 * collection of props.
 *
 * Self-contained on purpose: no scene lights. three.js lights are global to a
 * scene, and a domain that is supposed to be sealed has no business changing
 * how anything else is lit. The key direction lives in the eye frame, which is
 * also the frame the cabin is authored in, so it stays put as the car moves —
 * a cabin whose shading swung about with the heading would read as the whole
 * car rotating inside itself.
 */

import * as THREE from 'three';
import { CABIN_LIGHT } from './tuning.js';

const VERT = /* glsl */ `
  varying vec3 vNormalLocal;
  varying vec3 vLocal;

  void main() {
    // Local, not world: the cabin is authored in the eye frame and lit in it.
    vNormalLocal = normalize(normal);
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uAlbedo;
  uniform vec3 uKey;
  uniform float uKeyStrength;
  uniform float uAmbient;
  varying vec3 vNormalLocal;
  varying vec3 vLocal;

  void main() {
    vec3 n = normalize(vNormalLocal);

    // Half-lambert, as everywhere else in this game (ADR-0007): the unlit side
    // lifts toward ambient rather than going black.
    float ndl = dot(n, normalize(uKey)) * 0.5 + 0.5;
    float lit = uAmbient + uKeyStrength * ndl * ndl;

    // Everything in the cabin gets darker toward the bottom of the frame,
    // which is the one cue that the light is coming from the windscreen. It
    // does most of the work of making a handful of boxes read as an interior.
    float depth = smoothstep(-0.75, 0.05, vLocal.y);
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
      uKey: {
        value: new THREE.Vector3(CABIN_LIGHT.KEY[0], CABIN_LIGHT.KEY[1], CABIN_LIGHT.KEY[2]),
      },
      uKeyStrength: { value: CABIN_LIGHT.KEY_STRENGTH },
      uAmbient: { value: CABIN_LIGHT.AMBIENT },
    },
  });
}

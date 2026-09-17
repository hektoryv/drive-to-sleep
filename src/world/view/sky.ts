/**
 * The sky, and the fog colour derived from it.
 *
 * Fog is not a draw-distance trick here — it is the main depth cue and the
 * main mood control (docs/02-art-direction.md), which is why its colour comes
 * from the sky rather than from a constant. Where the two disagree you get a
 * visible band at the horizon; where they agree the world simply recedes.
 *
 * Phase 1 holds a single fixed daytime palette. Phase 3 drives these same
 * uniforms from the time-of-day cycle — the shader does not need to change.
 */

import * as THREE from 'three';
import type { WorldUniforms } from './materials.js';

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
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  varying vec3 vDir;

  void main() {
    float h = vDir.y;
    vec3 col;
    if (h >= 0.0) {
      // Biased upward so the bright horizon band stays tight rather than
      // washing halfway up the sky.
      col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.45));
    } else {
      // Held at the horizon colour well below the horizon line: terrain is
      // clipped by the far plane while fog has already resolved it to exactly
      // this colour, and any disagreement shows up as a band under the horizon.
      col = mix(uHorizon, uGround, pow(clamp(-h, 0.0, 1.0), 2.2));
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
  dispose(): void;
}

export function createSky(shared: WorldUniforms): Sky {
  const horizon = new THREE.Color(0xbcd0dc);
  const material = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: new THREE.Color(0x2c5f96) },
      uHorizon: { value: horizon },
      uGround: { value: new THREE.Color(0x6a7358) },
    },
  });

  // The fog resolves to the sky's horizon colour, from the one source.
  shared.uFogColor.value.copy(horizon);

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), material);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;

  return {
    mesh,
    follow(x, y, z) {
      mesh.position.set(x, y, z);
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}

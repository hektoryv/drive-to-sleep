/** One-triangle colour grade, bloom approximation, vignette and animated grain. */

import * as THREE from 'three';
import { POST, type QualityTier, QUALITY } from './tuning.js';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uScene;
  uniform vec2 uTexel;
  uniform float uTime;
  uniform float uBloom;
  uniform float uGrain;
  uniform float uVignette;
  uniform float uSaturation;
  uniform float uContrast;
  uniform float uBloomThreshold;
  varying vec2 vUv;

  float luma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 41.17) * 43758.5453);
  }

  void main() {
    vec3 col = texture2D(uScene, vUv).rgb;

    if (uBloom > 0.001) {
      vec3 glow = vec3(0.0);
      glow += texture2D(uScene, vUv + vec2(uTexel.x * 2.0, 0.0)).rgb;
      glow += texture2D(uScene, vUv - vec2(uTexel.x * 2.0, 0.0)).rgb;
      glow += texture2D(uScene, vUv + vec2(0.0, uTexel.y * 2.0)).rgb;
      glow += texture2D(uScene, vUv - vec2(0.0, uTexel.y * 2.0)).rgb;
      glow *= 0.25;
      float bright = smoothstep(uBloomThreshold, 1.0, luma(glow));
      col += glow * bright * uBloom;
    }

    float grey = luma(col);
    col = mix(vec3(grey), col, uSaturation);
    col = (col - 0.5) * uContrast + 0.5;

    vec2 centred = vUv * 2.0 - 1.0;
    float edge = smoothstep(0.35, 1.35, dot(centred, centred));
    col *= 1.0 - edge * uVignette;

    float noise = hash(floor(gl_FragCoord.xy)) - 0.5;
    col += noise * uGrain;

    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
    #include <colorspace_fragment>
  }
`;

export interface PostStack {
  readonly target: THREE.WebGLRenderTarget;
  resize(width: number, height: number, pixelRatio: number): void;
  present(renderer: THREE.WebGLRenderer, width: number, height: number): void;
  dispose(): void;
}

export function createPostStack(tier: QualityTier): PostStack {
  const settings = QUALITY[tier];
  const target = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  target.texture.name = 'graded-scene';
  target.texture.colorSpace = THREE.NoColorSpace;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const uniforms = {
    uScene: { value: target.texture },
    uTexel: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uBloom: { value: settings.bloom },
    uGrain: { value: settings.grain },
    uVignette: { value: POST.VIGNETTE },
    uSaturation: { value: POST.SATURATION },
    uContrast: { value: POST.CONTRAST },
    uBloomThreshold: { value: POST.BLOOM_THRESHOLD },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material));
  const camera = new THREE.Camera();

  return {
    target,
    resize(width, height, pixelRatio) {
      const w = Math.max(1, Math.round(width * pixelRatio));
      const h = Math.max(1, Math.round(height * pixelRatio));
      target.setSize(w, h);
      uniforms.uTexel.value.set(1 / w, 1 / h);
    },
    present(renderer, width, height) {
      uniforms.uTime.value += 1 / 60;
      renderer.setRenderTarget(null);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, width, height);
      renderer.clear(true, false, false);
      renderer.render(scene, camera);
    },
    dispose() {
      target.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}

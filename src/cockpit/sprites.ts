/** Layered, screen-stable cockpit sprites. */

import * as THREE from 'three';
import type { DaylightView, Rgb } from '../contracts/daylight.js';
import { COCKPIT_LAYER } from '../contracts/view.js';
import { COCKPIT_SPRITES } from './tuning.js';

const ATLAS_URL = new URL('./assets/cockpit-sprite-atlas.png', import.meta.url).href;
const WHITE = new THREE.Color(0xffffff);

export interface CockpitSprites {
  readonly object: THREE.Object3D;
  setDaylight(daylight: DaylightView): void;
  setLookYaw(lookYaw: number): void;
  setSteer(steerAngle: number): void;
  dispose(): void;
}

export function createCockpitSprites(): CockpitSprites {
  const root = new THREE.Group();
  root.name = 'layered-cockpit-sprites';

  const atlas = new THREE.TextureLoader().load(ATLAS_URL);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;

  const fill = createSolidLayer(
    'cockpit-lower-fill', COCKPIT_SPRITES.CABIN_FILL, 0,
  );
  const exterior = createLayer(
    'cockpit-exterior', atlas, 0, 0.5, COCKPIT_SPRITES.EXTERIOR, 1,
  );
  const interior = createLayer(
    'cockpit-interior', atlas, 0.5, 0.5, COCKPIT_SPRITES.INTERIOR, 2,
  );
  const lighting = createLayer(
    'cockpit-lighting', atlas, 0, 0, COCKPIT_SPRITES.LIGHTING, 3,
  );
  const wheel = createLayer(
    'steering-wheel', atlas, 0.5, 0, COCKPIT_SPRITES.WHEEL, 4,
  );

  root.add(fill.mesh, exterior.mesh, interior.mesh, lighting.mesh, wheel.mesh);
  root.traverse((object) => object.layers.set(COCKPIT_LAYER));

  const key = new THREE.Color();
  const ambient = new THREE.Color();
  const tint = new THREE.Color();

  return {
    object: root,
    setDaylight(daylight) {
      setSrgb(key, daylight.sunLight);
      setSrgb(ambient, daylight.ambient);

      // The atlas owns the painted facets. Multiplying by a restrained shared
      // tint lets sunset and night reach the cabin without turning those
      // authored planes back into unstable, per-triangle 3D lighting.
      tint.copy(ambient).lerp(key, 0.42);
      tint.lerp(WHITE, 0.34 + daylight.daylight * 0.36);
      exterior.material.color.copy(tint);
      interior.material.color.copy(tint).lerp(WHITE, daylight.instrumentGlow * 0.12);
      wheel.material.color.copy(tint).multiplyScalar(0.92);
      // Linear-space 0.02 lands as a near-black violet after sRGB output.
      // A larger value looks surprisingly grey and exposes the wheel cutout.
      fill.material.color.copy(tint).multiplyScalar(0.02);
      lighting.material.opacity =
        COCKPIT_SPRITES.LIGHTING_OPACITY_MIN +
        (1 - daylight.daylight) * COCKPIT_SPRITES.LIGHTING_OPACITY_DUSK +
        daylight.instrumentGlow * COCKPIT_SPRITES.LIGHTING_OPACITY_GLOW;
    },
    setLookYaw(lookYaw) {
      root.position.x = -lookYaw * COCKPIT_SPRITES.LOOK_SHIFT_M_PER_RAD;
    },
    setSteer(steerAngle) {
      wheel.mesh.rotation.z = -steerAngle * COCKPIT_SPRITES.STEERING_RATIO;
    },
    dispose() {
      for (const layer of [fill, exterior, interior, lighting, wheel]) {
        layer.geometry.dispose();
        layer.material.dispose();
      }
      atlas.dispose();
      root.removeFromParent();
    },
  };
}

interface LayerPlacement {
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
}

interface Layer {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly geometry: THREE.PlaneGeometry;
  readonly material: THREE.MeshBasicMaterial;
}

function createLayer(
  name: string,
  atlas: THREE.Texture,
  atlasX: number,
  atlasY: number,
  placement: LayerPlacement,
  renderOrder: number,
): Layer {
  const geometry = new THREE.PlaneGeometry(placement.width, placement.height);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, atlasX + uv.getX(i) * 0.5, atlasY + uv.getY(i) * 0.5);
  }

  const material = new THREE.MeshBasicMaterial({
    map: atlas,
    transparent: true,
    alphaTest: 0.004,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(placement.x, placement.y, -COCKPIT_SPRITES.DISTANCE_M);
  mesh.renderOrder = renderOrder;
  return { mesh, geometry, material };
}

function createSolidLayer(
  name: string,
  placement: LayerPlacement,
  renderOrder: number,
): Layer {
  const geometry = new THREE.PlaneGeometry(placement.width, placement.height);
  const material = new THREE.MeshBasicMaterial({
    color: 0x0a0910,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(placement.x, placement.y, -COCKPIT_SPRITES.DISTANCE_M);
  mesh.renderOrder = renderOrder;
  return { mesh, geometry, material };
}

/** Daylight contract colours are sRGB palette values, not linear triples. */
function setSrgb(target: THREE.Color, colour: Rgb): void {
  target.setRGB(colour.r, colour.g, colour.b, THREE.SRGBColorSpace);
}

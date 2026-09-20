/** A small 2.5D card model: authored sprites on physically separated planes. */

import * as THREE from 'three';
import type { DaylightView, Rgb } from '../contracts/daylight.js';
import { COCKPIT_LAYER } from '../contracts/view.js';
import { COCKPIT_CARDS, type CardPlacement } from './tuning.js';

const ASSET_URLS = {
  shell: new URL('./assets/cockpit-shell.png', import.meta.url).href,
  dashTop: new URL('./assets/dashboard-top.png', import.meta.url).href,
  dashFace: new URL('./assets/dashboard-face.png', import.meta.url).href,
  driverDoor: new URL('./assets/driver-door.png', import.meta.url).href,
  wheel: new URL('./assets/steering-wheel.png', import.meta.url).href,
} as const;

const WHITE = new THREE.Color(0xffffff);

export interface CockpitSprites {
  readonly object: THREE.Object3D;
  setDaylight(daylight: DaylightView): void;
  setLookYaw(lookYaw: number): void;
  setSteer(steerAngle: number): void;
  dispose(): void;
}

interface Card {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly geometry: THREE.PlaneGeometry;
  readonly material: THREE.MeshBasicMaterial;
  readonly texture: THREE.Texture | undefined;
  readonly baseX: number;
  readonly parallax: number;
}

export function createCockpitSprites(): CockpitSprites {
  const root = new THREE.Group();
  root.name = 'cockpit-card-model';

  const fill = createSolidCard('cockpit-lower-fill', COCKPIT_CARDS.CABIN_FILL, 0);
  const shell = createTexturedCard(
    'cockpit-shell', ASSET_URLS.shell, COCKPIT_CARDS.SHELL, 1,
  );
  const dashTop = createTexturedCard(
    'dashboard-top', ASSET_URLS.dashTop, COCKPIT_CARDS.DASH_TOP, 2,
  );
  const door = createTexturedCard(
    'driver-door', ASSET_URLS.driverDoor, COCKPIT_CARDS.DRIVER_DOOR, 3,
  );
  const dash = createTexturedCard(
    'dashboard-face', ASSET_URLS.dashFace, COCKPIT_CARDS.DASH_FACE, 4,
  );

  const shadowTexture = createShadowTexture();
  const dashShadow = createShadowCard(
    'dashboard-contact-shadow', shadowTexture, COCKPIT_CARDS.DASH_SHADOW, 5,
  );
  const wheelShadow = createShadowCard(
    'wheel-contact-shadow', shadowTexture, COCKPIT_CARDS.WHEEL_SHADOW, 6,
  );
  const wheel = createTexturedCard(
    'steering-wheel', ASSET_URLS.wheel, COCKPIT_CARDS.WHEEL, 7,
  );

  const cards = [fill, shell, dashTop, door, dash, dashShadow, wheelShadow, wheel];
  root.add(...cards.map((card) => card.mesh));
  root.traverse((object) => object.layers.set(COCKPIT_LAYER));

  const key = new THREE.Color();
  const ambient = new THREE.Color();
  const tint = new THREE.Color();

  return {
    object: root,
    setDaylight(daylight) {
      setSrgb(key, daylight.sunLight);
      setSrgb(ambient, daylight.ambient);
      tint.copy(ambient).lerp(key, 0.38);
      tint.lerp(WHITE, 0.32 + daylight.daylight * 0.4);

      shell.material.color.copy(tint).lerp(WHITE, 0.08);
      dashTop.material.color.copy(tint);
      dash.material.color.copy(tint).lerp(WHITE, daylight.instrumentGlow * 0.1);
      door.material.color.copy(tint);
      wheel.material.color.copy(tint).multiplyScalar(0.9);
      fill.material.color.copy(tint).multiplyScalar(0.018);

      const shadowOpacity = THREE.MathUtils.lerp(
        COCKPIT_CARDS.SHADOW_OPACITY_NIGHT,
        COCKPIT_CARDS.SHADOW_OPACITY_DAY,
        daylight.daylight,
      );
      dashShadow.material.opacity = shadowOpacity;
      wheelShadow.material.opacity = shadowOpacity * 0.78;
    },
    setLookYaw(lookYaw) {
      for (const card of cards) {
        card.mesh.position.x = card.baseX - lookYaw * card.parallax;
      }
    },
    setSteer(steerAngle) {
      wheel.mesh.rotation.z = -steerAngle * COCKPIT_CARDS.STEERING_RATIO;
    },
    dispose() {
      for (const card of cards) {
        card.geometry.dispose();
        card.material.dispose();
        card.texture?.dispose();
      }
      shadowTexture.dispose();
      root.removeFromParent();
    },
  };
}

function createTexturedCard(
  name: string,
  url: string,
  placement: CardPlacement,
  renderOrder: number,
): Card {
  const texture = new THREE.TextureLoader().load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.004,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  return makeCard(name, placement, renderOrder, material, texture);
}

function createSolidCard(
  name: string,
  placement: CardPlacement,
  renderOrder: number,
): Card {
  const material = new THREE.MeshBasicMaterial({
    color: 0x08070d,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  return makeCard(name, placement, renderOrder, material);
}

function createShadowCard(
  name: string,
  texture: THREE.Texture,
  placement: CardPlacement,
  renderOrder: number,
): Card {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: 0x08060d,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  return makeCard(name, placement, renderOrder, material);
}

function makeCard(
  name: string,
  placement: CardPlacement,
  renderOrder: number,
  material: THREE.MeshBasicMaterial,
  texture?: THREE.Texture,
): Card {
  const geometry = new THREE.PlaneGeometry(placement.width, placement.height);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.rotation.order = 'YXZ';
  mesh.position.set(placement.x, placement.y, placement.z);
  mesh.rotation.set(placement.pitch ?? 0, placement.yaw ?? 0, 0);
  mesh.renderOrder = renderOrder;
  return {
    mesh,
    geometry,
    material,
    texture,
    baseX: placement.x,
    parallax: placement.parallax,
  };
}

/** Small reusable radial alpha texture for painted contact-shadow cards. */
function createShadowTexture(size = 64): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / (size - 1)) * 2 - 1;
      const ny = (y / (size - 1)) * 2 - 1;
      const distance = Math.sqrt(nx * nx + ny * ny * 2.4);
      const alpha = Math.max(0, Math.min(1, (1 - distance) * 2.2));
      const offset = (y * size + x) * 4;
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = Math.round(alpha * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

/** Daylight contract colours are sRGB palette values, not linear triples. */
function setSrgb(target: THREE.Color, colour: Rgb): void {
  target.setRGB(colour.r, colour.g, colour.b, THREE.SRGBColorSpace);
}

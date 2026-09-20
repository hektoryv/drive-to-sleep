/**
 * The 911-ish interior, as a module.
 *
 * Reads the car through the `car` contract and draws a cabin. It provides no
 * service, touches no other domain, and — like `audio/` — could be deleted
 * without anything else noticing.
 *
 * ## Why the cabin still has a car-relative screen offset
 *
 * The card rig follows the cockpit camera, while its individual surfaces keep
 * their authored local pitch/yaw: horizontal scuttle, vertical dash, angled
 * door and tilted wheel. `lookYaw` becomes depth-weighted lateral parallax, so
 * near cards move farther than the shell without skewing the painted art.
 *
 * Roll, pitch and heave are applied to *both*, so they cancel: in a real car
 * your head and the dash lean together, and the world is what swings.
 */

import * as THREE from 'three';
import { COCKPIT_LAYER, type ViewState } from '../contracts/view.js';
import type { GameModule } from '../contracts/module.js';
import type { CarView } from '../contracts/vehicle.js';
import type { DaylightView } from '../contracts/daylight.js';
import { createCockpitSprites, type CockpitSprites } from './sprites.js';
import { lerp } from '../core/math.js';

export function createCockpitModule(): GameModule {
  let car: CarView | undefined;
  let daylight: DaylightView | undefined;
  let sprites: CockpitSprites | undefined;
  let root: THREE.Object3D | undefined;
  let horizonPitch = 0;
  let previousSteer = 0;
  let currentSteer = 0;

  return {
    name: 'cockpit',

    init(ctx) {
      root = new THREE.Object3D();
      // The camera uses YXZ, and the cabin has to be oriented exactly as the
      // camera is or it drifts against the view the moment the body leans.
      // Object3D defaults to XYZ, which is not the same rotation.
      root.rotation.order = 'YXZ';
      horizonPitch = ctx.framing.horizonPitch;
      sprites = createCockpitSprites();
      root.add(sprites.object);
      ctx.scene.add(root);

      // Everything in here draws in the cockpit pass, never in the
      // windscreen pass — which is scissored to the aperture and would cut
      // the dash off at its top edge.
      ctx.scene.traverse((object) => object.layers.set(COCKPIT_LAYER));
    },

    resize(framing) {
      horizonPitch = framing.horizonPitch;
    },

    start(ctx) {
      car = ctx.services.require('car');
      daylight = ctx.services.require('daylight');
      previousSteer = car.steerAngle;
      currentSteer = car.steerAngle;
    },

    step() {
      if (car === undefined) return;
      previousSteer = currentSteer;
      currentSteer = car.steerAngle;
    },

    frame(alpha: number, view: Readonly<ViewState>) {
      if (root === undefined) return;

      // The eye, from the contract. render/ resolves it once, so the cabin and
      // the camera cannot sit in different places.
      root.position.set(view.eyeX, view.eyeY, view.eyeZ);
      // Match the camera as a rig. Each card keeps its own local angle and the
      // look-ahead movement is applied as depth-weighted parallax below.
      root.rotation.set(horizonPitch + view.pitch, view.heading + view.lookYaw, -view.roll);
      sprites?.setLookYaw(view.lookYaw);

      if (car !== undefined) {
        sprites?.setSteer(lerp(previousSteer, currentSteer, alpha));
      }

      if (daylight !== undefined) {
        sprites?.setDaylight(daylight);
      }
    },

    dispose() {
      sprites?.dispose();
      root?.removeFromParent();
    },
  };
}

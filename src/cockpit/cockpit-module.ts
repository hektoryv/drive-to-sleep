/**
 * The 911-ish interior, as a module.
 *
 * Reads the car through the `car` contract and draws a cabin. It provides no
 * service, touches no other domain, and — like `audio/` — could be deleted
 * without anything else noticing.
 *
 * ## Why the cabin is in world space
 *
 * The cabin is authored in the driver's eye frame but *placed* in the world at
 * the car each frame, because that is what makes `lookYaw` work. The camera
 * yaws into a corner ahead of the car (ADR-0010); the cabin does not. Placing
 * the cabin in the car's frame and letting the camera turn inside it is what
 * swings the cabin across the view as you enter a bend — which is the whole
 * behaviour `ViewState.lookYaw` was specified for.
 *
 * Roll, pitch and heave are applied to *both*, so they cancel: in a real car
 * your head and the dash lean together, and the world is what swings.
 */

import * as THREE from 'three';
import { COCKPIT_LAYER, type ViewState } from '../contracts/view.js';
import type { GameModule } from '../contracts/module.js';
import type { CarView } from '../contracts/vehicle.js';
import type { DaylightView } from '../contracts/daylight.js';
import { applyCabinLight, setSrgb } from './materials.js';
import { CABIN_LIGHT } from './tuning.js';
import { createDash, type Dash } from './dash.js';
import { createSteeringWheel, type SteeringWheel } from './wheel.js';

export function createCockpitModule(): GameModule {
  let car: CarView | undefined;
  let daylight: DaylightView | undefined;
  let dash: Dash | undefined;
  let wheel: SteeringWheel | undefined;
  let root: THREE.Object3D | undefined;
  let materials: readonly THREE.ShaderMaterial[] = [];

  // Scratch, reused every frame — nothing is allocated in here.
  const sunWorld = new THREE.Vector3();
  const sunLocal = new THREE.Vector3();
  const inverse = new THREE.Quaternion();
  const keyColour = new THREE.Color();
  const ambientColour = new THREE.Color();

  return {
    name: 'cockpit',

    init(ctx) {
      root = new THREE.Object3D();
      // The camera uses YXZ, and the cabin has to be oriented exactly as the
      // camera is or it drifts against the view the moment the body leans.
      // Object3D defaults to XYZ, which is not the same rotation.
      root.rotation.order = 'YXZ';
      dash = createDash();
      wheel = createSteeringWheel();
      root.add(dash.object, wheel.object);
      materials = [...dash.materials, ...wheel.materials];
      ctx.scene.add(root);

      // Everything in here draws in the cockpit pass, never in the
      // windscreen pass — which is scissored to the aperture and would cut
      // the dash off at its top edge.
      ctx.scene.traverse((object) => object.layers.set(COCKPIT_LAYER));
    },

    start(ctx) {
      car = ctx.services.require('car');
      daylight = ctx.services.require('daylight');
    },

    frame(_alpha: number, view: Readonly<ViewState>) {
      if (root === undefined) return;

      // The eye, from the contract. render/ resolves it once, so the cabin and
      // the camera cannot sit in different places.
      root.position.set(view.eyeX, view.eyeY, view.eyeZ);
      // No lookYaw. See the note at the top of this file.
      root.rotation.set(view.pitch, view.heading, -view.roll);

      if (car !== undefined) wheel?.setSteer(car.steerAngle);

      if (daylight !== undefined) {
        // The sun, as seen from the driver's seat. Held above the cabin's own
        // horizontal: once it has set, an interior should fall to ambient
        // rather than start being lit from under the floorpan.
        sunWorld.set(daylight.sunX, Math.max(daylight.sunY, 0.05), daylight.sunZ).normalize();
        inverse.copy(root.quaternion).invert();
        sunLocal.copy(sunWorld).applyQuaternion(inverse);

        setSrgb(keyColour, daylight.sunLight);
        setSrgb(ambientColour, daylight.ambient);
        // The key fades out with the daylight rather than with the sun's
        // height, so the cabin goes dim through dusk instead of snapping dark
        // the instant the disc drops below the horizon.
        applyCabinLight(
          materials,
          sunLocal,
          keyColour,
          ambientColour,
          CABIN_LIGHT.KEY_STRENGTH * daylight.daylight,
        );
      }
    },

    dispose() {
      dash?.dispose();
      wheel?.dispose();
      root?.removeFromParent();
    },
  };
}

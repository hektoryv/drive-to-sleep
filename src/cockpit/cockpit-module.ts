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
import { createDash, type Dash } from './dash.js';
import { createSteeringWheel, type SteeringWheel } from './wheel.js';

export function createCockpitModule(): GameModule {
  let car: CarView | undefined;
  let dash: Dash | undefined;
  let wheel: SteeringWheel | undefined;
  let root: THREE.Object3D | undefined;

  return {
    name: 'cockpit',

    init(ctx) {
      root = new THREE.Object3D();
      dash = createDash();
      wheel = createSteeringWheel();
      root.add(dash.object, wheel.object);
      ctx.scene.add(root);

      // Everything in here draws in the cockpit pass, never in the
      // windscreen pass — which is scissored to the aperture and would cut
      // the dash off at its top edge.
      ctx.scene.traverse((object) => object.layers.set(COCKPIT_LAYER));
    },

    start(ctx) {
      car = ctx.services.require('car');
    },

    frame(_alpha: number, view: Readonly<ViewState>) {
      if (root === undefined) return;

      // The eye, from the contract. render/ resolves it once, so the cabin and
      // the camera cannot sit in different places.
      root.position.set(view.eyeX, view.eyeY, view.eyeZ);
      // No lookYaw. See the note at the top of this file.
      root.rotation.set(view.pitch, view.heading, -view.roll);

      if (car !== undefined) wheel?.setSteer(car.steerAngle);
    },

    dispose() {
      dash?.dispose();
      wheel?.dispose();
      root?.removeFromParent();
    },
  };
}

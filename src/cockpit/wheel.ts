/**
 * The steering wheel.
 *
 * "The steering wheel turns with the finger" is in the opening brief, and
 * ADR-0004 makes it a requirement rather than a flourish: the control scheme
 * is position-mapped, so the wheel and the thumb must never disagree. The
 * wheel is therefore driven from `CarView.steerAngle` — the same value the
 * tyres get — and not from anything of its own.
 *
 * A thin three-spoke wheel with an alloy centre, which is the 1970s sports car
 * shape without being any particular one of them (non-negotiable 7).
 */

import * as THREE from 'three';
import { WHEEL } from './tuning.js';
import { CABIN_COLOURS } from './tuning.js';
import { createCabinMaterial } from './materials.js';

export interface SteeringWheel {
  readonly object: THREE.Object3D;
  /** So the module can point them all at the sun each frame. */
  readonly materials: readonly THREE.ShaderMaterial[];
  /** `steerAngle` is the road wheel angle, radians. */
  setSteer(steerAngle: number): void;
  dispose(): void;
}

export function createSteeringWheel(): SteeringWheel {
  // The mount carries the rake; the wheel spins inside it. Separating the two
  // means the rake is set once and the rotation stays a single number.
  const mount = new THREE.Object3D();
  mount.position.set(0, -WHEEL.DROP_M, WHEEL.Z);
  mount.rotation.x = -WHEEL.RAKE;

  const spinner = new THREE.Object3D();
  mount.add(spinner);

  const rimMaterial = createCabinMaterial(CABIN_COLOURS.RIM);
  const alloyMaterial = createCabinMaterial(CABIN_COLOURS.ALLOY);

  const rimGeometry = new THREE.TorusGeometry(
    WHEEL.RIM_RADIUS_M,
    WHEEL.RIM_THICKNESS_M,
    8,
    44,
  );
  spinner.add(new THREE.Mesh(rimGeometry, rimMaterial));

  // Spokes. The classic arrangement is one down and two up at the shoulders,
  // so the top of the wheel stays clear and the dials behind it stay readable.
  const spokeGeometry = new THREE.BoxGeometry(
    WHEEL.SPOKE_WIDTH_M,
    WHEEL.RIM_RADIUS_M,
    WHEEL.SPOKE_THICKNESS_M,
  );
  for (let i = 0; i < WHEEL.SPOKES; i++) {
    const angle = Math.PI + (i / WHEEL.SPOKES) * Math.PI * 2;
    const spoke = new THREE.Mesh(spokeGeometry, alloyMaterial);
    spoke.position.set(
      (Math.sin(angle) * WHEEL.RIM_RADIUS_M) / 2,
      (Math.cos(angle) * WHEEL.RIM_RADIUS_M) / 2,
      0,
    );
    spoke.rotation.z = -angle;
    spinner.add(spoke);
  }

  const hubGeometry = new THREE.CylinderGeometry(
    WHEEL.HUB_RADIUS_M,
    WHEEL.HUB_RADIUS_M,
    WHEEL.HUB_DEPTH_M,
    18,
  );
  const hub = new THREE.Mesh(hubGeometry, alloyMaterial);
  hub.rotation.x = Math.PI / 2;
  spinner.add(hub);

  return {
    object: mount,
    materials: [rimMaterial, alloyMaterial],

    setSteer(steerAngle: number) {
      // Negated: turning the road wheels right is a clockwise turn of the rim,
      // which is negative about the wheel's own forward axis.
      spinner.rotation.z = -steerAngle * WHEEL.TURNS_PER_STEER;
    },

    dispose() {
      rimGeometry.dispose();
      spokeGeometry.dispose();
      hubGeometry.dispose();
      rimMaterial.dispose();
      alloyMaterial.dispose();
    },
  };
}

/**
 * The dash: the shelf under the windscreen, its face, and the binnacle hood.
 *
 * Boxes, deliberately. The look of this game comes from sky, fog and palette
 * (ADR-0007), and a cabin is a handful of large flat planes catching one light
 * — which is exactly what a few boxes with a half-lambert term are. Modelling
 * it properly would cost a week and change the picture very little.
 *
 * Dials and needles are not here yet. The binnacle is built as a hooded recess
 * ready for them, because the recess is what makes the shape read as a 911
 * binnacle rather than as a shelf.
 */

import * as THREE from 'three';
import { BINNACLE, CABIN, CABIN_COLOURS, DASH } from './tuning.js';
import { createCabinMaterial } from './materials.js';

export interface Dash {
  readonly object: THREE.Object3D;
  /** So the module can point them all at the sun each frame. */
  readonly materials: readonly THREE.ShaderMaterial[];
  dispose(): void;
}

export function createDash(): Dash {
  const root = new THREE.Object3D();
  // The cabin's centreline, which is to the right of the driver's eye.
  root.position.x = CABIN.CENTRE_X;

  const leather = createCabinMaterial(CABIN_COLOURS.LEATHER);
  const leatherDark = createCabinMaterial(CABIN_COLOURS.LEATHER_DARK);
  const panel = createCabinMaterial(CABIN_COLOURS.PANEL);
  const geometries: THREE.BufferGeometry[] = [];

  function box(
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(w, h, d);
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    root.add(mesh);
    return mesh;
  }

  // One solid mass, not a plate on legs.
  //
  // The first version built the shelf and its face as separate thin boxes,
  // which from the driver's seat read as a table: you could see the underside
  // of the top and the edge where it stopped. A dash is a single moulded lump
  // with one visible surface, and it is much easier to make a lump look right
  // than to hide the seams of an assembly.
  //
  // It runs well past the frame in every direction, so no edge of it is ever
  // in shot. A cabin you can see the end of is a prop.
  const body = box(
    DASH.WIDTH_M,
    DASH.FACE_M,
    DASH.DEPTH_M,
    panel,
    0,
    -DASH.DROP_M - DASH.FACE_M / 2,
    DASH.FRONT_Z + DASH.DEPTH_M / 2,
  );
  body.rotation.x = -DASH.RAKE;

  // The red top catches the sunset; the dark vertical face keeps the lower
  // half of the screen from becoming one uninterrupted red slab.
  const shelf = box(
    DASH.WIDTH_M,
    0.09,
    DASH.DEPTH_M,
    leather,
    0,
    -DASH.DROP_M + 0.02,
    DASH.FRONT_Z + DASH.DEPTH_M / 2,
  );
  shelf.rotation.x = -DASH.RAKE;

  // A darker band along the leading edge, where the top surface turns down
  // toward the windscreen. Two tones is all it takes to stop a single box
  // reading as a single box.
  box(
    DASH.WIDTH_M,
    0.06,
    0.02,
    leatherDark,
    0,
    -DASH.DROP_M - 0.02,
    DASH.FRONT_Z + 0.01,
  );

  // A low hood across the dial cluster. Its face stays open; gauges.ts owns
  // the instruments themselves and can be removed without changing the dash.
  const hood = box(
    BINNACLE.WIDTH_M,
    0.045,
    BINNACLE.DEPTH_M,
    leatherDark,
    -CABIN.CENTRE_X,
    -BINNACLE.DROP_M + BINNACLE.HEIGHT_M / 2,
    BINNACLE.Z,
  );
  hood.rotation.x = -0.08;

  return {
    object: root,
    materials: [leather, leatherDark, panel],
    dispose() {
      for (const g of geometries) g.dispose();
      leather.dispose();
      leatherDark.dispose();
      panel.dispose();
    },
  };
}

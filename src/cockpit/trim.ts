/** Broad cabin silhouettes: A-pillars, scuttle and door cards. */

import * as THREE from 'three';
import { createCabinMaterial } from './materials.js';
import { CABIN_COLOURS, TRIM } from './tuning.js';

export interface CabinTrim {
  readonly object: THREE.Object3D;
  readonly materials: readonly THREE.ShaderMaterial[];
  dispose(): void;
}

export function createCabinTrim(): CabinTrim {
  const root = new THREE.Object3D();
  const leather = createCabinMaterial(CABIN_COLOURS.LEATHER);
  const dark = createCabinMaterial(CABIN_COLOURS.LEATHER_DARK);
  const panel = createCabinMaterial(CABIN_COLOURS.PANEL);
  const geometries: THREE.BufferGeometry[] = [];

  function box(
    size: readonly [number, number, number],
    material: THREE.Material,
    position: readonly [number, number, number],
  ): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(...size);
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    root.add(mesh);
    return mesh;
  }

  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const pillar = box(
      [TRIM.PILLAR_WIDTH_M, TRIM.PILLAR_HEIGHT_M, 0.075],
      dark,
      [TRIM.PILLAR_X[i] ?? 0, TRIM.PILLAR_Y, TRIM.PILLAR_Z],
    );
    pillar.rotation.z = -side * TRIM.PILLAR_ANGLE;

    const door = box(
      [0.43, 0.72, 0.22],
      leather,
      [TRIM.DOOR_X[i] ?? 0, TRIM.DOOR_Y, TRIM.DOOR_Z],
    );
    door.rotation.z = side * 0.1;

    const doorTop = box(
      [0.45, 0.065, 0.24],
      panel,
      [TRIM.DOOR_X[i] ?? 0, TRIM.DOOR_Y + 0.34, TRIM.DOOR_Z - 0.02],
    );
    doorTop.rotation.z = side * 0.1;
  }

  // The windscreen base overlaps the dash top and hides the artificial seam
  // between world and cockpit passes.
  box(
    [TRIM.SCUTTLE_WIDTH_M, TRIM.SCUTTLE_HEIGHT_M, 0.13],
    leather,
    [0, TRIM.SCUTTLE_Y, TRIM.SCUTTLE_Z],
  );

  // Passenger-side ventilation. Four shadow lines are enough to suggest the
  // horizontal 1970s dash without spending geometry on a full console.
  for (let i = 0; i < 4; i++) {
    box(
      [0.15, 0.008, 0.012],
      dark,
      [0.31, GAUGE_ROW_Y - i * 0.017, -0.575],
    );
  }

  return {
    object: root,
    materials: [leather, dark, panel],
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      leather.dispose();
      dark.dispose();
      panel.dispose();
    },
  };
}

const GAUGE_ROW_Y = -0.39;

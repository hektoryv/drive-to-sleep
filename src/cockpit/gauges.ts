/**
 * The five-dial instrument cluster.
 *
 * It is deliberately geometric rather than textured: one instanced circle,
 * ring and tick set gives crisp instruments at every phone resolution and
 * leaves only the five moving needles as separate objects.
 */

import * as THREE from 'three';
import type { CarView } from '../contracts/vehicle.js';
import { clamp } from '../core/math.js';
import { createCabinMaterial } from './materials.js';
import { CABIN_COLOURS, GAUGES } from './tuning.js';

export interface Gauges {
  readonly object: THREE.Object3D;
  readonly materials: readonly THREE.ShaderMaterial[];
  update(car: CarView, glow: number): void;
  dispose(): void;
}

export function gaugeAngle(value: number, maximum: number): number {
  const t = maximum > 0 ? clamp(value / maximum, 0, 1) : 0;
  return GAUGES.START_ANGLE + GAUGES.SWEEP * t;
}

export function createGauges(): Gauges {
  const root = new THREE.Object3D();
  const panelMaterial = createCabinMaterial(CABIN_COLOURS.INSTRUMENT);
  const faceMaterial = new THREE.MeshBasicMaterial({ color: CABIN_COLOURS.DIAL });
  const bezelMaterial = new THREE.MeshBasicMaterial({ color: 0x45414a });
  const tickMaterial = new THREE.MeshBasicMaterial({ color: CABIN_COLOURS.MARKING });
  const needleMaterial = new THREE.MeshBasicMaterial({ color: CABIN_COLOURS.NEEDLE });

  const panelGeometry = new THREE.BoxGeometry(0.44, 0.155, 0.035);
  const panel = new THREE.Mesh(panelGeometry, panelMaterial);
  panel.position.set(0, GAUGES.Y, GAUGES.Z - 0.025);
  root.add(panel);

  const faceGeometry = new THREE.CircleGeometry(1, 32);
  const faces = new THREE.InstancedMesh(faceGeometry, faceMaterial, GAUGES.X.length);
  const bezelGeometry = new THREE.RingGeometry(0.88, 1, 32);
  const bezels = new THREE.InstancedMesh(bezelGeometry, bezelMaterial, GAUGES.X.length);
  const tickGeometry = new THREE.BoxGeometry(0.004, 0.014, 0.004);
  const tickCount = GAUGES.TICKS.reduce((sum, count) => sum + count, 0);
  const ticks = new THREE.InstancedMesh(tickGeometry, tickMaterial, tickCount);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const needles: THREE.Object3D[] = [];
  const needleGeometries: THREE.BufferGeometry[] = [];

  let tickIndex = 0;
  for (let i = 0; i < GAUGES.X.length; i++) {
    const x = GAUGES.X[i] ?? 0;
    const radius = GAUGES.RADIUS[i] ?? 0.06;
    position.set(x, GAUGES.Y, GAUGES.Z);
    rotation.identity();
    scale.setScalar(radius);
    matrix.compose(position, rotation, scale);
    faces.setMatrixAt(i, matrix);

    position.z += 0.002;
    matrix.compose(position, rotation, scale);
    bezels.setMatrixAt(i, matrix);

    const count = GAUGES.TICKS[i] ?? 9;
    for (let j = 0; j < count; j++) {
      const angle = GAUGES.START_ANGLE + (GAUGES.SWEEP * j) / (count - 1);
      const distance = radius * 0.72;
      position.set(
        x - Math.sin(angle) * distance,
        GAUGES.Y + Math.cos(angle) * distance,
        GAUGES.Z + 0.006,
      );
      rotation.setFromAxisAngle(Z_AXIS, angle);
      scale.set(radius / 0.09, radius / 0.09, 1);
      matrix.compose(position, rotation, scale);
      ticks.setMatrixAt(tickIndex++, matrix);
    }

    const needleGeometry = new THREE.BoxGeometry(0.006, radius * 0.7, 0.006);
    needleGeometry.translate(0, radius * 0.29, 0);
    needleGeometries.push(needleGeometry);
    const needle = new THREE.Mesh(needleGeometry, needleMaterial);
    needle.position.set(x, GAUGES.Y, GAUGES.Z + 0.012);
    root.add(needle);
    needles.push(needle);
  }
  faces.instanceMatrix.needsUpdate = true;
  bezels.instanceMatrix.needsUpdate = true;
  ticks.instanceMatrix.needsUpdate = true;
  root.add(faces, bezels, ticks);

  return {
    object: root,
    materials: [panelMaterial],
    update(car, glow) {
      // Outer dials imply fuel/oil/temperature; their gentle movement is tied
      // to real car state so the cluster never looks frozen. The two large
      // instruments are the values the driver actually needs.
      const speed = gaugeAngle(car.speedMs, GAUGES.MAX_SPEED_MS);
      const rpm = gaugeAngle(car.rpm, car.maxRpm);
      const values = [
        GAUGES.START_ANGLE + GAUGES.SWEEP * (0.4 + car.speedMs / 500),
        speed,
        rpm,
        GAUGES.START_ANGLE + GAUGES.SWEEP * (0.46 + car.rpm / car.maxRpm / 12),
        GAUGES.START_ANGLE + GAUGES.SWEEP * (0.62 - car.speedMs / 900),
      ];
      for (let i = 0; i < needles.length; i++) {
        const needle = needles[i];
        if (needle !== undefined) needle.rotation.z = values[i] ?? GAUGES.START_ANGLE;
      }

      const light = clamp(glow, 0, 1);
      faceMaterial.color.setRGB(0.015 + light * 0.018, 0.012 + light * 0.01, 0.02 + light * 0.025);
      tickMaterial.color.setRGB(0.36 + light * 0.42, 0.31 + light * 0.25, 0.34 + light * 0.18);
      needleMaterial.color.setRGB(0.58 + light * 0.35, 0.035 + light * 0.02, 0.025);
    },
    dispose() {
      panelGeometry.dispose();
      faceGeometry.dispose();
      bezelGeometry.dispose();
      tickGeometry.dispose();
      for (const geometry of needleGeometries) geometry.dispose();
      panelMaterial.dispose();
      faceMaterial.dispose();
      bezelMaterial.dispose();
      tickMaterial.dispose();
      needleMaterial.dispose();
    },
  };
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);

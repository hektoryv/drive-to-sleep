/** Loading, metre normalisation and steering animation for the placeholder GLB. */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { COCKPIT_LAYER } from '../contracts/view.js';
import { scaleForPlayerCar } from './model-scale.js';
import { COCKPIT_MODEL } from './tuning.js';

const MODEL_URL = new URL('./assets/porsche-930-placeholder.glb', import.meta.url).href;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

export interface CockpitModel {
  readonly object: THREE.Object3D;
  setSteer(steerAngle: number): void;
  /** Road surface height in the driver's eye frame, normally about -1.12 m. */
  setGroundFromEye(offsetY: number): void;
  dispose(): void;
}

export function createCockpitModel(): CockpitModel {
  const root = new THREE.Group();
  root.name = 'cockpit-model-root';

  const vehicle = new THREE.Group();
  vehicle.name = 'player-car-4.291m';
  root.add(vehicle);

  let loaded: THREE.Object3D | undefined;
  let steeringPivot: THREE.Object3D | undefined;
  let groundFromEye = -1.12;
  let modelGroundY = 0;
  let steer = 0;
  let disposed = false;

  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      const scene = gltf.scene;
      scene.name = 'porsche-930-placeholder';

      const sourceBounds = new THREE.Box3().setFromObject(scene);
      const sourceLength = sourceBounds.max.z - sourceBounds.min.z;
      const scale = scaleForPlayerCar(sourceLength);

      scene.scale.multiplyScalar(scale);
      scene.rotation.y += COCKPIT_MODEL.YAW_RADIANS;
      scene.updateMatrixWorld(true);

      // Measure while detached: Box3 reports world-space bounds, and once the
      // scene is under the live cockpit root those include the driver's world
      // position. Including that translation here would subtract eye height
      // twice and bury the car under the road.
      const orientedBounds = new THREE.Box3().setFromObject(scene);
      modelGroundY = orientedBounds.min.y;
      vehicle.add(scene);

      // The calibrated source-space eye point is transformed by the exact same
      // uniform scale and half-turn as the mesh. X/Z therefore land the camera
      // in the real driver's seat while Y is anchored to the road below.
      const eye = new THREE.Vector3(...COCKPIT_MODEL.SOURCE_DRIVER_EYE)
        .multiplyScalar(scale)
        .applyAxisAngle(Y_AXIS, COCKPIT_MODEL.YAW_RADIANS);
      vehicle.position.set(
        -eye.x,
        groundFromEye - modelGroundY + COCKPIT_MODEL.VISUAL_Y_OFFSET_M,
        -eye.z,
      );
      for (const name of COCKPIT_MODEL.HIDDEN_SHELL_NODES) {
        const hidden = scene.getObjectByName(name);
        if (hidden !== undefined) hidden.visible = false;
      }
      liftTexturedMaterials(scene);

      const wheel = scene.getObjectByName(COCKPIT_MODEL.STEERING_WHEEL_NODE);
      if (wheel === undefined) {
        console.warn('The imported cockpit loaded, but its steering-wheel node was not found.');
      } else {
        // Re-parent around the mesh's own centre. The exporter left every
        // material group at the car origin, so rotating the node directly
        // would swing the wheel around the whole car instead of its column.
        root.updateMatrixWorld(true);
        const centreWorld = new THREE.Box3().setFromObject(wheel).getCenter(new THREE.Vector3());
        const centreVehicle = vehicle.worldToLocal(centreWorld.clone());
        steeringPivot = new THREE.Object3D();
        steeringPivot.name = 'steering-wheel-pivot';
        steeringPivot.position.copy(centreVehicle);
        vehicle.add(steeringPivot);
        steeringPivot.attach(wheel);
        steeringPivot.rotation.z = -steer * COCKPIT_MODEL.STEERING_RATIO;
      }

      root.traverse((object) => object.layers.set(COCKPIT_LAYER));
      loaded = scene;

      if (disposed) disposeObject(root);
    },
    undefined,
    (error) => console.error('Could not load the placeholder cockpit GLB.', error),
  );

  return {
    object: root,
    setSteer(steerAngle) {
      steer = steerAngle;
      if (steeringPivot !== undefined) {
        steeringPivot.rotation.z = -steerAngle * COCKPIT_MODEL.STEERING_RATIO;
      }
    },
    setGroundFromEye(offsetY) {
      groundFromEye = offsetY;
      if (loaded !== undefined) {
        vehicle.position.y = groundFromEye - modelGroundY + COCKPIT_MODEL.VISUAL_Y_OFFSET_M;
      }
    },
    dispose() {
      disposed = true;
      if (loaded !== undefined) disposeObject(root);
      root.removeFromParent();
    },
  };
}

/**
 * The scanned interior textures are authored almost black and assume an HDR
 * environment map. The game deliberately has no global environment light, so
 * a small texture-fed emissive term supplies the window bounce they expect
 * while the real directional light still shapes the cabin.
 */
function liftTexturedMaterials(root: THREE.Object3D): void {
  const seen = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (seen.has(material) || !(material instanceof THREE.MeshStandardMaterial)) continue;
      seen.add(material);
      if (material.map === null) continue;
      material.emissiveMap = material.map;
      material.emissive.set(0xffffff);
      material.emissiveIntensity = 0.22;
      material.needsUpdate = true;
    }
  });
}

function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const entries = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of entries) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });

  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
}

/**
 * WebGL renderer setup and the portrait framing applied to it.
 *
 * The world is drawn only into the aperture band. Scissoring rather than
 * letterboxing with DOM means the GPU never shades the world into the pixels
 * the car covers — over half the display on a portrait phone, and a large part
 * of how the frame budget gets met.
 *
 * The cockpit is therefore a **second pass** over the whole display, on its own
 * layer with its own frustum (ADR-0017). The two frustums share a centre line
 * and an angular scale, so the cabin and the world agree about where the
 * horizon is; the cockpit's simply extends past the aperture to the screen
 * edges. It is drawn after the world and over it, so the dash occludes the
 * bottom of the windscreen exactly as a real one does.
 */

import * as THREE from 'three';
import { CHASE, TONEMAP_EXPOSURE, VIEW } from './tuning.js';
import { clampPixelRatio, computeFraming, toGlY } from './framing.js';
import { COCKPIT_LAYER, type Framing, type FramingOverrides, type ViewState } from '../contracts/view.js';

/** Cockpit is the game. Chase exists only to look at the car — see CHASE. */
export type CameraMode = 'cockpit' | 'chase';

export interface Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly camera: THREE.PerspectiveCamera;
  readonly framing: Framing;
  readonly info: { drawCalls: number; triangles: number; programs: number };
  resize(width: number, height: number, rawPixelRatio: number): void;
  /** Replaces the framing overrides and re-derives the projection. */
  setFramingOverrides(overrides: FramingOverrides): void;
  setCameraMode(mode: CameraMode): void;
  render(scene: THREE.Scene, view: Readonly<ViewState>): void;
  dispose(): void;
}

/** The cabin is black; the letterbox is the car, not a bar. */
const CABIN_COLOR = 0x08080a;

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const gl = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    // The screenshot harness reads pixels after the frame; without this the
    // buffer may already have been cleared by the time it looks.
    preserveDrawingBuffer: true,
  });

  gl.setClearColor(CABIN_COLOR, 1);
  // Clears are explicit, because there are two passes and the second must not
  // wipe the first. With autoClear left on, rendering the cockpit over the
  // full viewport clears the whole canvas and the world disappears.
  gl.autoClear = false;
  // Filmic tonemapping from day one — ADR-0007. It is most of the difference
  // between "looks like a game" and "looks good", and retro-fitting it later
  // would invalidate every colour choice made before it.
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = TONEMAP_EXPOSURE;
  gl.outputColorSpace = THREE.SRGBColorSpace;

  const camera = new THREE.PerspectiveCamera(50, 1, VIEW.NEAR_PLANE, VIEW.FAR_PLANE);
  camera.rotation.order = 'YXZ';
  // The world camera sees layer 0 only, so cockpit geometry can never leak
  // into the windscreen pass and be clipped to it.
  camera.layers.set(0);

  // The cockpit's camera. Same position and rotation, every frame; only the
  // projection differs. Near plane pulled in because the wheel rim really is
  // about a hand's width from the eye.
  const cockpitCamera = new THREE.PerspectiveCamera(50, 1, 0.05, 10);
  cockpitCamera.rotation.order = 'YXZ';
  cockpitCamera.layers.set(COCKPIT_LAYER);

  let cameraMode: CameraMode = 'cockpit';
  let overrides: FramingOverrides = {};
  let lastSize = { width: 1, height: 1, rawPixelRatio: 1 };
  let framing = computeFraming(1, 1, 1);

  function resize(width: number, height: number, rawPixelRatio: number): void {
    lastSize = { width, height, rawPixelRatio };
    const pixelRatio = clampPixelRatio(rawPixelRatio);
    framing = computeFraming(width, height, pixelRatio, overrides);

    gl.setPixelRatio(pixelRatio);
    gl.setSize(width, height, false);

    camera.fov = THREE.MathUtils.radToDeg(framing.vFov);
    camera.aspect = framing.apertureAspect;
    camera.updateProjectionMatrix();

    cockpitCamera.fov = THREE.MathUtils.radToDeg(framing.cockpit.vFov);
    cockpitCamera.aspect = framing.cockpit.aspect;
    // The display is a window into a taller frustum centred on the aperture.
    // This is the whole trick: without the offset the cabin would be centred
    // on the middle of the screen and would sit at a different horizon from
    // the road it is supposed to be a car in.
    cockpitCamera.setViewOffset(
      width,
      framing.cockpit.fullHeight,
      0,
      framing.cockpit.offsetY,
      width,
      height,
    );
    cockpitCamera.updateProjectionMatrix();
  }

  function render(scene: THREE.Scene, view: Readonly<ViewState>): void {
    const sin = Math.sin(view.heading);
    const cos = Math.cos(view.heading);

    if (cameraMode === 'chase') {
      // Behind and above, along the car's own axes. Inherits only part of the
      // roll, because a chase camera that rolls fully with the body hides the
      // very thing it was brought out to show.
      const forwardX = -sin;
      const forwardZ = -cos;
      camera.position.set(
        view.x - forwardX * CHASE.BACK_M,
        view.y + CHASE.UP_M + view.heaveY,
        view.z - forwardZ * CHASE.BACK_M,
      );
      camera.rotation.set(
        CHASE.PITCH + view.pitch,
        view.heading + view.lookYaw,
        -view.roll * CHASE.ROLL_SHARE,
      );
    } else {
      // The eye is resolved once, in view-module.ts, so that the cabin and the
      // camera cannot end up in different places.
      camera.position.set(view.eyeX, view.eyeY, view.eyeZ);
      // horizonPitch is framing, not motion: it places the horizon within the
      // aperture and is constant for a given screen.
      camera.rotation.set(
        framing.horizonPitch + view.pitch,
        view.heading + view.lookYaw,
        // Negated: a positive z rotation tilts the camera's up vector toward
        // -X, which leans it left, while ViewState.roll is positive leaning
        // right. Passing it through unflipped banks the world the wrong way.
        -view.roll,
      );
    }

    const ap = framing.aperture;
    const glY = toGlY(framing, ap);

    gl.setScissorTest(false);
    gl.clear(true, true, true);

    gl.setScissorTest(true);
    gl.setScissor(ap.x, glY, ap.w, ap.h);
    gl.setViewport(ap.x, glY, ap.w, ap.h);
    gl.render(scene, camera);
    gl.setScissorTest(false);

    // The cockpit, over the whole display. The chase camera is a debug view
    // from outside the car, so there is no cabin to draw in it.
    if (cameraMode === 'cockpit') {
      cockpitCamera.position.copy(camera.position);
      cockpitCamera.rotation.copy(camera.rotation);
      gl.setViewport(0, 0, framing.width, framing.height);
      // Depth only: the world stays, and the cabin is drawn in front of it.
      gl.clearDepth();
      gl.render(scene, cockpitCamera);
    }
  }

  return {
    canvas,
    camera,
    get framing() {
      return framing;
    },
    get info() {
      return {
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        programs: gl.info.programs?.length ?? 0,
      };
    },
    resize,
    setCameraMode(mode: CameraMode) {
      cameraMode = mode;
    },
    setFramingOverrides(next: FramingOverrides) {
      overrides = next;
      resize(lastSize.width, lastSize.height, lastSize.rawPixelRatio);
    },
    render,
    dispose() {
      gl.dispose();
    },
  };
}

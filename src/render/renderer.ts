/**
 * WebGL renderer setup and the portrait framing applied to it.
 *
 * The world is drawn only into the aperture band; everything outside it is
 * cleared to the cabin colour and will be real cockpit geometry from Phase 4.
 * Scissoring rather than letterboxing with DOM means the GPU never shades the
 * pixels the car covers — which on a portrait phone is over half the display,
 * and is a large part of how the frame budget gets met.
 */

import * as THREE from 'three';
import { VIEW } from '../sim/tuning.js';
import {
  clampPixelRatio,
  computeFraming,
  toGlY,
  type Framing,
  type FramingOverrides,
} from './framing.js';

/** What the renderer needs from the simulation each frame. Read-only to it. */
export interface ViewState {
  /** Eye position in world space, metres. */
  x: number;
  z: number;
  /** Heading in radians. 0 looks down -Z. Where the *car* points. */
  heading: number;
  /**
   * Look-ahead yaw offset, radians (ADR-0010). Applied to the camera only —
   * never folded into `heading`, because from Phase 4 the cockpit geometry
   * rides on `heading` and must stay put while the driver's head turns.
   */
  lookYaw: number;
  /** Body attitude, radians. Roll is positive leaning right. */
  roll: number;
  pitch: number;
  /** Body heave, metres, added to eye height. */
  heaveY: number;
}

export function makeViewState(): ViewState {
  return { x: 0, z: 0, heading: 0, lookYaw: 0, roll: 0, pitch: 0, heaveY: 0 };
}

export interface Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly camera: THREE.PerspectiveCamera;
  readonly framing: Framing;
  readonly info: { drawCalls: number; triangles: number; programs: number };
  resize(width: number, height: number, rawPixelRatio: number): void;
  /** Replaces the framing overrides and re-derives the projection. */
  setFramingOverrides(overrides: FramingOverrides): void;
  render(scene: THREE.Scene, view: ViewState): void;
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
  // Filmic tonemapping from day one — ADR-0007. It is most of the difference
  // between "looks like a game" and "looks good", and retro-fitting it later
  // would invalidate every colour choice made before it.
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = 1.15;
  gl.outputColorSpace = THREE.SRGBColorSpace;

  const camera = new THREE.PerspectiveCamera(50, 1, VIEW.NEAR_PLANE, VIEW.FAR_PLANE);
  camera.rotation.order = 'YXZ';

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
  }

  function render(scene: THREE.Scene, view: ViewState): void {
    // The eye sits left of centre in a left-hand-drive car, offset along the
    // car's own right axis rather than the world's.
    const sin = Math.sin(view.heading);
    const cos = Math.cos(view.heading);
    camera.position.set(
      view.x + VIEW.EYE_LATERAL * cos,
      VIEW.EYE_HEIGHT + view.heaveY,
      view.z - VIEW.EYE_LATERAL * sin,
    );
    // horizonPitch is framing, not motion: it places the horizon within the
    // aperture and is constant for a given screen.
    camera.rotation.set(
      framing.horizonPitch + view.pitch,
      view.heading + view.lookYaw,
      view.roll,
    );

    const ap = framing.aperture;
    const glY = toGlY(framing, ap);

    gl.setScissorTest(false);
    gl.clear(true, true, true);

    gl.setScissorTest(true);
    gl.setScissor(ap.x, glY, ap.w, ap.h);
    gl.setViewport(ap.x, glY, ap.w, ap.h);
    gl.render(scene, camera);
    gl.setScissorTest(false);
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

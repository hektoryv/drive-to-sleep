# ADR-0017 — The cockpit is a second pass with its own frustum

**Date:** 2026-09-20 · **Status:** Accepted
**Builds on:** [ADR-0009](ADR-0009-horizontal-fov.md), [ADR-0011](ADR-0011-module-architecture.md)

## Context

The world is scissored to the aperture band and nothing else. That is not a
detail — it is a large part of how the frame budget is met, because on a
portrait phone the car covers more than half the display, and scissoring means
the GPU never shades the sky, the terrain or the fog into pixels that are about
to be covered by a dashboard.

Which leaves the dashboard nowhere to be drawn. Cockpit geometry added to the
world scene is clipped to the aperture along with everything else, so the dash
would be cut off at its own top edge and the bottom half of the screen would
stay the flat black it has been since Phase 0.

## Decision

**The cockpit is drawn in a second pass, over the whole display, on its own
layer, with its own camera.**

- `COCKPIT_LAYER` lives in `contracts/view.ts`. The cockpit puts its geometry
  on it; the renderer's world camera is restricted to layer 0 and its cockpit
  camera to that layer. Neither domain imports the other (ADR-0011).
- The cockpit camera shares the world camera's **position and rotation every
  frame**, and differs only in projection.
- That projection is the world's frustum *extended to the screen edges*, and it
  stays **centred on the aperture** rather than on the screen. This is the
  whole trick, and it is done with `setViewOffset`: the display is rendered as
  a window into a taller frustum whose axis passes through the middle of the
  windscreen. Both cameras then agree about angular scale and about where
  straight-ahead is, so the cabin and the road share one horizon.
- Clears are explicit (`autoClear = false`), because a second full-viewport
  pass with three.js's default clearing wipes the first one.
- Depth is cleared between the passes, so the cabin draws in front of the world
  regardless of how far away the geometry happens to be. The dash occludes the
  bottom of the windscreen, exactly as a real one does.

## Alternatives considered

- **Draw the cabin in DOM/SVG on the cockpit's overlay layer.** Genuinely
  tempting: a rotating SVG wheel is trivial, and the module architecture
  already hands every domain its own DOM layer. Rejected because the cabin has
  to be lit by the same sun as the road — the art target is an interior lit
  warm by a sunset — and a DOM layer cannot be. It would also have to fake
  perspective that the second pass gets for free.
- **Stop scissoring and draw the world full-screen behind the cabin.** Simplest
  possible change, and it throws away the frame budget that scissoring buys:
  the sky shader is the most expensive thing in the frame and it would be
  shading a dashboard's worth of pixels that are then painted over.
- **One camera, one pass, cabin geometry inside the aperture.** The cabin would
  be squeezed into 46% of the screen with the world, which is not the framing
  in `02-art-direction.md` and is not a cockpit view.
- **Render the cabin to a texture and composite.** A render target, a second
  set of state, and no benefit over drawing it directly.

## Consequences

- **`ViewState` gained `eyeX/eyeY/eyeZ`**, written by `render/`. The cabin has
  to sit exactly where the camera is, and the alternative was `render/` and
  `cockpit/` each holding their own copy of the seat position and eye height.
  Two copies of a constant that must agree is one copy too many. This also
  fixed a doc bug: `ViewState.x/y/z` was commented as the eye position and has
  always been the car's.
- **The chase camera has no cabin.** It is a debug view from outside the car,
  so the second pass is skipped in that mode.
- **Everything in the cockpit's subtree must be on the layer.** The module sets
  it by traversing its own group after building, which means geometry added
  later must set it too, or it will silently vanish into the world pass and be
  clipped.
- **The cabin is authored in the driver's eye frame** and placed in the world
  at the car each frame, *without* `lookYaw`. That is what makes turning into a
  bend swing the cabin across the view rather than rotating the whole car
  interior with the camera — the behaviour `ViewState.lookYaw` was specified
  for and which nothing had implemented until now.

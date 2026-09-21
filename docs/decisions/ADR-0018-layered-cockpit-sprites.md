# ADR-0018 — The cockpit is layered 2.5D art, not a full-car model

**Date:** 2026-09-21 · **Status:** Accepted

**Builds on:** [ADR-0003](ADR-0003-hybrid-rendering.md), [ADR-0017](ADR-0017-cockpit-second-pass.md)

## Context

The procedural cabin was compositionally controllable but visually crude. A
licensed full-car 930 GLB was tried next, uniformly normalised to 4.291 m and
positioned from a measured driver-eye point. On a real device it looked broken:
the asset was split into many material islands, roof and glass occlusion did
not suit the portrait crop, and its scanned textures fought the deliberately
simple, faceted world. Repairing that particular mesh would spend complexity
on a noncommercial placeholder rather than on the game's look.

The camera never leaves the driver's seat. The cockpit therefore does not need
general 3D freedom; it needs one excellent composition, a wheel that turns,
and enough separation for light and motion.

## Decision

**The cockpit is a small stack of transparent, camera-facing sprite layers in
ADR-0017's existing second WebGL pass.**

- One atlas supplies an exterior frame/hood layer, an interior/dashboard
  layer, a painted warm-and-cool lighting layer, and an isolated wheel.
- A solid near-black backing closes the lower cabin behind the wheel and dash.
- The steering-wheel sprite rotates from interpolated `CarView.steerAngle`.
- The planes face the cockpit camera. Camera look-ahead is represented by a
  restrained lateral parallax shift instead of rotating a flat painting in 3D.
- `DaylightView` multiplies the painted colours and controls lighting-overlay
  opacity. It does not attempt per-pixel physical lighting.
- The atlas is brand-free: no crest, marque, model number or readable label.

## Consequences

- The cockpit costs five draw calls and ten triangles. Its single 1254×1254
  RGBA atlas is 774 KB on disk and about 6 MB uncompressed on the GPU.
- Composition is deterministic across WebGL implementations; there are no
  model pivots, material islands, normals, environment maps or GLTF loading
  differences left to glitch.
- The wheel remains independently animated, and exterior/interior/lighting can
  be retuned without regenerating every layer.
- The painted gauge needles are static. Live tach and speed needles must be
  separate geometry or sprites layered over the binnacle.
- Cockpit art is no longer a metric representation of the body. World and
  simulation units remain SI, and `PLAYER_CAR_LENGTH_M` remains the contract
  for future chase-body, traffic and collision representations.
- ADR-0017's second pass, scissor saving and camera alignment remain accepted.
  This ADR replaces only its assumption that cabin content is physical 3D
  geometry and refines its no-`lookYaw` implementation into 2D parallax.

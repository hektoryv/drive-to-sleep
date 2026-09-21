# ADR-0022 — Post-process the combined world and cockpit once

**Date:** 2026-09-21 · **Status:** Accepted

## Context

The world and cabin are separate render passes (ADR-0017), but colour grading,
vignette and display grain describe the final photographed frame. Applying
them to the world alone leaves the cabin unnaturally clean; applying two post
chains costs fill-rate and lets their grades drift apart. Phone capability also
varies mainly in pixel fill-rate, not in simulation cost.

## Decision

**Render both scene passes into one target, then present them through one
full-frame post shader.**

- The existing scissored world pass and full-screen cockpit pass share the
  same colour/depth target.
- One full-screen triangle applies a restrained bright-neighbour bloom,
  saturation/contrast grade, vignette and animated grain.
- `low`, `balanced` and `high` renderer tiers cap pixel ratio and select
  antialias, bloom and grain cost. `balanced` is the default; `?quality=` is a
  test and user override.

## Consequences

- Cabin and world receive exactly one coherent final grade.
- The cost is one render target and one extra full-screen draw, with the low
  tier able to remove bloom and cap device pixel ratio at one.
- Viewports remain expressed in CSS pixels because three.js applies device
  pixel ratio itself; scaling them before `setViewport` crops the target.

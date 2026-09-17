# ADR-0002 — Simulation/render separation and a fixed timestep

**Date:** 2026-09-17 · **Status:** Accepted

## Context

The vehicle's feel comes from a set of damped springs (roll, pitch, heave) and
a handling model with a dozen interacting constants. This has to be tuned
iteratively, must behave identically on every device, and must be debuggable
from a report as vague as "that corner felt wrong".

## Decision

1. `sim/` and `world/` are pure TypeScript: no three.js, no DOM, no WebGL.
   `render/` reads simulation state; the simulation never sees the renderer.
   Enforced by an ESLint import rule.
2. The simulation runs at a **fixed 120 Hz**. Rendering interpolates between
   the last two sim states.
3. The world is a **pure function of (seed, distance)** — fully deterministic.

## Why

Damped springs behave differently under variable dt. Without a fixed step the
car would literally feel different on a 60 Hz phone than on a 120 Hz one, and
tuning would be chasing a moving target. 120 Hz gives comfortable headroom
above the fastest spring (3.2 Hz) for a crisp rather than mushy response.

Purity in `sim/` means handling can be unit-tested and regression-tested in
plain Node with no GPU — so "I changed one constant and broke the car" gets
caught by `npm test` rather than by you, later, on your phone.

Determinism means a felt problem at 47.3 km is reproducible, the resume point
is just a seed and a distance, and screenshot comparisons mean something.

## Consequences

- Some data gets copied across the sim/render boundary each frame rather than
  shared by reference. This is a real cost and it is worth it.
- Every system needs its state pulled out into an explicit, serialisable
  object. This is more verbose up front and much easier to reason about later.
- If ADR-0001 ever has to be revisited, the entire simulation and world
  generator — the hard, valuable part — ports to another language or engine
  with no rendering entanglement to unpick.

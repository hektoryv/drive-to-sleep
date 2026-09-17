# ADR-0012 — Road geometry is integrated forward, not randomly addressable

**Date:** 2026-09-17 · **Status:** Accepted
**Refines:** [ADR-0002](ADR-0002-sim-render-separation.md)

## Context

ADR-0002 states that "the world is a pure function of (seed, distance)".
Building the road in Phase 1 showed that this is true of some of the world and
cannot be true of the rest.

Curvature, grade, width and the injected events *are* pure functions of
distance: evaluate them anywhere, in any order, with no history. But the road's
**position and heading are the integral of its curvature**, and an integral is
cumulative by construction. There is no closed form for "where is the road at
50 km" that does not involve everything before it.

This matters because two features depend on reaching a distance directly:
resuming a drive from a saved seed and distance, and the camera looking at the
road's heading ahead of the car.

## Decision

State the rule precisely, and build to it.

- **The fields are pure and evaluable anywhere.** Curvature, grade, width,
  bank, events and terrain height at any `(s, t)` need no history.
- **The geometry is their integral**, reconstructible from the seed alone at a
  cost linear in distance. Stations are generated forward from zero and stored
  in a ring buffer.
- **That cost is paid once.** Reaching 50 km is twelve thousand additions —
  microseconds. Resuming is just `ensureSpan(distance)`, and a test asserts
  that arriving in one jump lands in exactly the same place as arriving in
  small steps.

Integration is trapezoidal — the step uses the mean of the old and new headings
rather than either endpoint. Over tens of thousands of steps the naive version
drifts measurably away from where the curvature field says the road is.

## Why this is still determinism

Nothing is lost that the resume feature or the camera needed. A seed plus a
distance still completely specifies a place, and the same seed still produces a
byte-identical road. What changes is only the *cost model*: random access to
the road's shape is O(1), random access to its position is O(distance), paid
once at startup rather than per query.

The camera's look-ahead and traffic spawning both read a few hundred metres
ahead, which is inside the generated window and therefore O(1) in practice.

## Alternatives rejected

- **Integrate from zero on every query.** Correct and unusably slow.
- **Periodic anchors — cache the integrated state every kilometre.** Does not
  help: building the anchors is itself the cumulative walk, so the first query
  at 50 km still costs the same. It would only pay off if anchors were
  persisted between sessions, which trades a microsecond for a save-file format.
- **Give up on curvature and define the centreline in closed form** (sums of
  sines, as the Phase 0 placeholder did). Cheap random access, but the road's
  shape is then whatever the formula happens to do, and there is no way to
  inject a hairpin or hold a constant radius through a sweeper. The event
  system — the thing that stops the road feeling like undifferentiated noise —
  requires authoring curvature directly.

## Consequences

- A very long resume does linear work at startup. At 500 km that is 125,000
  steps, still a few milliseconds, but it is not free and it is worth knowing.
- Positions are stored as `Float64Array`: a float32 at 500 km resolves to about
  6 cm, which is visible jitter in road geometry. What reaches the GPU is
  rebased near the camera first.
- Anything that needs the road far outside the live window must be written as a
  function of the *fields*, not of the geometry. Biome selection and event
  placement already are.

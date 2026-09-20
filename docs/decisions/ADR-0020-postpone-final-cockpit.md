# ADR-0020 — Restore the procedural 3D cabin and postpone final cockpit art

**Date:** 2026-09-21 · **Status:** Accepted

**Supersedes as active implementation:** [ADR-0018](ADR-0018-layered-cockpit-sprites.md), [ADR-0019](ADR-0019-depth-separated-cockpit-cards.md)

## Context

Three attempts to replace the first procedural cabin failed real-device review.
The downloaded full-car GLB had fragmented materials, bad interior occlusion and
a scanned style that fought the faceted world. A single sprite atlas was flat,
stretched and toy-like. Separating new art across angled cards added parallax
and contact shadows, but the result still did not read as a convincing cabin.

Continuing to iterate on temporary art would delay the world and gameplay while
discarding work repeatedly. The earlier reference-led procedural 3D cabin is
not final art, but it is structurally reliable, matches the renderer and keeps
the live instruments working.

## Decision

**Restore the procedural 3D cabin from `f49c1e2` and postpone final interior
production.**

- Keep ADR-0017's dedicated cockpit render pass.
- Restore the generated dash, cowl, pillars, door cards, five live gauges and
  independently rotating steering wheel.
- Remove all downloaded-model and cockpit-sprite runtime assets and loaders.
- Keep the 4.291 m player-car length contract for future body, traffic and
  collision work; a camera-relative cabin does not redefine world scale.
- Resume Phase 3 world development. Reopen Phase 4 only with a purpose-built
  interior asset whose wheel, instruments and cabin surfaces are separable.

## Consequences

- The app returns to a known functional cockpit with dynamic tachometer and
  speedometer needles, daylight response and no external model dependency.
- Its proportions and finish remain placeholders and are not a visual target.
- ADR-0018 and ADR-0019 remain in the record because they explain the rejected
  experiments, but neither describes the active renderer after this decision.
- The next implementation task is Phase 3 guardrail placement where terrain
  falls away from the road.

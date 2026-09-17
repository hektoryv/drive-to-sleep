# ADR-0007 — Stylised low-poly world, detailed 1970s interior

**Date:** 2026-09-17 · **Status:** Accepted

## Decision

Flat-shaded, low-poly geometry throughout the world, lit and colour-graded
like a photograph. The one place that gets genuine detail is the car interior:
a recognisable early-1970s air-cooled sports car cabin — five overlapping round
dials with the tach centred, a thin three-spoke wheel, black vinyl and leather.

## Why

Low-poly plus strong lighting is the highest ratio of good-looking to expensive
available on a phone, and it ages far better than a half-achieved realism. The
work goes into sky gradients, fog, sun angle and palette discipline rather than
into polygon count.

The interior is the exception because it's on screen 100% of the time and it's
what makes the game feel like *this* game rather than a generic road. It's also
cheap to make detailed: it's a fixed, small amount of geometry that never
changes, never needs LOD, and is largely silhouette.

A black cabin is an asset rather than a limitation — it costs almost nothing to
render, never competes with the landscape, and turns into a mood instrument for
free as the light changes. At night the dial glow is the only interior light
source, which is the most evocative image in the game.

## Legal constraint

The interior is a *type* of car, not a *model* of car. Shapes and layout only.
No badges, no marque, no model name, no branding in the game, the icon, or any
store listing. Recorded here so it doesn't get casually violated later by
someone adding a nice crest to the horn push.

## Consequences

- Every biome/time pairing needs a disciplined ~6-colour palette. Palette
  discipline is the whole technique; breaking it once makes the game look cheap.
- Filmic tonemapping is required from day one, not a polish item — it's most of
  the gap between "looks like a game" and "looks good".
- Sky banding is the predictable failure mode of gradient-heavy low-poly on
  8-bit phone displays. Fixed with animated dithered grain.
- Dial glow and its spill onto the wheel is called out as worth real effort in
  Phase 4.

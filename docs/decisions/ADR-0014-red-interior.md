# ADR-0014 — The car is red, not black

**Date:** 2026-09-20 · **Status:** Accepted
**Supersedes in part:** [ADR-0007](ADR-0007-art-direction.md)

## Context

ADR-0007 specified a black interior and argued the case at some length: cheap
to render, never competing with the landscape, and turning into a mood
instrument for free as the light changed. At night the dial glow would be the
only interior light source, which it called "the most evocative image in the
game".

The art target supplied on 2026-09-20 (`docs/reference/art-target.png`) has a
**red** car. Red dash top, red door cards, red scuttle either side of the
bonnet, against a black instrument panel and a black wheel.

## Decision

The car is red. Specifically: **body-colour upper surfaces, black lower**.

| Surface | Colour |
|---|---|
| Dash top, scuttle, door cards, A-pillar trim | Body red |
| Instrument panel face, binnacle, wheel, console, stalks | Black |
| Dial faces | Black with white numerals |

## Why the reference wins

Because "it has to look good" is the brief and this is what good looks like to
the person who asked. ADR-0007's argument was sound about *cost* and wrong
about *composition*: it assumed the cabin's job was to stay out of the way.
In the target the cabin is a warm frame that the cool landscape sits inside,
and the red is doing structural work — it separates the interior from the
exterior far more decisively than a black silhouette would, and it makes the
windscreen read as an opening rather than as a crop.

The body-colour-above, black-below split is also simply what the real car did,
and it keeps most of ADR-0007's benefits: the instrument panel, the wheel and
the binnacle — the parts that occupy the middle of the frame — are still
black, still cheap, and still recede.

## What is kept from ADR-0007

- **The dial glow at night is still the goal.** A red cabin lit only by amber
  instruments is, if anything, better than a black one: there is something for
  the glow to fall on.
- **No badges, no marque, no model name**, anywhere. That constraint is not
  about colour and does not move.
- Flat-shaded, low-poly, lit and graded like a photograph.

## Consequences

- The red must be lit by the same `sunLight`/`ambient` the world uses, or the
  cabin will look pasted on. Since Phase 3 the whole palette comes from
  `world/gen/daylight.ts`; the cockpit reads the same values.
- Red is the most saturated thing in most frames, and ACES tonemapping pushes
  saturated reds toward orange. Phase 4 should check the cabin colour at noon
  and at night before settling it, not just at golden hour.
- The palette's `instrumentGlow` channel already exists for this.

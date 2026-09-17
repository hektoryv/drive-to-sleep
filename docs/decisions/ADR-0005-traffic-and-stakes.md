# ADR-0005 — Same-direction traffic, soft collisions, no fail state

**Date:** 2026-09-17 · **Status:** Accepted

## Context

The game needs enough to do that it isn't inert, without acquiring the
tension that would defeat its purpose. "Drive to sleep" sets the ceiling on
how demanding it's allowed to be.

## Decision

Traffic travels in the player's direction only, at 55–80% of cruising speed.
Collisions are soft: an impulse, a speed scrub, a camera jolt. No crash state,
no spin-out, no respawn, no game over. Scoring is distance, a recoverable
"flow" meter, and an overtake tally.

## Why

Same-direction traffic gives the steering something to do — a reason to place
the car, pick a line, commit to a pass — which is exactly the amount of
engagement wanted. Oncoming traffic would turn every overtake into a timed
hazard, which is a good driving game and the wrong one here.

Soft collisions preserve the no-fail rule while still making contact feel like
something. A jolt through the same attitude springs that produce the lean
means the impact is felt physically rather than announced by UI.

Everything in the scoring recovers. Nothing is ever permanently lost, so there
is never a reason to feel bad about the last thirty seconds.

## Consequences

- Traffic AI can be simple and must be *predictable*: hold a lane, wander
  slightly, drift wide in corners, never react to the player. Reactive AI would
  be a stress source.
- Density is capped and grows only slowly, so the road is never a queue.
- Because collisions are consequence-free, the player can lean on traffic
  rather than avoid it. Accepted — it's harmless, and the physical response
  discourages it well enough on its own.

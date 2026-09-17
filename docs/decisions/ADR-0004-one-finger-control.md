# ADR-0004 — Position-mapped one-finger control with a dynamic origin

**Date:** 2026-09-17 · **Status:** Accepted

## Context

The brief: one finger does everything. Left/right steers, up/down is gas and
brake. The on-screen steering wheel must turn with the finger. It has to work
one-handed, in the dark, half-asleep.

## Decision

A dynamic-origin virtual joystick. First touch sets the neutral point; offset
from that point is the input. **X offset maps directly to steering angle**
(position, not rate). Y offset is throttle up / brake down. The origin slowly
drifts toward a finger held near full deflection so travel never runs out.

## Why

Position mapping is what makes the on-screen wheel honest. With rate-based
steering ("hold right to keep turning further right"), the wheel and the finger
would immediately desynchronise and the wheel would become a decoration.
With position mapping, wheel angle is a pure function of finger offset — your
hand and the wheel are the same object. That correspondence is most of the
reason this scheme will feel good.

A dynamic origin rather than a fixed on-screen pad because nothing should be
anchored to a corner: it must work identically for either thumb, at any grip,
without looking at the screen.

## Consequences

- Origin drift is required, not optional — a fixed origin runs out of travel in
  a long corner.
- Lift-off must be gentle (recentre over ~0.3 s, coast, keep rolling), because
  putting the phone down is a normal thing to do in this game.
- A deadzone is required; a resting thumb is never perfectly still.
- Steering resolution is bounded by screen width. At a 22%-of-width radius
  that's roughly 240 px of travel per side on a typical phone — ample, but it's
  why the steering curve is non-linear (fine near centre, full lock available).

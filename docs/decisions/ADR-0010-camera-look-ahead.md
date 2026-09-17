# ADR-0010 — The view leads the car into corners

**Date:** 2026-09-17 · **Status:** Accepted

## Context

A cockpit camera rigidly bolted to the car's heading points wherever the nose
points. On a curving road that means the driver is always looking at the
outside of the corner they are entering, and the corner itself sits at the edge
of the frame or off it entirely. On a phone-sized portrait aperture, where
there is very little frame to spare, this is worse than on a monitor.

Real drivers don't do this. You look *through* a corner — your eyes go to where
the car is going, and your head follows, well before the car gets there.

## Decision

The camera carries a **look-ahead yaw**: it turns toward the road's heading at
a point some distance ahead of the car.

- **Look-ahead point:** `10 m + 0.75 s × speed`. A fixed part so the view still
  anticipates at low speed, plus a time-proportional part so a corner reads the
  same at 50 km/h as at 180.
- **Strength 0.45** — the view turns through 45% of the angle to the road
  ahead, not all of it.
- **Capped at 14°** of yaw.
- **Smoothed with an exponential approach at 4.5/s**, and stepped inside the
  fixed-rate simulation so it behaves identically on every device.

## Why partway and not fully

Turning the head all the way to the road ahead would pin the road to the centre
of the frame, and a corner where nothing moves in frame doesn't read as a corner
at all. The sense of turning comes from the road sweeping across the view; the
look-ahead exists to make sure it sweeps across a view that can still see where
it is going. 0.45 keeps both.

## Why an approach and not a spring

The attitude springs (roll, pitch, heave) are deliberately underdamped, because
the overshoot is what reads as the car having mass. A camera is the opposite
case: overshoot in the view — a head that swings past the corner and settles
back — reads as motion sickness. So the camera uses `approach()`, which is
monotonic by construction, and a test asserts it never overshoots.

## Alternatives rejected

- **Steering-linked yaw** — turn the view with the player's steering input.
  Much simpler, needs no road lookup. Rejected: it couples the view to input
  rather than to the world, so it twitches with every correction and swings the
  wrong way during a slide. It also does nothing on a corner you haven't
  started turning into yet, which is exactly when you need to see into it.
- **Velocity-aligned yaw** — follow the velocity vector rather than the
  heading. Correct-feeling during a slide, but it does nothing to anticipate,
  which is the actual problem. Worth revisiting in Phase 2 as a small *extra*
  term once the car can slide.
- **No look-ahead** — what Phase 0 shipped first. Compared directly in a
  screenshot sweep (`npm run shoot -- --compare`); the difference in how much
  of the corner is visible is large and obvious.

## Consequences

- **The yaw belongs to the head, not the car.** `ViewState` carries `lookYaw`
  separately from `heading`, and only the camera consumes it. This matters from
  Phase 4: cockpit geometry rides on `heading`, so turning into a corner swings
  the A-pillars and the dash across the view, exactly as it does when you look
  through a corner in a real car. Folding the offset into `heading` instead
  would rotate the whole cabin with the view and produce no effect at all.
- Requires the road's heading to be queryable at an arbitrary distance ahead.
  The world generator is a pure function of distance (ADR-0002), so this is
  free — but it is now a load-bearing reason for that property, not just a
  convenience.
- `render/camera.ts` deliberately imports no three.js, so the rig is unit
  tested as pure maths.
- **The final values cannot be judged from screenshots.** Look-ahead is a
  motion effect; a still shows only where the view ended up, not how it got
  there. The numbers here are defensible starting points, confirmed as far as
  a sequence of stills can confirm anything, and are expected to move during
  the Phase 2 tuning pass with a real device (ADR-0008).

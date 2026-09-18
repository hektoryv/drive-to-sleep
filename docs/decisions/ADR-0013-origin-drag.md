# ADR-0013 — The touch origin is dragged, never drifted

**Date:** 2026-09-18 · **Status:** Accepted
**Refines:** [ADR-0004](ADR-0004-one-finger-control.md)

## Context

ADR-0004 chose a dynamic-origin virtual joystick and identified a real problem
with it: hold a long corner and your thumb walks toward the edge of the screen
and runs out of room. Its answer was **origin drift** — "when the finger is
held near full deflection, the origin slowly creeps toward the finger. You
never run out of travel, and because the drift is slow it's invisible during
normal driving."

Implemented and tested, that mechanism turned out to be actively wrong.

The origin creeping *toward* the finger reduces the distance between them, and
that distance **is** the input. So holding a steady corner makes the car
straighten itself out. A test that held full lock for thirty seconds measured
the steering decaying from 1.0 to 0.52 with the thumb completely still. The
same bug made full throttle read as 0.988 rather than 1.

It was invisible in the shorter tests and would have been very hard to
diagnose from the driver's seat: the car would simply have felt like it
"washed out" of long corners, which is a thing cars do, so the instinct would
have been to go looking in the tyre model.

## Decision

The origin is **dragged along behind the finger and never moves on its own**.

```
if |finger - origin| > radius:
    origin = finger - sign(finger - origin) * radius
```

That is the whole mechanism. It gives exactly what ADR-0004 wanted:

- **You can never run out of travel.** Push past full deflection and the origin
  comes with you, so the edge of the screen is not a limit.
- **Deflection is exactly proportional to finger offset** within one radius, so
  position mapping still holds and the wheel is still a pure function of the
  thumb — which was the whole point of ADR-0004.
- **Holding still changes nothing**, however long you hold it.

Returning to neutral costs one radius of travel from wherever you ended up.
That is correct, and it is what a wheel does.

## Alternatives considered

- **Creep toward the finger** — ADR-0004's version. Rejected: it un-steers the
  car, as above.
- **Creep toward the screen centre** while the finger is near an edge. This
  does solve the reach problem and it does not un-steer *as* directly, but it
  still moves the origin without the player asking, so it still changes the
  car's line while the thumb is still. Rejected for the same underlying reason.
- **A fixed on-screen pad.** Solves everything except the requirement that
  nothing be anchored to a corner (ADR-0004), which is what makes the scheme
  work for either thumb at any grip without looking.

## Consequences

- One mechanism instead of two, and one fewer tuning constant —
  `ORIGIN_DRIFT_RATE` is gone.
- `driftOrigin` keeps its name, which is now slightly wrong. Left alone on the
  grounds that renaming it across the tests would obscure the history this ADR
  exists to record.
- The lesson generalises: a control scheme that quietly changes its own output
  while the input is constant will be diagnosed as a physics problem. Anything
  that moves on its own between the finger and the car needs a test that holds
  the finger still for a long time.

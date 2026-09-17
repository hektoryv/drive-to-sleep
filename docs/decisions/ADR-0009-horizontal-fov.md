# ADR-0009 — Field of view specified horizontally; aperture proportions corrected

**Date:** 2026-09-17 · **Status:** Accepted
**Supersedes in part:** [ADR-0006](ADR-0006-portrait-and-world.md)

## Context

ADR-0006 committed to a portrait cockpit with a "wide letterbox aperture
(~2.4:1) occupying the middle ~46% of the display" and a "vertical FOV ~38°".
Phase 0 built the framing and rendered it. Two problems surfaced immediately.

**The aperture spec was arithmetically impossible.** On a 9:19.5 phone, a band
spanning the full width at 46% of the height is about 1:1, not 2.4:1. To
actually get 2.4:1 the band would have to be ~19% of the height — a strip so
short that the landscape, which pillar #2 calls the reward, would occupy less
than a fifth of the display. The two figures were never compatible; nobody
noticed because nothing had been drawn yet.

**Specifying FOV vertically ties it to the aperture's proportions.** Every
time the aperture is retuned — and it will be retuned, repeatedly, once real
cockpit geometry exists in Phase 4 — a vertical FOV silently changes how wide
the view is, which changes how far you can see into a corner, which changes
how the car drives. A framing tweak would quietly become a handling change.

## Decision

1. **Field of view is authored horizontally.** `VIEW.H_FOV = 52°`. Vertical
   FOV is derived from it and the aperture's aspect ratio.
2. **Aperture proportions corrected** to header 5% / aperture 38% / dash 22% /
   wheel 35%. The aperture lands at about 1.2:1 on a typical phone — wider
   than tall, but not the letterbox strip ADR-0006 described.

On a 412×915 screen this gives a vertical FOV of about 45°: narrower than a
default 60°, so the compression and horizon stability ADR-0006 wanted are
preserved, just not at the figure it named.

## Why horizontal

How much of the world you can see across is a *handling* property, not a
framing one. Holding it fixed means the aperture can be tuned freely on visual
grounds without anyone having to re-tune the car afterwards. It also makes the
constant mean something a person can reason about: 52° is a normal lens, and
that is a judgement about how the road should read, not an artefact of how tall
the windscreen happens to be this week.

The rejected alternative — keep authoring vertically and recompute the
horizontal figure by hand whenever the bands move — is the same arithmetic done
less reliably, by a person, every time.

## Consequences

- `computeFraming()` derives `vFov` from `H_FOV` and the aperture aspect, and
  a test asserts horizontal FOV is invariant across five phone aspect ratios.
- Phase 4 can retune the band fractions on pure visual grounds.
- 52° is itself a starting value and expected to move during Phase 4. Wider
  gives more speed sensation and more distortion; narrower is calmer and more
  compressed but makes corners harder to read.

## What this says about the process

The plan specified numbers for something nobody had looked at yet, and two of
them contradicted each other. That is exactly the failure the screenshot
harness exists to catch (ADR-0008), and it caught it on the first render. The
lesson worth keeping: framing figures in the design docs are hypotheses until
something has been photographed.

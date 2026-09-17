# ADR-0008 — Screenshot-first development loop

**Date:** 2026-09-17 · **Status:** Accepted

## Context

The build environment has Node, Chromium and Playwright but no Android SDK.
The developer's stated preference is to review by screenshot rather than
running builds during development.

## Decision

The primary review artifact during development is a **screenshot contact
sheet** produced by `npm run shoot`, run headlessly in the container. The
harness can drive a given seed to a given distance, force time of day and
biome blend, replay recorded input sequences, and emit many shots in one run.
APK builds are a milestone activity (Phase 6), not a per-change one.

## Why

It's the fastest loop available for the visual work, which is the bulk of
Phases 1, 3 and 4, and it costs the developer nothing per iteration. Combined
with the determinism from ADR-0002, a seed plus a distance fully specifies a
frame, which makes shots reproducible and comparable across changes.

## The known limitation — recorded because it matters

**Screenshots cannot judge motion.** Feel, lean, input latency, camera
movement and the sense of speed are all invisible in a still. This is not a
small gap: it covers the single most important phase in the project.

Therefore:

- **Phase 2's exit criterion explicitly requires a real build on a real
  phone.** It cannot be signed off from screenshots, and the roadmap says so.
- Where motion needs reviewing before then, the harness emits short captures
  (Playwright + ffmpeg, both available) rather than stills.
- WebView touch latency (ADR-0001's main risk) is invisible to this loop
  entirely and must be tested on-device early in Phase 6.

## Consequences

- The screenshot harness is a Phase 0 deliverable, not a nice-to-have — it's
  the only way the game gets seen.
- Visual regressions are reviewed by eye on a contact sheet rather than by
  pixel diff; a continuously-varying procedural scene makes pixel comparison
  too brittle to be useful.
- If the screenshot loop proves insufficient in practice, the fallback is the
  auto-deploy-to-a-URL option that was considered and set aside here: push
  builds to a static host and open them on the phone. Nothing in this decision
  precludes adding that later.

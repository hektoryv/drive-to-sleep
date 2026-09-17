# ADR-0001 — TypeScript + three.js, wrapped with Capacitor

**Date:** 2026-09-17 · **Status:** Accepted

## Context

An Android driving game that has to look good and feel good, built
collaboratively between a human and an agent working in an ephemeral Linux
container with **no Android SDK**, but with Node, Chromium and Playwright.

## Decision

Build the game as a TypeScript + three.js (WebGL2) application, bundled with
Vite, and ship it as a native Android app via Capacitor.

## Why

The decisive factor is the feedback loop. In this container the game can be
*run and looked at* — headless Chromium renders WebGL, Playwright drives it,
screenshots come out. For a project whose success criteria are "looks good"
and "feels good", being able to see the thing on every change is worth more
than any amount of raw performance headroom.

Secondary reasons: three.js is mature and well-understood; the whole codebase
is plain readable text that reviews well in a structured, documented workflow;
and Capacitor produces a genuine APK with no runtime network dependency.

## Alternatives rejected

- **Native Kotlin + OpenGL ES.** Best performance and the "proper" Android
  path. Rejected because nothing could be run or seen in this environment —
  every visual iteration would round-trip through a human build, which would
  make the look-and-feel work, i.e. the actual project, unworkably slow.
- **Godot 4.** A real engine with good Android export. Rejected: not installed,
  heavy to add, scene files review poorly in a docs-driven workflow, and it
  still couldn't be seen here.
- **Unity.** Rejected as vastly oversized and licence-encumbered for a
  single-road driving game.

## Consequences

- A WebView sits between the game and the GPU. At our budget (< 120 draw calls,
  < 150k triangles) 60 fps is comfortably achievable, but we are not free to
  be careless.
- **Touch input latency through a WebView is the main risk to the entire
  project**, because the control scheme is the game. This is tested early in
  Phase 6, not at the end. Mitigations: pointer-event prediction, minimal input
  pipeline. If it can't be made good enough, this ADR gets revisited — which is
  the scenario the sim/render separation in ADR-0002 exists to make survivable.
- Capacitor is added in Phase 6, deliberately late, so it can't slow the phases
  that matter.

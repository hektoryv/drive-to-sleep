# ADR-0003 — Hybrid: 3D road and near world, 2.5D distant scenery

**Date:** 2026-09-17 · **Status:** Accepted

## Context

The world needs to look dense and deep — mountains, forests, long views — on a
mid-range phone, inside a WebView, at 60 fps.

## Decision

- **Real 3D:** the road surface and verges, near terrain, the car interior,
  traffic, and props within ~120 m.
- **Billboards and impostors:** mid- and far-distance vegetation and rocks;
  all distant mountains as 3–4 layered parallax silhouette cards.

## Why

The camera in this game is unusually constrained: it sits at a fixed height,
on the road, always looking forward, never behind. That's precisely the
condition under which billboard parallax error becomes unobservable. We get a
forest for the cost of a few hundred instanced quads.

Meanwhile the things the player looks *at* closely — the road under the wheels,
the corner they're placing the car in, the dashboard — stay genuinely 3D, so
hills, crests and banking are real geometry and the car interacts with real
surfaces.

## Alternatives rejected

- **Fully 3D world.** More work, more triangles, no visible benefit past
  ~150 m where fog and the letterbox aperture are doing the work anyway.
- **Fully pseudo-3D (OutRun-style segment projection).** Very cheap, but the
  result is inherently a 1988 aesthetic and can't deliver the real crests and
  banked corners the handling model wants.

## Consequences

- The near-3D-to-billboard transition is the visual seam to manage. Handled
  with a cross-fade band, and by keeping near-tree geometry flat-ish so the
  swap isn't a silhouette change.
- Impostor mountain layers must be regenerated as biomes blend. Budget for it.
- If the camera ever needs to leave the road (a photo mode, a chase cam), this
  decision breaks down. That's an accepted constraint — see the non-goals.

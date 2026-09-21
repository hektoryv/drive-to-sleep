# ADR-0021 — Biomes are deterministic distance cells blended as shared weights

**Date:** 2026-09-21 · **Status:** Accepted

## Context

Phase 3 needs the road to drift through recognisably different places without
loading levels or exposing a biome boundary. Terrain colour, road verge and
shoulder, vegetation density, plant shape and near props must agree about the
region at every distance. Choosing independently in each renderer produces a
collage; choosing from world coordinates makes the result depend on the road's
meandering position and is difficult to reproduce in tests.

## Decision

**Biome is a pure deterministic function of seed and distance along the road.**

- The world is divided into 5.6 km cells selected from mountain, desert and
  country by a seed hash.
- The first 1.4 km of a cell blends from the previous cell with smooth weights.
- Road, terrain and vegetation store the same three weights per generated
  vertex. Prop kind is selected from a biome-weighted deterministic roll.
- Palettes and population multipliers live in `world/tuning.ts`; the generator
  contains no three.js or rendering code.

## Consequences

- Every surface changes region together and transitions remain invisible.
- A seed and road distance reproduce the same biome exactly in Node tests, the
  screenshot harness and the Android build.
- Adding a fourth biome changes the shared weight shape and every shader, so
  biome count is deliberately a small authored set rather than open-ended data.

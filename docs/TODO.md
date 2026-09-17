# TODO

The live task list. Moves in the same commit as the work.
Phase definitions and exit criteria live in [04-roadmap.md](04-roadmap.md).

---

## Now — Phase 1: The road

- [ ] Curvature / grade / width fields over `s`
- [ ] Station sampling; `(s,t) ↔ world` conversions in one place
- [ ] Chunk ring buffer with in-place recycling, zero steady-state allocation
- [ ] Road mesh sweep: surface, shoulder, verge, centre and edge lines
- [ ] Banking from curvature
- [ ] Event injection: hairpin, sweeper, crest, straight-with-a-view
- [ ] Terrain ribbons
- [ ] Free-fly debug camera, station/curvature visualisation
- [ ] Tests: determinism, chunk recycling, no-allocation
- [ ] Delete `src/render/placeholder-scene.ts` once the real world replaces it

## Next — Phase 2: The drive

Pulled in when Phase 1 exits. See the [roadmap](04-roadmap.md).

## Later

Phases 2–7, listed in the [roadmap](04-roadmap.md). Pulled into **Next** as
each phase opens rather than duplicated here.

## Open questions

Things to resolve before the phase that needs them:

- **Rear-view mirror** (Phase 4): true render-to-texture, or a faked gradient
  with moving road lines? RTT costs a second scene pass; the fake may be
  indistinguishable in a mirror that's ~80 px tall. Decide by trying the fake
  first.
- **Prop textures** (Phase 3): procedurally generated to canvas at startup, or
  authored atlases shipped in the bundle? Procedural keeps the repo free of
  binaries and is easy to re-tune per biome; authored looks better. Start
  procedural, switch if it looks cheap.
- **Traffic silhouettes** (Phase 5): hand-written geometry, or a tiny
  parametric generator (length, roof profile, glass line)? Parametric gives
  variety for free; hand-written looks intentional.
- **Resume-point semantics** (Phase 5): resume at the exact distance, or at the
  start of the current biome? Exact is more continuous; biome-start avoids
  dropping you mid-hairpin on a cold open.
- **Aperture height** (Phase 4): 38% reads well against a placeholder, but the
  cabin is 57% of the display and currently empty black. Re-judge once there is
  real dash and wheel geometry to fill it — the band may want to grow or shrink
  a few points. Framing can now be retuned freely without touching handling
  (ADR-0009).
- **Startup sub-step drops** (Phase 6): the loop reports a handful of dropped
  frames during page load and warp, when deltas are long. Harmless now; worth
  confirming it doesn't happen mid-drive on a real device.

## Done

<details>
<summary>Phase 0 — Foundation (2026-09-17)</summary>

- [x] `package.json`, Vite, TypeScript strict, `tsconfig`
- [x] ESLint + the `sim ↛ render` layering rule, enforced
- [x] Vitest wired up — 49 tests passing
- [x] `index.html`, canvas, portrait framing scaffold, resize handling
- [x] `core/loop.ts` — fixed 120 Hz accumulator, interpolation, sub-step cap,
      deterministic `advance()`
- [x] `core/math.ts` — spring-damper, easing, allocation-free vectors
- [x] `core/rng.ts` — seeded streams, value/gradient/ridged noise, fbm
- [x] `core/events.ts`, `core/storage.ts`
- [x] `render/framing.ts`, `render/renderer.ts`, `render/debug.ts`
- [x] `sim/tuning.ts` — the single home for feel and look constants
- [x] `tools/shoot.ts` — single shots and contact sheets
- [x] `tools/perf.ts` — frame-time percentiles
- [x] ADR-0009 after the framing figures turned out to be wrong

</details>

<details>
<summary>Planning (2026-09-17)</summary>

- [x] Lock the eight foundational decisions
- [x] Vision, design, art direction, architecture, roadmap, conventions docs
- [x] ADRs 0001–0008
- [x] Repo documentation structure

</details>

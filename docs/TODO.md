# TODO

The live task list. Moves in the same commit as the work.
Phase definitions and exit criteria live in [04-roadmap.md](04-roadmap.md).

---

## Now — Phase 0: Foundation

- [ ] `package.json`, Vite, TypeScript strict, `tsconfig`
- [ ] ESLint + the `sim ↛ render` layering rule
- [ ] Vitest wired up, one passing test
- [ ] `index.html`, canvas, portrait framing scaffold, resize handling
- [ ] `core/loop.ts` — fixed 120 Hz accumulator + render interpolation alpha
- [ ] `core/math.ts` — vec2/vec3, spring-damper, easing, clamp, lerp
- [ ] `core/rng.ts` — seeded PRNG, value noise, gradient noise, fbm
- [ ] `core/events.ts`, `core/storage.ts`
- [ ] `render/debug.ts` — fps / frame time / sim time / watch values overlay
- [ ] `tools/shoot.ts` — Playwright screenshot harness (seed, distance, time,
      output dir, contact sheet mode)
- [ ] `npm run perf` skeleton

## Next — Phase 1: The road

- [ ] Curvature / grade / width fields over `s`
- [ ] Station sampling; `(s,t) ↔ world` conversions in one place
- [ ] Chunk ring buffer with in-place recycling, zero steady-state allocation
- [ ] Road mesh sweep: surface, shoulder, verge, centre and edge lines
- [ ] Banking from curvature
- [ ] Event injection: hairpin, sweeper, crest, straight-with-a-view
- [ ] Terrain ribbons
- [ ] Free-fly debug camera, station/curvature visualisation
- [ ] Tests: determinism, chunk recycling, no-allocation

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

## Done

Nothing yet — Phase 0 implementation hasn't started.

<details>
<summary>Planning (2026-09-17)</summary>

- [x] Lock the eight foundational decisions
- [x] Vision, design, art direction, architecture, roadmap, conventions docs
- [x] ADRs 0001–0008
- [x] Repo documentation structure

</details>

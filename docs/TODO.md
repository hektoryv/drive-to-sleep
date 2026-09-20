# TODO

The live task list. Moves in the same commit as the work.
Phase definitions and exit criteria live in [04-roadmap.md](04-roadmap.md).

---

## Now — blocked on you

Phase 2 is code complete and cannot be signed off from here. Everything below
needs hands on a real build.

- [ ] **Drive it.** Does it feel good? Corners you can place the car in, a lean
      you can feel, a throttle you want to hold open.
- [ ] Turn-in weight — `CAR.YAW_RESPONSE`, currently 7.5. Lower is more
      languid; too low and it steers from the back seat.
- [ ] Steering at speed — `CAR.STEER_FALLOFF_MIN`, currently 0.2. Higher is
      more alive and twitchier.
- [ ] Lean — `ATTITUDE.ROLL_MAX` (4.5°) and `ROLL_ZETA` (0.7). The question is
      whether it reads as weight or as seasickness *in motion*.
- [ ] Control radii — `input/tuning.ts`. Do they suit your thumb?

## Next — Phase 3: The view *(in progress)*

Measured against `docs/reference/art-target.png`. Ordered by how much each
would close the gap.

- [x] Time-of-day cycle driving sun position and every palette
- [x] Sky: four-stop gradient, sun disc, halo, horizon wash, clouds, stars
- [x] Distant mountain layers with aerial perspective and real parallax
- [ ] Vegetation billboards — the dark shrub clusters the target is full of
- [ ] Roadside furniture: guardrail, chevron signs, telegraph poles
- [ ] Harder cloud edges; mine are softer than the target's cut-paper slabs
- [ ] Double yellow centre lines rather than a single white one
- [ ] Biome parameter sets and distance-driven blending
- [ ] Height fog on top of the distance fog
- [ ] Colour grading, bloom, vignette, animated dither grain
- [ ] The moon as a night key light
- [ ] Quality tiers

## Later

- [ ] **Terrain / biome palettes.** The terrain is hardcoded olive green and
      clashes with every warm sky. Deferred on the owner's call (2026-09-20):
      colour grading is an end-production job, not something to chase while the
      structure is still being built. Everything it needs already exists — it
      reads `world/gen/daylight.ts` like the sky and ridges do.


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
- **Aperture height and FOV** (Phase 4 / Phase 2): now 46% and 72°. Both were
  chosen from stills against a placeholder. Re-judge the aperture once there is
  real dash and wheel geometry to fill the cabin, and the FOV on a real device
  at speed — neither is a thing a screenshot can settle.
- **Look-ahead strength** (Phase 2): 0.45, capped at 14°. Chosen from a
  sequence of stills through one corner, which shows where the view ends up but
  not how it gets there. Needs hands on a device.
- **Cloud shape control** (Phase 3): cover, softness and the two decks' scales
  are tuned by eye against one reference. Worth a sweep sheet of its own.
- **A car body for the chase camera** (Phase 4): the chase view shows the road
  and the line, but with no geometry there is nothing to watch lean. It belongs
  to `cockpit/`; building a throwaway box now is not worth a domain.
- **Velocity-aligned camera term** (Phase 3+): the car can slide now, so the
  extra term ADR-0010 set aside is finally testable.
- **Autopilot as attract mode** (Phase 5): it drives well enough to sit behind
  a start screen, if the start screen wants a moving background.
- **Curvature shaping** (Phase 2): `CURVATURE_SHAPE` is 0.62, chosen to fix a
  road that measured 57% straight. The distribution is a proxy for "a road you
  want to drive" — re-judge once there is a car to drive it with.
- **Terrain ribbon edge** (Phase 3): the ribbon is 260 m wide, so on open
  ground its lateral edge shows against the sky. The fix is the impostor
  mountain layers, not a wider ribbon.
- **Rebuild spike** (Phase 6): the meshes rewrite ~230 k vertex components on a
  chunk boundary, about every 17 seconds. Invisible under software
  rasterisation; confirm it is invisible on a device too, and split into
  per-chunk meshes only if it is not.
- **Velocity-aligned camera term** (Phase 2): once the car can slide, consider
  adding a small term that follows the velocity vector as well as the road
  ahead. Rejected for now as not solving the anticipation problem (ADR-0010),
  but it is the right fix for how a slide reads.
- **Near-road dominance** (Phase 4): at 72° with the taller aperture, the road
  immediately in front fills the bottom of the windscreen. In a real 911 you
  would be looking at the bonnet there. Expected to resolve itself when the
  bonnet and scuttle exist — do not "fix" it by narrowing the FOV first.
- **Distant road aliasing** (Phase 1): the placeholder road band speckles at
  the vanishing point where it is thinner than a pixel. Real swept geometry
  with proper mip-mapping should handle it; worth confirming it does.
- **Startup sub-step drops** (Phase 6): the loop reports a handful of dropped
  frames during page load and warp, when deltas are long. Harmless now; worth
  confirming it doesn't happen mid-drive on a real device.

## Done

<details>
<summary>Phase 2 — The drive (2026-09-18, pending device sign-off)</summary>

- [x] `sim/vehicle.ts` — speed, yaw, grip clamp, slide, per-surface handling
- [x] `sim/attitude.ts` — roll, pitch, heave springs, distance-spaced rumble
- [x] `sim/drive.ts` — the car-on-road glue the tests share with the game
- [x] `sim/autopilot.ts` — a pursuit controller, so the harness can drive
- [x] `input/controls.ts` (pure) and `input/pointer.ts` (DOM)
- [x] Replaced the Phase 1 placeholder cruise
- [x] Off-road grip loss, drag and rumble
- [x] Debug chase camera and `npm run telemetry`
- [x] `--handling` contact sheet: the car caught mid-corner at the grip limit
- [x] 80 tests, including 20 km of real road under autopilot
- [x] ADR-0013 after the touch origin turned out to un-steer the car

</details>

<details>
<summary>Phase 1 — The road, and the modular restructure (2026-09-17)</summary>

- [x] Sealed domains, `contracts/` layer, module lifecycle, service registry
- [x] Per-domain tuning files
- [x] Domain boundaries enforced by ESLint, violations verified to fail
- [x] `world/gen/` — fields, events, stations, terrain, road query
- [x] `world/view/` — road mesh, terrain mesh, sky, analytic road markings
- [x] Ring buffer with in-place recycling and a floating origin
- [x] Curvature shaping, after measuring the road at 57% straight
- [x] `sceneReport()` in the test API — diagnose a bad frame from numbers
- [x] ADR-0011 (modules) and ADR-0012 (integration vs random access)
- [x] Deleted the Phase 0 placeholders

</details>

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

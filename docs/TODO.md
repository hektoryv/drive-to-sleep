# TODO

The live task list. Moves in the same commit as the work.
Phase definitions and exit criteria live in [04-roadmap.md](04-roadmap.md).

---

## Now

Phase 2 is signed off — driven on a device 2026-09-20, and it feels good. What
is left of it is **calibration**, deferred by the owner and parked below.

The build: **`github.com/hektoryv/drive-to-sleep/releases/download/dev/drive-to-sleep-dev.apk`**,
rebuilt on every push (ADR-0015). Three fingers toggles the debug readout.

- [ ] **Listen to it.** The engine note has never been heard by anybody. It is
      the one thing in the sound that is likely to be wrong, and the fix is
      `audio/tuning.ts` — most probably `ENGINE.CUTOFF_MAX_HZ` (brightness) and
      `ENGINE.LOAD_WEIGHT` (how much the level follows the throttle rather than
      the revs).
- [ ] Mix balance — `MASTER.GAIN`, then the three `GAIN_MAX`/`GAIN_LOAD`
      values against each other. Phone speaker first, then headphones.

## Next — Phase 5: Life on the road

Phase 3 is complete. The world now has biome drift, regional prop tables,
guardrail, near-field geometry, height haze, a moon/night key and the final
grade. The next phase supplies the moving stakes and the session around them.

- [ ] Deterministic traffic spawn/despawn from seed and distance
- [ ] Traffic lane-following, wander and corner behaviour
- [ ] Four or five period vehicle silhouettes
- [ ] Capsule collision, impulse and speed scrub
- [ ] Scoring: distance, flow and overtakes
- [x] Always-visible numeric speedometer, pulled forward at the owner's request
- [ ] HUD remainder, start/pause panels and drive summary
- [ ] Persistence: best distance, settings and resume point

## Parked — Phase 4: The cockpit

The downloaded full-car GLB and both sprite approaches failed on a real device.
ADR-0020 restores the earlier procedural 3D cabin so the game remains drivable,
with working instruments, while final interior production is postponed.

- [x] Second cockpit render pass and daylight integration
- [x] Procedural 3D dash, cowl, pillars, door cards and rotating wheel
- [x] Five-dial cluster with live tachometer and speedometer needles
- [x] Dial backlighting driven by `daylight.instrumentGlow`
- [ ] Replace the placeholder with a purpose-built, separable interior model
- [ ] Rear-view mirror and final material/detail pass after that model exists

## Later

- [ ] **Sound: the rest of Phase 8.** Surface transitions as moments rather
      than crossfades, rumble strips and impacts from the events `sim/` already
      emits, and a mute control once there is a HUD to put it in.
- [ ] **Back button.** Currently Capacitor's default: one press exits the app.
      Wants to be a pause, or at least a confirm — an endless calm game that
      quits on a stray swipe is an irritating one.
- [ ] **Legacy launcher icon.** The adaptive icon (API 26+) is ours; the
      `mipmap-*/ic_launcher.png` fallbacks for API 23–25 are still Capacitor's.
      Needs rasterising, which needs a tool the container doesn't have.
- [ ] **Release signing.** The `dev` APK is debug-signed. Phase 6's exit
      criterion needs a keystore in repository secrets and a release job.


Phases 2–7, listed in the [roadmap](04-roadmap.md). Pulled into **Next** as
each phase opens rather than duplicated here.

## Open questions

Things to resolve before the phase that needs them:

- **Rear-view mirror** (postponed Phase 4): true render-to-texture, or a faked gradient
  with moving road lines? RTT costs a second scene pass; the fake may be
  indistinguishable in a mirror that's ~80 px tall. Decide by trying the fake
  first.
- **Traffic silhouettes** (Phase 5): hand-written geometry, or a tiny
  parametric generator (length, roof profile, glass line)? Parametric gives
  variety for free; hand-written looks intentional.
- **Resume-point semantics** (Phase 5): resume at the exact distance, or at the
  start of the current biome? Exact is more continuous; biome-start avoids
  dropping you mid-hairpin on a cold open.
- **Aperture height and FOV** (Phase 4 / Phase 2): now 61% and 72°. The
  aperture was re-framed against the cabin and target; judge the FOV on a
  real device at speed, because a screenshot cannot settle it.
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
- **Near-road dominance** (Phase 4): at 72° with the taller aperture, the road
  immediately in front fills the bottom of the windscreen. In a real 911 you
  would be looking at the bonnet there. The scuttle now hides the pass seam;
  judge the remaining dominance at speed before narrowing the FOV.
- **Distant road aliasing** (Phase 1): the placeholder road band speckles at
  the vanishing point where it is thinner than a pixel. Real swept geometry
  with proper mip-mapping should handle it; worth confirming it does.
- **Startup sub-step drops** (Phase 6): the loop reports a handful of dropped
  frames during page load and warp, when deltas are long. Harmless now; worth
  confirming it doesn't happen mid-drive on a real device.

## Done

<details>
<summary>Phase 3 — The view (2026-09-21)</summary>

- [x] Moon disc and cool night key light
- [x] Height-aware haze layered over distance fog
- [x] Guardrail on sustained terrain drops, with noisy placement smoothed into runs
- [x] Faceted near-field stones fading into the billboard distance band
- [x] Deterministic mountain, desert and country regions with 1.4 km blends
- [x] Biome-specific terrain, shoulder, verge and vegetation palettes/prop weights
- [x] Harder cut-paper cloud edges
- [x] Full-frame grade: restrained bloom, vignette, contrast, saturation and grain
- [x] Low, balanced and high GPU quality tiers
- [x] 20-scene review sheet across four seeds, five distances and the full day
- [x] Asymmetric 3D landscape cells: lake shelves, rock walls, valleys and desert canyons
- [x] Biome-specific distant silhouettes and a named 14% maximum road grade

</details>

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

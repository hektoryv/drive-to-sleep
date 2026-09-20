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

## Next — Phase 4: The cockpit *(in progress)*

The full-car GLB failed on-device: fragmented scanned materials, incorrect
occlusion and a style that fought the world. ADR-0018 replaces it with a
brand-free layered sprite cockpit built directly for the portrait frame.

- [x] Separate exterior, interior, lighting and steering-wheel atlas layers
- [x] Screen-stable 2.5D composition with restrained look-ahead parallax
- [x] Independent wheel sprite driven by interpolated steering
- [x] Painted five-dial cluster. The atlas needles are currently static;
      `CarView` still carries `rpm`, `maxRpm` and `speedMs` for the future
      authored or overlaid live needles.
- [x] The `daylight` contract — the cabin is lit by the same sun as the road
- [x] Painted warm/cool shadow layer rising with `daylight.instrumentGlow`
- [x] Painted rear-view mirror placeholder
- [ ] Add separate tach and speed needles so the gauges are live again

## Later — Phase 3: The view *(paused)*

Measured against `docs/reference/art-target.png`. Ordered by how much each
would close the gap.

- [x] Time-of-day cycle driving sun position and every palette
- [x] Sky: four-stop gradient, sun disc, halo, horizon wash, clouds, stars
- [x] Distant mountain layers with aerial perspective and real parallax
- [x] Vegetation billboards — the dark shrub clusters the target is full of
- [x] Telegraph poles and wires — the near-field speed cue
- [x] Chevron signs on tight corners — the game's only advance warning, given
      as scenery rather than as interface
- [ ] Guardrail where the ground falls away
- [ ] Harder cloud edges; mine are softer than the target's cut-paper slabs
- [x] Solid double-yellow centre lines with white edge markings
- [ ] Biome parameter sets and distance-driven blending
- [ ] Height fog on top of the distance fog
- [ ] Colour grading, bloom, vignette, animated dither grain
- [ ] The moon as a night key light
- [ ] Quality tiers

## Later

- [ ] **Calibrate the car.** Acceleration, top speed, cornering g and braking
      are placeholder numbers that have never been measured against anything.
      Deferred on the owner's call (2026-09-20): *"as long as you keep stuff
      properly modular, we can just fix that later."* All of it lives in
      `sim/tuning.ts` — `PEAK_ACCEL`, `TOP_SPEED_MS`, `DRAG`, `THRUST_FALLOFF`,
      `LATERAL_GRIP_SCALE`, `BRAKE_G` — and `npm run telemetry` prints what the
      car actually does, so this is a measure-then-set job rather than a search.
      Worth doing against real figures for the car being evoked: ~5.5 s to
      100 km/h, ~245 km/h, ~0.85 g.
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
- [ ] **Terrain / biome palettes.** The olive placeholder is now warm earth,
      matching the reference at golden hour, but it is still one static
      palette. Per-time and per-biome terrain colour remains an end-production
      grading job driven from `world/gen/daylight.ts`.


Phases 2–7, listed in the [roadmap](04-roadmap.md). Pulled into **Next** as
each phase opens rather than duplicated here.

## Open questions

Things to resolve before the phase that needs them:

- **Rear-view mirror** (Phase 4): the atlas has a correctly placed painted
  placeholder. For its eventual moving reflection, use render-to-texture or a
  faked gradient
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
- **Aperture height and FOV** (Phase 4 / Phase 2): now 61% and 72°. The
  aperture was re-framed against the real cabin and target; judge the FOV on a
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

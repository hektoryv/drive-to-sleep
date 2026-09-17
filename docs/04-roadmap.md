# 04 — Roadmap

*Last updated: 2026-09-17*

Eight phases. Each has a **goal**, a **task list**, and an **exit criterion**
that must be demonstrable before the next phase starts. Progress is logged in
[PROGRESS.md](PROGRESS.md); the live task list is [TODO.md](TODO.md).

The ordering is deliberate: **the car must feel right before the world looks
right, and the world must look right before we sit you in the cockpit.** It is
much easier to judge handling against a grey road than to untangle whether a
beautiful scene is driving badly.

---

## Phase 0 — Foundation *(current)*

**Goal:** a repo that builds, runs, and can be looked at.

- [x] Decisions locked and written as ADRs
- [x] Documentation structure
- [ ] Vite + TypeScript + strict config, ESLint with the `sim ↛ render` rule
- [ ] Vitest wired up
- [ ] Canvas, resize handling, portrait framing scaffold
- [ ] Fixed-step loop with interpolation (`core/loop.ts`)
- [ ] Seeded RNG + noise (`core/rng.ts`)
- [ ] Debug overlay: fps, frame time, sim time, arbitrary watch values
- [ ] Screenshot harness (`tools/shoot.ts`) — Playwright, drives a seed to a
      given distance, writes a PNG. This is how you see the game.

**Exit:** `npm run shoot -- --seed 1 --at 500` produces a PNG of *something*,
and the debug overlay shows a stable 60 fps.

---

## Phase 1 — The road

**Goal:** an endless, believable road you can fly along.

- [ ] Curvature / grade / width fields over `s`
- [ ] Station sampling and the `(s,t) ↔ world` conversions
- [ ] Chunk ring buffer with in-place recycling
- [ ] Road mesh sweep: surface, shoulder, verge, centre line, edge lines
- [ ] Banking derived from curvature
- [ ] Event injection: hairpin, sweeper, crest, straight-with-a-view
- [ ] Terrain ribbons either side
- [ ] Free-fly debug camera + station/curvature visualisation
- [ ] Determinism test, chunk-recycling test

**Exit:** fly 20 km along the road on one seed with no seams, no hitches, no
allocations after the first second, and screenshots that show a road you'd
actually want to drive.

**Watch out for:** curvature noise that produces a road with no rhythm — all
medium corners, no straights, no drama. If that happens, it's the event system
that needs work, not the noise.

---

## Phase 2 — The drive

**Goal:** the car feels good. This is the most important phase in the project.

- [ ] Vehicle model: speed, yaw, grip, slide, surfaces
- [ ] Attitude springs: roll, pitch, heave
- [ ] Pointer handling + dynamic origin + drift + release recentre
- [ ] Control curves and the steering speed-falloff
- [ ] Driver-eye camera consuming attitude (no cockpit geometry yet —
      just the eye point, so the lean is unmistakable)
- [ ] Off-road: grip loss, drag, rumble
- [ ] Handling regression tests
- [ ] **Tuning pass.** Budget real time here. Expect to go round several times.

**Exit:** you drive it on your phone and it feels good. Not "works" — *good*.
Corners you can place the car in, a lean you can feel, a throttle you want to
hold open. If it doesn't feel right, we do not proceed; everything after this
is decoration on top of this.

**Watch out for:** roll that looks right in a screenshot but reads as seasick
in motion. Screenshots cannot judge this phase — this is the one place where a
build on your actual phone is genuinely required.

---

## Phase 3 — The view

**Goal:** it looks good.

- [ ] Sky: gradient shader, sun disc, horizon glow, stars, moon
- [ ] Time-of-day cycle driving sun position and all palettes
- [ ] Fog derived from sky colour, plus height fog
- [ ] Filmic tonemapping, colour grading
- [ ] Distant mountain impostor layers with parallax
- [ ] Instanced billboard props with the near-3D cross-fade band
- [ ] Biome parameter sets and distance-driven blending
- [ ] Prop tables per biome, weighted by blend
- [ ] Post stack: bloom, vignette, grain
- [ ] Quality tiers

**Exit:** a contact sheet of ~20 screenshots across seeds, biomes and times of
day where the great majority look like somewhere you want to be.

**Watch out for:** sky banding on 8-bit displays (fix with the animated dither,
not with more gradient stops), and the near-to-billboard prop transition
popping.

---

## Phase 4 — The cockpit

**Goal:** you're sitting in the car.

- [ ] Interior geometry: dash, cowl, A-pillars, door cards, console
- [ ] Steering wheel: rim, three spokes, hub — rotating with the finger
- [ ] Five-dial binnacle with correct overlapping layout
- [ ] Live needles: tach and speedo driven by the sim
- [ ] Dial backlighting rising with falling ambient light
- [ ] Glass specular streak across the dial covers
- [ ] Rear-view mirror
- [ ] Final portrait framing: aperture proportions, FOV, horizon placement
- [ ] Material finishes: matte vinyl / semi-gloss leather / brushed aluminium

**Exit:** a night screenshot where the dials are the only light source and the
cabin is unmistakably a 70s sports car. That single image is the test.

---

## Phase 5 — Life on the road

**Goal:** it's a game.

- [ ] Traffic spawn/despawn, deterministic from seed + distance
- [ ] Traffic lane-following, wander, corner behaviour
- [ ] Four or five vehicle silhouettes in a period palette
- [ ] Capsule collision, impulse, speed scrub
- [ ] Collision jolt into the attitude springs
- [ ] Scoring: distance, flow, overtakes
- [ ] HUD: gauge-based speed, distance, flow arc, overtake tally
- [ ] Start screen, pause panel, drive summary
- [ ] Persistence: best distance, settings, resume point

**Exit:** a complete session — open, drive, overtake several cars, end the
drive, see the summary, reopen and resume where you left off.

---

## Phase 6 — Android

**Goal:** it's on your phone as a real app.

- [ ] Capacitor project, portrait lock, fullscreen/immersive, no status bar
- [ ] Back-button handling, lifecycle (pause on background, resume correctly)
- [ ] Keep-awake while driving
- [ ] App icon and splash
- [ ] Device performance pass: profile, then cut whatever's costing most
- [ ] Touch latency check — WebView input lag is the known risk here
- [ ] Battery/thermal check over a 20-minute drive
- [ ] Signed release APK, offline verified, no permissions requested

**Exit:** a signed APK you can install and drive for twenty minutes without the
phone getting hot or the frame rate sagging.

**Watch out for:** WebView touch latency. If it's bad enough to hurt the
steering, mitigations are pointer prediction and a shorter input pipeline —
and if those aren't enough, it's a genuine re-evaluation point for ADR-0001.
Test this *early* in the phase, not at the end.

---

## Phase 7 — Polish

**Goal:** the difference between finished and good.

- [ ] Night, properly — headlights, moonlight, the road out of the dark
- [ ] Weather variation: haze, overcast, distant rain
- [ ] Tunnels, bridges, cuttings, roadside furniture
- [ ] Off-road dust and grass particle wash
- [ ] Radial speed blur
- [ ] Long-drive checks: what does hour three look like? Does anything drift,
      accumulate float error, or leak?
- [ ] A final handling tuning pass with fresh eyes
- [ ] Settings: invert Y, quality override, control sensitivity

**Exit:** nothing on the list bothers you any more.

---

## Not scheduled

Ideas that are explicitly out of scope for now, recorded so they stop coming
back: passengers, a radio (no audio), car selection, day/night skip, photo
mode, route history, achievements, iOS.

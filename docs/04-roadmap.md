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

## Phase 0 — Foundation ✅ *complete 2026-09-17*

**Goal:** a repo that builds, runs, and can be looked at.

- [x] Decisions locked and written as ADRs
- [x] Documentation structure
- [x] Vite + TypeScript + strict config, ESLint with the `sim ↛ render` rule
- [x] Vitest wired up
- [x] Canvas, resize handling, portrait framing scaffold
- [x] Fixed-step loop with interpolation (`core/loop.ts`)
- [x] Seeded RNG + noise (`core/rng.ts`)
- [x] Debug overlay: fps, frame time, sim time, arbitrary watch values
- [x] Screenshot harness (`tools/shoot.ts`) — Playwright, drives a seed to a
      given distance, writes a PNG. This is how you see the game.

**Exit: met.** `npm run shoot -- --seed 1 --at 500` produces a PNG, `--sheet`
produces a contact sheet, and the framing guides land on the rendered horizon.
See [PROGRESS.md](PROGRESS.md) for what it cost and what it caught.

---

## Phase 1 — The road ✅ *complete 2026-09-17*

**Goal:** an endless, believable road you can fly along.

- [x] Curvature / grade / width fields over `s`
- [x] Station sampling and the `(s,t) ↔ world` conversions
- [x] Chunk ring buffer with in-place recycling
- [x] Road mesh sweep: surface, shoulder, verge, centre line, edge lines
- [x] Banking derived from curvature
- [x] Event injection: hairpin, sweeper, crest, dip, straight
- [x] Terrain ribbons either side
- [x] Determinism test, ring-buffer recycling test, resume-equivalence test
- [ ] Free-fly debug camera + station/curvature visualisation — *deferred; the
      sequence shots covered what it was for, and Phase 2 needs a chase camera
      anyway, so it is folded into that*

**Exit: met.** 20 km on one seed with no seams, deterministic geometry, no
reallocation after construction, and a hairpin that reads as a hairpin.

**The warning came true, from the other side.** The roadmap predicted "all
medium corners, no straights". Measured, raw noise gave the opposite: 57% of
the road straighter than a 1.6 km radius, because fbm spends most of its time
near zero. Same failure — no rhythm — and the fix was a shaping exponent on the
noise rather than more events. See PROGRESS.md.

---

## Phase 2 — The drive *(current)*

---

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

# 04 — Roadmap

*Last updated: 2026-09-21*

Nine phases. Each has a **goal**, a **task list**, and an **exit criterion**
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

## Phase 2 — The drive ✅ *signed off 2026-09-20, calibration deferred*

**Goal:** the car feels good. This is the most important phase in the project.

- [x] Vehicle model: speed, yaw, grip, slide, surfaces
- [x] Attitude springs: roll, pitch, heave
- [x] Pointer handling + dynamic origin + release recentre
- [x] Control curves and the steering speed-falloff
- [x] Driver-eye camera consuming attitude
- [x] Off-road: grip loss, drag, rumble
- [x] Handling regression tests — 80 of them, driving the real generated road
- [x] An autopilot, so the harness can drive rather than teleport
- [x] A chase camera and `npm run telemetry`
- [x] **Driven on a real device.** 2026-09-20, on the first APK.
- [ ] **Calibration pass** — acceleration, top speed, cornering g. Deferred
      by the owner: *"as long as you keep stuff properly modular, we can just
      fix that later."* Every one of these numbers is in `sim/tuning.ts`.

**Exit: met.** The criterion was that you drive it and it feels good. Driven,
on the first Android build, 2026-09-20: *"got it running, really good!"*

With one explicit carve-out, made by the owner in the same breath: **nothing is
calibrated.** Acceleration, top speed and cornering g are placeholder numbers
that have never been measured against anything. That is deferred rather than
failed — the phase was about whether the *model* produces a car you can place
and lean on, and it does. What the numbers should be is a separate question,
answerable at any point, because every one of them is a named constant in
`sim/tuning.ts` and none of them is inlined anywhere.

This is the payoff for non-negotiable 5, and it is worth saying out loud: a
handling pass can be a pull request that touches one file.

**The warning held**, with one qualification. Screenshots still cannot judge
this phase. But what they *could* do turned out to be more than expected once
the harness could drive the car and hold an input: a still at 0.85 g with the
body at full lean is a real check that the model is doing something, even if it
says nothing about how it feels getting there.

---

## Phase 3 — The view *(in progress)*

**Goal:** it looks good.

- [x] Sky: gradient shader, sun disc, horizon glow, clouds, stars
- [x] Time-of-day cycle driving sun position and all palettes
- [x] Fog derived from sky colour
- [x] Filmic tonemapping — in since Phase 0 (ADR-0007)
- [x] Distant mountain impostor layers with parallax
- [x] Billboard vegetation — mounds and spires, silhouette drawn in the
      fragment shader, one draw call
- [ ] The moon as a night key light
- [ ] Height fog on top of the distance fog
- [x] Telegraph poles and wires — the near-field speed cue. Something has to
      pass *close* to the car, and a maintained verge is bare of everything else.
- [x] Chevron signs on corners tighter than a 150 m radius
- [ ] Guardrail where the ground falls away
- [ ] The near-3D cross-fade band, for props close enough that flatness shows
- [ ] Biome parameter sets and distance-driven blending
- [ ] Prop tables per biome, weighted by blend
- [ ] Colour grading, and the post stack: bloom, vignette, grain
- [ ] Quality tiers

**Exit:** a contact sheet of ~20 screenshots across seeds, biomes and times of
day where the great majority look like somewhere you want to be.

**Watch out for:** sky banding on 8-bit displays (fix with the animated dither,
not with more gradient stops), and the near-to-billboard prop transition
popping.

---

## Phase 4 — The cockpit *(postponed; procedural fallback active)*

**Goal:** you're sitting in the car.

- [x] The second render pass the cabin needs to exist at all (ADR-0017)
- [x] Steering wheel: rim, three spokes, hub — rotating with the finger
- [x] Layered dash, cowl, A-pillar, door-card and vent silhouettes
- [x] Five-dial binnacle with the overlapping layout from the reference
- [x] Live needles: tach and speedo driven by the sim
- [x] Dial backlighting rising with falling ambient light
- [ ] Glass specular streak across the dial covers
- [ ] Rear-view mirror
- [x] Reference-led portrait framing: 61% aperture, 72° FOV, 68% horizon
- [ ] Material finishes: matte vinyl / semi-gloss leather / brushed aluminium

The listed geometry is the restored procedural 3D fallback. A downloaded
full-car GLB and two sprite implementations all failed device review; ADR-0020
postpones final cockpit art until a purpose-built, separable interior model is
available. Phase 3 resumes in the meantime.

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

## Phase 8 — Sound *(first slice landed 2026-09-20)*

*Numbered 8 because it was defined last and the numbers are identities —
PROGRESS.md and the ADRs refer to phases by number, so renumbering would
silently rewrite history. It runs here, between 5 and 6.*

**Goal:** the car sounds like it is being driven.

Sound was a non-goal until the owner drove the first build and reversed it
(ADR-0016). A first slice is in, on the same terms as Phase 6's wrapper: the
domain exists and makes the right noise, and the rest is a phase.

- [x] `audio/` as a sealed domain — synthesised, no samples, no music
- [x] Engine: sub, body and harmonic voices, lowpass opening with load
- [x] Wind: filtered noise, square law in speed
- [x] Tyres: filtered noise, colour by surface, level by lateral load
- [x] Starts on the first touch; fades out when backgrounded
- [ ] **Mix pass on a device.** Phone speakers, then headphones. The engine is
      the one that will be wrong — it has never been heard.
- [ ] A mute control. Lands with the Phase 5 HUD; until then the volume keys
      are the interface.
- [ ] Surface transitions — a wheel dropping onto gravel should be a moment,
      and right now it is a crossfade
- [ ] Rumble strips and impacts, driven by the events `sim/` already emits
- [ ] Wind through the quarter-light: a cue for speed that is not just level
- [ ] Decide, as its own ADR, whether a music bed is allowed after all. The
      answer today is no.

**Exit:** twenty minutes with headphones on without wanting to turn it off,
and the same twenty minutes muted without missing it.

**Watch out for:** a synthesised engine turning into a dentist's drill. The
guard is that level must come mostly from *load*, not revs — an engine coasting
at 6000 rpm is much quieter than one pulling at 3000, and the test suite
asserts it.

---

## Phase 6 — Android

**Goal:** it's on your phone as a real app.

*Opened early, out of order, because Phase 2's exit criterion needs a device
and nothing else can supply one. The performance, latency and thermal work
stays here; only the wrapper was pulled forward.*

- [x] Capacitor project, portrait lock, fullscreen/immersive, no status bar
- [x] Lifecycle — the loop stops while backgrounded and resumes cleanly
- [x] Keep-awake while driving
- [x] App icon (adaptive) and a splash that is just the cabin black
- [x] Built in CI, published as an installable APK (ADR-0015)
- [ ] Back-button handling — currently Capacitor's default, which exits
- [ ] Device performance pass: profile, then cut whatever's costing most
- [ ] Touch latency check — WebView input lag is the known risk here
- [ ] Battery/thermal check over a 20-minute drive
- [ ] Signed release APK, offline verified (no permissions are requested already)

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

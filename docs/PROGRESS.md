# Progress Log

Append-only. Newest entries at the top. Never rewrite a past entry — if
something turned out to be wrong, say so in a new entry.

Each entry: what was built, what was learned, what surprised us, what's next.

---

## 2026-09-17 — Modular restructure, and Phase 1: the road

Two pieces of work in one go, in that order deliberately: the road is exactly
the feature that would have smeared across `world/` and `render/` if it had
been built into the old shape, and moving 2,000 lines is much cheaper than
moving 4,000.

### The restructure (ADR-0011)

The old boundary was horizontal — pure logic under, rendering over. Good rule,
wrong shape for parallel work: road *generation* was pure and road *meshing*
was not, so "the environment" would have been two directories under two owners,
and whoever worked on it would have been editing `render/` alongside whoever
owned the cockpit.

Now the cut is **vertical**. Seven sealed domains (`world`, `sim`, `input`,
`render`, `cockpit`, `ui`, `fx`), each owning its generation, geometry,
shaders, DOM and constants. No domain imports another. They talk through
`contracts/`, and `app/` wires them at runtime.

The mechanics that make it real rather than aspirational:

- **A module lifecycle.** Each domain exposes one `GameModule`. The registry
  hands it its own `THREE.Group` and its own DOM layer and drives
  `init → start → step → frame → resize → dispose`. A module that stays inside
  its own group cannot touch another one's — that is the isolation, and it is
  structural rather than a promise.
- **Two-phase startup.** Everything registers services in `init`, everything
  resolves them in `start`. Registration order therefore means nothing, so
  `app/modules.ts` is a list rather than a dependency ordering to reason about.
- **Tuning split four ways** — `sim/`, `world/`, `render/`, `input/` each own
  their constants. A single shared constants file is the most reliable merge
  conflict there is.
- **The linter enforces it.** Per-directory `no-restricted-imports`, with
  messages that say what to do instead. I verified both rules actually bite by
  writing deliberate violations: `ui/` importing `world/` and `sim/` importing
  three.js are both rejected. The architecture is the lint config; the docs
  describe it.

ADR-0002 is refined, not weakened: its purity rule now applies to `sim/` and
`world/gen/` rather than to all of `world/`. The mesh builders were never going
to be pure; the parts that matter for testability — the vehicle model and the
generator — still are, and are still checked.

Three coordination points now exist and are named: `contracts/`, the `Services`
interface, and `app/modules.ts`. Everything else is private to a domain.

### Phase 1: the road

Curvature, grade and width as noise fields over distance, with hand-authored
**events** layered on top — hairpin, sweeper, crest, dip, straight. Stations
integrated into a ring buffer, swept into road and terrain meshes, under a
gradient sky whose horizon colour is also the fog colour.

Terrain is generated in **road coordinates, not world coordinates**, which is
what makes it meet the tarmac exactly: near the road its height *is* the road's
height, and relief only fades in past the verge. The road mesh's outer verge
vertices call the same function, so the two meshes meet by construction rather
than by agreement. Generating a world-space heightfield and cutting a road into
it is the version of this that leaves hills poking through the tarmac.

Road markings, shoulders and verges are drawn analytically in the fragment
shader from the lateral coordinate rather than from textures or extra geometry.
A line is `smoothstep` over a screen-space derivative, so it stays a pixel wide
into the distance instead of shimmering, and costs no vertices and no texture
memory. The whole cross-section is seven vertices.

**Meshes are one buffer each, rebuilt on a chunk boundary** — about every 17
seconds at cruising speed — rather than per-chunk meshes. The live road is
6.6 km and the far plane is 4 km, so the far end is always at least half a
kilometre beyond anything visible and nothing can pop. One draw call each, no
chunk lifecycle to get wrong.

### ADR-0012: determinism, stated precisely

ADR-0002 said "the world is a pure function of (seed, distance)". Building the
road showed that is true of some of it and cannot be true of the rest: position
and heading are the *integral* of curvature, and an integral is cumulative.

The honest version: **the fields are pure and evaluable anywhere; the geometry
is their integral, reconstructible from the seed at a cost linear in distance,
paid once at startup.** Reaching 50 km is twelve thousand additions. Nothing
the resume feature or the camera needed is lost — only the cost model differs.
There is a test asserting that arriving at 8 km in one jump lands byte-identical
to arriving in small steps.

### Two real bugs, one of which made the first render nonsense

**Every normal in the world pointed downwards.** My triangle winding was
`(a, c, b)`, so the accumulated cross product came out as forward × right,
which points *down*. The entire landscape was lit from underneath. The first
render was an unreadable mess of dark slivers and pale voids.

Worth recording how it was found, because I nearly went the wrong way: I spent
a while theorising about the camera, the rebase origin and the terrain ribbon's
lateral extent from the *photograph*. What actually settled it was adding a
`sceneReport()` to the test API and reading the numbers — camera at y = −8.36,
road at y = −9.48, meshes present, 74,688 triangles drawing. Everything was
where it should be, which ruled out two thirds of my hypotheses in one call and
pointed straight at shading. **A broken frame is much easier to diagnose from
numbers than from a picture of the result**, and the harness now has that
permanently.

**The index buffer was written on every rebuild but uploaded only once.**
`needsUpdate` was set on positions and normals but not on the index attribute,
so the GPU kept whatever the first build produced. Harmless today because the
indices barely change between rebuilds — which is exactly why it would have
surfaced much later, as something inexplicable.

### The roadmap's warning came true, backwards

Phase 1 predicted: "curvature noise that produces a road with no rhythm — all
medium corners, no straights, no drama."

Measured over 20 km, raw fbm gave the *opposite* and equally rhythmless result:

```
straight   57%   ████████████████████████████
gentle     32%   ████████████████
moderate    6%   ███
hard        4%   ██
very hard   1%   █
```

More than half the road straighter than a 1.6 km radius, because fbm spends
most of its time near zero. The fix is a shaping exponent (`|n|^0.62`,
sign-preserving) applied before the amplitude, which pushes the middle of the
distribution outward while leaving the peaks exactly where they were — so the
road gets more real corners without the hairpins becoming absurd:

```
straight   28%   ██████████████
gentle     55%   ████████████████████████████
moderate   11%   █████
hard        5%   ██
very hard   1%   █
```

Consistent across seeds; tightest radius 67–82 m. Note what the fix was *not*:
more or stronger events. The events were fine — 32 slots gave 6 hairpins, 8
sweepers, 6 crests, 5 dips, 7 straights. It was the noise underneath them.

### Measured

| | |
|---|---|
| Draw calls | 3 (sky, terrain, road) |
| Triangles | ~62–75 k, against a 150 k budget |
| Sim | ~0.2 ms/frame, all three modules |
| Tests | 88, up from 72 |

Render time is ~90 ms, which is software rasterisation and means nothing about
a phone.

### Deferred, with reasons

- **The free-fly debug camera.** The sequence shots covered what it was for,
  and Phase 2 needs a chase camera anyway — folded into that rather than built
  twice.
- **Distant terrain silhouette.** The terrain ribbon is 260 m wide, so its
  lateral edge is visible against the sky on open ground. Phase 3's impostor
  mountain layers are the actual fix; widening the ribbon would be paying
  vertices for something that gets replaced.

### Still open

The road reads well in stills but "a road you'd want to drive" is a claim about
driving, and there is nothing to drive it with yet. The curvature distribution
above is a proxy, not an answer. Phase 2 is where this gets tested properly.

---

## 2026-09-17 — Framing retune and camera look-ahead

Three changes, on your call. All three are visual and none can be finally
judged from stills, so the values below are defensible starting points, not
settled.

**Dash band shrunk, windscreen grown.** Bands go from 5/38/22/35 to
**5/46/15/34**. The justification for taking it out of the dash rather than the
wheel: in the real car the binnacle sits *behind* the wheel, so the dials can
overlap the top of the wheel band instead of needing a tall strip of their own.
Shot 38/22 against 46/15 and 54/10 — 54% is a lovely big window but leaves 91 px
for five dials, which Phase 4 would regret. 46/15 is the compromise.

**Field of view raised from 52° to 72°, deliberately far past honest.** A
physically correct FOV for a phone at arm's length is around 25°, which looks
like driving through a telescope. Shot 60°/72°/84°: 84° visibly distorts at the
frame edges and flattens the horizon; 60° is calmer but reads slower. 72° is
where the road starts to move.

**The view now leads the car into corners** — ADR-0010. The camera yaws toward
the road's heading about three quarters of a second ahead, at 45% of the angle,
capped at 14°, smoothed with an exponential approach.

Two things I want on the record about it:

1. **It uses an approach, not a spring.** The attitude springs are deliberately
   underdamped because overshoot reads as mass. A camera that overshoots reads
   as nausea. There is a test asserting the rig never overshoots.
2. **The yaw belongs to the head, not the car.** `ViewState.lookYaw` is
   separate from `heading` and only the camera consumes it. This matters from
   Phase 4: the cockpit rides on `heading`, so turning into a bend swings the
   A-pillars and the dash across the view. Folding the offset into `heading`
   would rotate the whole cabin with the view and produce no visible effect at
   all — an easy and completely invisible mistake to make later.

**To make any of this reviewable, the placeholder road now curves.** Two sine
components with a closed form, because the ground shader evaluates the same
centreline per pixel and cannot integrate a heading field the way the real
generator will. Tightest radius 109 m. Deleted in Phase 1; there is a test file
keeping it honest until then, because a bug in the road would otherwise read as
a bug in the camera.

**The harness grew three things**, all of which paid for themselves immediately:

- Framing overrides via URL params, so a sweep of settings is one run rather
  than one edit-and-reshoot each.
- `--compare` — the framing and look-ahead sweep above.
- `--sequence --from --to --steps` — a strip of frames through one corner. It
  is the closest a screenshot loop gets to showing motion, and it is how the
  look-ahead was checked at all.

**First sweep was worthless and I reshot it.** I picked 760 m to compare
look-ahead on and off; the placeholder road is almost straight there, so both
frames looked identical. Scanned for the point of maximum heading change over
the look-ahead distance — 780 m, 16.9° — and reshot. Worth remembering: a
comparison shot is only as good as the point it is taken at, and "nothing
changed" can mean the feature works or that the test was blind.

**Two placeholder artefacts fixed** while they were in the way: a visible
colour band under the horizon, where the ground plane is clipped by the far
plane but the sky's lower hemisphere was still fading toward its ground colour;
and grid lines loud enough at the new FOV to distract from the thing being
judged.

**Still open:** the look-ahead strength and the FOV both need a real device.
Stills show where the view ended up, never how it got there, and how a 72° FOV
feels at speed in your hand is not a thing this loop can tell either of us.

**Tests:** 72 passing, up from 49. One of the new ones failed first time — it
scanned for a zero crossing on a 0.5 m grid with a 1e-4 tolerance, which the
slope crosses far too fast to land on. Test bug, not a code bug; it bisects now.

---

## 2026-09-17 — Phase 0 complete: foundation

**Built:** the toolchain, the core runtime, the portrait framing, and the
thing everything else depends on — the screenshot harness.

- **Build:** Vite + TypeScript in strict mode (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, no `any`, no `!`), Vitest, ESLint. The
  `sim ↛ render` layering rule from ADR-0002 is enforced by
  `no-restricted-imports`, not by good intentions.
- **`core/loop.ts`** — fixed 120 Hz accumulator with render interpolation, a
  sub-step cap, and an `advance()` path that runs simulation steps with no
  rendering so the harness can fast-forward deterministically.
- **`core/math.ts`** — the spring-damper the whole feel of the car will hang
  off, plus frame-rate-independent easing and allocation-free vectors.
- **`core/rng.ts`** — seeded streams and hash-based value/gradient/ridged
  noise. Purely positional, so any point is evaluable without having generated
  what precedes it. That property is tested directly.
- **`core/events.ts`, `core/storage.ts`** — typed bus; localStorage that
  survives being blocked, corrupt, or written by an older build.
- **`render/framing.ts`** — the four-band portrait layout, in one place.
- **`render/renderer.ts`** — three.js, ACES filmic tonemapping from day one
  (ADR-0007), and the world scissored to the aperture so the GPU never shades
  the 57% of the display the car covers.
- **`render/debug.ts`** — frame timings plus framing guides that draw where the
  horizon *should* be, derived back out of the camera pitch.
- **`tools/shoot.ts`** — single shots and contact sheets. **`tools/perf.ts`** —
  frame-time percentiles over a scripted drive.
- **49 tests**, all passing. `npm run build` clean, `npm run lint` clean.

**Three bugs the tests caught, all real:**

1. **The loop used `0` as its "first frame" sentinel.** `performance.now()`
   starts near zero on a fresh page, so the sentinel kept re-triggering and
   every frame delta collapsed to a single step — the simulation would have run
   at a fraction of real time and the sub-step cap would never have fired. This
   one would have been genuinely nasty to find later, sitting underneath
   handling that felt inexplicably sluggish. Replaced with an explicit flag.
2. **The event bus skipped a listener when one removed itself during
   dispatch** — the classic splice-while-iterating bug. Fixed with tombstones
   and deferred compaction, so it stays allocation-free.
3. **`fps` and `frameMs` were smoothed independently**, so the debug panel
   showed "95 fps / 33 ms" simultaneously. fps is now derived from the smoothed
   frame time. A perf readout that contradicts itself is worse than none.

**The plan was wrong about the framing, and the harness caught it on the first
render.** ADR-0006 specified a "~2.4:1 aperture at ~46% of the display" —
arithmetically impossible on a 9:19.5 phone, where a full-width band at 46%
height is about 1:1. Getting 2.4:1 would have meant a strip under a fifth of
the screen tall, with the landscape — pillar #2, the reward — squeezed into it.
Corrected to 5/38/22/35 with the aperture at ~1.2:1, and **field of view is now
authored horizontally (52°)** rather than vertically, so retuning the aperture
in Phase 4 can't silently change how far you can see into a corner. Written up
as ADR-0009; ADR-0006 left unedited with a pointer, per the convention.

**Measured (headless SwiftShader — software rasteriser, not phone numbers):**

| | |
|---|---|
| p50 frame | 34.5 ms |
| p95 frame | 64.2 ms |
| sim | < 0.01 ms/frame |
| draw calls | 2 |
| triangles | 962 |

Useful only as a commit-to-commit baseline. Real device performance is Phase 6.

**Exit criterion met:** `npm run shoot -- --seed 1 --at 500` produces a PNG,
the framing guides land exactly on the rendered horizon, and `--sheet`
produces a contact sheet across seeds, distances and times of day.

**Next:** Phase 1 — the road. Curvature/grade/width fields over distance,
station sampling, the chunk ring buffer, the road mesh sweep, and the event
injection that stops the road feeling like undifferentiated noise.

---

## 2026-09-17 — Phase 0: planning

**Built:** the plan. Repo documentation structure, vision, game design,
art direction, architecture, roadmap, conventions, and eight ADRs covering
every decision made so far.

**Decided** (details in `decisions/`):

| Question | Answer |
|---|---|
| Stack | TypeScript + three.js + Vite, wrapped with Capacitor |
| Rendering | Hybrid — 3D road and near world, 2.5D distant scenery |
| Loop | Endless, gentle scoring, mild traffic |
| Art | Stylised low-poly world, detailed 1970s 911-style interior |
| Traffic | Same direction only, soft collisions, no fail state |
| View | **Portrait**, cockpit, locked |
| World | Seamless biome blending + independent time-of-day cycle |
| Dev loop | Screenshot-first from the container |

**Learned / noted:**

- The build container has Node, Java, Gradle, Chromium and Playwright but
  **no Android SDK**. This drove the stack decision more than anything else —
  a web stack is the only one that can be seen and iterated on from here.
- Portrait is a real constraint, not a free choice. The resolution is to make
  the windscreen a wide letterbox aperture with a narrow (~38°) vertical FOV,
  which turns the awkward frame into a cinematic one and is also true to the
  shallow screen of the car being evoked. Written up in the art direction doc
  and ADR-0006.
- The screenshot-first loop has one gap that can't be papered over:
  **it cannot judge motion.** Phase 2 (handling and feel) therefore has an exit
  criterion that explicitly requires a real build on a real phone. Recorded in
  ADR-0008 rather than discovered later.
- WebView touch latency is the single biggest risk to the project, because the
  control scheme *is* the game. Moved to early in Phase 6 rather than the end.

**Next:** Phase 0 implementation — Vite/TS/lint/test scaffold, fixed-step loop,
seeded noise, debug overlay, and the screenshot harness. Exit when
`npm run shoot` produces a PNG and the overlay shows a stable 60 fps.

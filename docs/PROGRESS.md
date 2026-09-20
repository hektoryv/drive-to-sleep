# Progress Log

Append-only. Newest entries at the top. Never rewrite a past entry — if
something turned out to be wrong, say so in a new entry.

Each entry: what was built, what was learned, what surprised us, what's next.

---

## 2026-09-21 — The flat atlas becomes an asymmetric cockpit card model

The first sprite replacement was technically stable and artistically wrong.
Vertically stretching one landscape atlas made the cabin tall and toy-like,
showed both doors as though the camera were centred outside the car, reduced
the ceiling to a strip and left every layer visibly coplanar. Painted purple
over the same plane was tint, not shadow. The owner's device review caught all
four failures immediately.

ADR-0019 replaces that atlas with five purpose-built transparent textures from
one new driver-eye master composition: deep roof/windshield shell, horizontal
dash top/scuttle, vertical asymmetric dashboard, near driver's door and wheel.
The passenger door and right exterior mirror are intentionally outside the
portrait field of view. The wheel is large, close and cropped by the bottom;
showing less cabin is what gives it adult-car scale.

These are not parallel billboards. The scuttle is pitched almost horizontal,
the door yaws inward, the wheel has its own rake, and the cards occupy different
depths. Two generated-in-code soft shadow cards sit beneath the dash overhang
and wheel. Look-ahead moves each card according to depth, so the near wheel and
door slide farther than the roof shell without distorting their art.

The five runtime PNGs were Lanczos-downscaled for the phone GPU: 1.24 MB on
disk, about 9.25 MiB base RGBA / 12.3 MiB with mipmaps. The whole cockpit is
eight draw calls and sixteen triangles. Golden-hour, steering and night frames
were reviewed at 430×932; the wheel rotates independently, the road owns the
windscreen, the headliner has real mass, contact shadows deepen at night, and
the browser console is clean. Architecture lint, TypeScript, all 210 tests, the
production build and the Capacitor Android sync pass with all five card textures
present in the packaged web assets.

## 2026-09-21 — The device rejected the GLB; the cockpit becomes layered art

The metrically corrected 930 model was still the wrong answer. On-device it
rendered with broken-looking material islands and occlusion, and even where it
was technically correct its scanned detail was much uglier than the deliberately
faceted world. The user's verdict was unambiguous, so the full GLB, its loader
and its model-scale test are gone again.

The replacement is a **four-quadrant transparent sprite atlas**, generated for
the project from the owner's supplied cockpit sheet: exterior frame/hood,
dashboard/doors, a warm-and-violet lighting overlay, and a genuinely separate
three-spoke wheel. A fifth solid lower-cabin backing closes the wheel-column
cutout without exposing the road. The atlas contains no badge, marque, model
number or readable branding.

The layers remain in ADR-0017's second WebGL pass, so world scissoring is
unchanged. They face the cockpit camera instead of pretending to be physical
geometry; look-ahead becomes a small lateral parallax shift, which preserves
the sense of looking into a bend without skewing the painted A-pillars. The
wheel rotates independently from interpolated steering. Daylight supplies a
restrained shared tint, while the authored lighting layer grows through dusk.

The result is five draw calls and ten triangles, with a 774 KB source PNG
(about 6 MB uncompressed on the GPU), replacing a 3.7 MB GLB with dozens of
draw calls and materials. The road and simulation remain in metres and m/s;
the player's intended 4.291 m physical length stays in the vehicle contract
for future chase-body, traffic and collision work. A screen-space cockpit does
not redefine world scale.

The portrait render was checked live at 430×932: the windscreen again owns the
upper 61%, the road is readable, the wheel runs off the bottom edge, steering
visibly rotates it, and the browser console is clean. The painted gauge needles
are static; live tach/speed overlays remain Phase 4 work. Lint, all 210 tests,
the production build and the Capacitor Android sync pass; the shipped cockpit
asset falls from 3.7 MB to 774 KB.

## 2026-09-21 — A real-scale 930 replaces the procedural cabin

The hand-built cockpit pass has been removed. In its place is the supplied
1982 930 GLB: a noncommercial development placeholder whose source, author and
CC BY-NC-SA 4.0 licence are recorded beside the asset. It must be replaced
before any commercial release.

The GLB's exported car is only about 0.0432 source units long. That is an
export-unit oddity, not a reason to resize the game world. The road, camera,
simulation and telemetry already use SI units, including metres and metres per
second. The loader therefore measures the untransformed source bounds and
uniformly normalises the model to the real 930's **4.291 m** bumper-to-bumper
length. That length now lives in `contracts/vehicle.ts`, where a future body or
collision representation can share it without crossing domain boundaries.

The model's steering wheel is a distinct mesh despite arriving in one GLB. Its
exported pivot was at the car origin, so the loader computes the wheel's own
centre, reparents it under a dedicated pivot and drives that pivot from the
interpolated steering angle. The full-car roof, headliner, windows and misplaced
mirror material islands are hidden in the cockpit pass so they do not cover the
portrait camera. A restrained texture-fed fill replaces the HDR environment
the scanned materials expected while retaining the shared daylight key.

The five gauge faces now have their authored texture and markings, but the
source needles are baked into static meshes. The old procedural live needles
were removed with the mock-up; claiming live instruments now would be false.
`CarView` still supplies RPM and speed, ready for separable needle geometry or
an overlay once the production cabin is chosen.

The exact scale is covered by a unit test. Lint, the full test suite and the
production/Android builds are the remaining release checks for this pass.

## 2026-09-20 — Reference-led cockpit pass and inherited-code audit

The placeholder cabin is gone. The composition now follows
`docs/reference/art-target.png`: sky reaches the top of the portrait frame, a
61% windscreen gives the road room, warm earth and violet ranges sit behind a
solid double-yellow road, and the red-and-black cabin has an angled A-pillar,
door-card silhouettes, a layered dash, five overlapping instruments, live
needles, passenger vents and a smaller three-spoke wheel. Instrument markings
rise with `daylight.instrumentGlow`; the cabin shaders take the same sun and
ambient colours as the world.

The review also found four code defects that a still would not expose:

- `view-module.ts` accepted fixed-step interpolation alpha and then discarded
  it. It now presents the previous/current car poses along the short heading
  arc, and the wheel interpolates its steering angle too.
- Cabin normals were lit in each mesh's object space even when the mesh was
  raked or rotated. Normals and the world-space sun are now compared in view
  space.
- Audio pause claimed to suspend after fading but never called `suspend()`.
  It now fades, suspends after `MASTER.FADE_S`, and cancels stale resume work
  when paused or disposed.
- The pure `world/gen/` lint block omitted several sibling-domain paths, so
  imports across them passed despite ADR-0011. The boundary and a lint-backed
  regression test now cover sibling domains and `world/view/`.

`daylightAt()` also stopped allocating a temporary sun object from a live
getter. The suite is 212 tests; lint and the production build pass. Golden-hour
portrait renders were reviewed at the harness's phone size. Sound remains
unheard on real hardware, and the no-`INTERNET` Android manifest assumption is
still unverified; neither is claimed fixed by this pass.

Next for Phase 4: the mirror, dial glass/material finish, and the night-frame
exit shot. Handling constants remain intentionally untouched.

## 2026-09-20 — Phase 3 begins: the sky, and a target to aim at

An art target arrived: `docs/reference/art-target.png`, "basically what I want
it to look like in the end". That changes the phase from a judgement call into
something measurable, so the first thing I did was read it rather than build
from it.

**What the reference actually says** (written up in `02-art-direction.md`):
the sky is a *four*-stop gradient, not two; everything lit is warm and
everything in shadow is violet; clouds are flat hard-edged slabs rather than
soft ones; the horizon has four or five receding ranges; roadside furniture is
structural, not dressing; and the car is **red**.

I sampled the golden-hour gradient straight off it — `#7a74ac` zenith through
`#c9717b` to `#f9814c` horizon — and that is now the 0.735 keyframe everything
else is built around.

### Built

- **`world/gen/daylight.ts`** — ten keyframes, a dozen colours each, blended
  with smootherstep. One phase value drives the sun's position and every colour
  in the world: sky, fog, ambient, the light on the terrain, the distant
  ranges, and from Phase 4 the dashboard. Pure, and tested.
- **A new sky shader** — four-stop gradient, sun disc, halo, a directional
  horizon wash, stars, and two cloud decks. The clouds are noise thresholded
  *hard* with a second threshold inside the shape, which is where the
  cut-paper look comes from. All of it is one shader on one sphere: one draw
  call, clouds included, no textures.
- **`world/view/ridges.ts`** — four layered mountain silhouettes with aerial
  perspective. The ridge height at a bearing is sampled from the world point
  that bearing aims at, so the layers have real parallax against each other
  instead of being painted on.
- **ADR-0014**, because the reference overturns ADR-0007's black cabin.

### The bug that ate the afternoon

The ridges rendered nothing for about two hours of work. Draw calls were being
issued (3 → 7), the geometry was correct when read back out of the buffer, the
shader compiled without error, and a hardcoded triangle in the same mesh drew
fine.

The cause: **`Group.renderOrder` in three.js is not a hint, it is the
`groupOrder` of everything beneath it, and `groupOrder` is compared *before*
each object's own `renderOrder`.** I had set `group.renderOrder = -0.5` on the
ridge group meaning "slightly behind". What it actually did was promote all
four layers ahead of the sky in the sort — and the sky is a full-screen shell
that writes no depth, so it painted straight over them. Four invisible draw
calls, no error anywhere.

Three things about how that went that are worth keeping:

- **I theorised for far too long before measuring.** Every hypothesis was
  plausible and none was testable from the picture. The things that actually
  moved it forward were reading the geometry back out of `geometry.attributes`
  in the page, and hiding the terrain and road to see the ridges alone.
- **My first instrument was wrong and I trusted it.** I forced the shader to
  output pure red and counted red pixels — but ACES tonemapping turns pure red
  into `#e86640`, so the detector missed it *and* an orange sunset sky would
  have hidden it from my eye too. A detector that can return a false negative
  is worse than no detector.
- **The bisect that finally worked was subtractive**, not additive: take the
  scene away until only the suspect is left.

### Three more real bugs, all found by looking

1. **The sky sphere was outside the far plane.** Radius 6000, far plane 4000 —
   the world rendered against black. Far plane is now 12000 and the near plane
   moved from 0.1 to 0.25 to buy back the depth precision.
2. **Every palette colour was being read as linear when it was authored in
   sRGB.** `THREE.Color.setRGB` defaults to the renderer's working space, so
   every mid-tone came out about twice as bright and the whole sky was pastel.
   Now converted in one shared helper rather than remembered per call site.
3. **The sun azimuth swept 180° per day instead of 360°**, so it snapped
   through half a turn at midnight. Invisible in a still, a hard cut in a long
   drive. Caught by a test, not by an eye.

And one that was only a shape problem: the ridge noise collapsed x and z onto a
single diagonal at a 2600 m scale, so the entire horizon fell inside about one
noise period and the "mountains" came out as one gentle bulge, identical on
opposite sides. Properly 2D now, at 620 m.

### One optimisation deleted

The ridges were rebuilt only after the camera had moved a few metres, which is
the obvious optimisation. It was also silently keeping them stale, and four
invisible layers are not cheaper than four visible ones. Rebuilt every frame
now — about 1,500 vertices of 1D noise. Measure before optimising; I did not,
and it cost more than it saved.

### Where it stands

The day cycle runs end to end and the keyframes join up — stars to dawn glow to
clean daylight to golden hour to twilight, shot in one sheet. Mountains recede
properly into haze. The structure of the target is there.

What is not there yet, in rough order of how much it would close the gap:

- **Biome palettes.** The terrain is still hardcoded olive green and clashes
  badly with a sunset. It should be ochre at golden hour, and it should be
  reading the daylight palette like everything else.
- **Vegetation and roadside furniture** — the shrubs, guardrail, chevron sign
  and telegraph poles that give the road somewhere to be.
- **Harder cloud edges.** Mine are softer than the target's cut-paper slabs.
- **Double yellow centre lines** rather than the single white one.
- The cockpit, which is Phase 4 and is now red.

---

## 2026-09-18 — Phase 2: the drive

The car exists. Handling model, attitude springs, one-finger controls, an
autopilot, and 80 new tests. **Code complete; not signed off** — the exit
criterion needs a real device and I cannot provide one (ADR-0008).

### What was built

- **`sim/vehicle.ts`** — speed, yaw, grip, slide. Longitudinal and lateral are
  handled separately, which is what keeps it tunable. The interesting line is
  the grip clamp: the fastest the car can rotate without exceeding its tyres is
  `(grip · g) / speed`, so clamping the yaw rate to that produces understeer
  for free, and whatever rotation the clamp refuses becomes the slide.
- **`sim/attitude.ts`** — the three springs. Roll leans outward, pitch dives
  and squats, heave is kicked by surface roughness. Rumble kicks are spaced by
  *distance*, not time, so a rough surface is a texture you drive across rather
  than a hum whose pitch rises with speed.
- **`input/controls.ts`** (pure) and **`input/pointer.ts`** (DOM) — the
  dynamic-origin scheme from ADR-0004.
- **`sim/autopilot.ts`** — a pursuit controller. Three jobs: the harness can
  now *drive* to a distance rather than teleport, so a still shows the body
  where the physics put it; it is a standing handling assertion; and it may
  become an attract mode.
- **`sim/drive.ts`** — the car-on-road glue, extracted so the tests exercise
  the same code the game runs rather than a copy of it.
- **A chase camera** and **`npm run telemetry`**, which drives and prints what
  the handling actually did.

### Measured

| | |
|---|---|
| 0–100 km/h | 5.8 s |
| Top speed | 189 km/h, drag-limited rather than clamped |
| 100–0 km/h | 40 m |
| Peak lateral | 0.85 g, matching the tyre ceiling exactly |
| Peak roll | 4.57° against a 4.5° cap — the extra is the deliberate overshoot |
| 20 km under autopilot | 0 off-road, line held within 3 m |

### Four bugs, and what each one teaches

**1. The autopilot drove into a field, backwards.** Steering is positive to the
right; heading *decreases* to the right, because forward is −Z. So a road
bending right produces a *negative* heading error and needs a *positive* steer.
I had the sign straight through. Two opposite conventions meeting in one
expression is a place to write the comment before writing the code.

**2. Rolling resistance was proportional to speed**, which makes it a second
drag term rather than rolling resistance — it is the tyres deforming, not the
air. The car was capped at 107 km/h and I nearly went looking at the engine
curve. Now constant, with a taper near zero so it cannot oscillate around a
standstill.

**3. `lateralAccel` had the opposite sign to its own name.** It was
`speed × yawRate`, which points *away* from the turn centre. The body roll came
out correct anyway, because the roll target used it unnegated and the two
errors cancelled. That is the dangerous kind of bug: the behaviour was right,
the exported telemetry was a lie, and the first person to use `lateralG` for
anything else would have got it backwards. Both are now correct separately.

**4. The touch origin un-steered the car.** ADR-0004 specified the origin
"slowly creeps toward the finger" when held near full deflection. But the
distance between origin and finger *is* the input, so creeping toward the
finger reduces it: a test holding full lock for thirty seconds with the thumb
completely still measured the steering decaying from 1.0 to 0.52. Replaced with
a hard drag-behind (ADR-0013), which gives everything ADR-0004 wanted and has
no ability to move on its own.

That last one is the one worth remembering. It would have been very hard to
find from the driver's seat — the car would have felt like it "washed out" of
long corners, which is a thing cars do, so the instinct would have been to go
looking in the tyre model. **Anything sitting between the finger and the car
needs a test that holds the finger still for a long time.**

### One tuning mistake worth recording

The autopilot ran slightly wide on the tightest hairpins — 0.44% of 20 km spent
with a wheel on the verge. I raised the cross-track gain to fix it and made it
*catastrophically* worse: 95% off-road, wandering 97 m from the centreline. A
fixed proportional gain that holds the line at 50 km/h oscillates and then
diverges at 110, because the same correction is a much larger course change
when applied for the same number of metres at twice the speed. The fix is to
scale the gain down with speed, which is control theory rather than taste.

Recorded because the instinct — "it is not correcting enough, correct harder" —
is exactly wrong, and I will have it again.

### Contract changes

Two, both additive:

- `RoadQuery.groundHeightAt(s, t)` — the car needs to sit on the world rather
  than float above a plane, and how high the ground is is the world's business.
- `CarView` gained `surface`, `lateralG`, `slipAngle`, `yawRate`, `lateralMs`.
  Telemetry is cheap to expose and handling cannot be tuned without it.

### What I cannot tell you

**Whether it feels good.** Everything above is numbers and stills. The numbers
are the ones I would want to see and the stills show the body where the physics
put it, but a car can produce impeccable telemetry and feel dead, and the
opposite is also true. Phase 2's exit criterion says a real build on a real
phone, and it means it.

Specifically unjudged: turn-in weight (`YAW_RESPONSE`), whether the steering
falloff is too much or too little at speed, whether 4.5° of roll reads as
weight or as seasickness in motion, and whether the control radii suit a thumb.
Those five constants are where I would start.

**Also untested: input latency through a WebView** — ADR-0001's standing risk,
invisible to this loop entirely, and due early in Phase 6.

### Deferred

- **A car body for the chase camera.** The chase view shows the road and the
  line, but with no geometry there is nothing to watch lean. It belongs to
  `cockpit/`, which is Phase 4, and building a throwaway box now to look at for
  one phase is not worth a domain.
- **Collision jolt** is written (`jolt()` in attitude) and tested, but nothing
  calls it until traffic arrives in Phase 5.

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

---

## 2026-09-20 — Phase 6 pulled forward: it's an app

**Built:** the Android wrapper, and a way to get it onto a phone.

Phase 2 has been code complete and unsignable-off for two days: its exit
criterion is that the car feels good, and no screenshot can answer that
(ADR-0008). So Phase 6's wrapper was pulled forward out of order. Only the
wrapper — the performance, latency and thermal work stays in Phase 6 where it
belongs.

- **Capacitor project** (`capacitor.config.ts`, `android/`). App id
  `com.hektoryv.drivetosleep`, web assets from `dist/`, cabin black behind
  everything so the launch is not a white flash.
- **Portrait-locked, immersive, awake.** `MainActivity` adds
  `FLAG_KEEP_SCREEN_ON` — a player holding one finger still for minutes looks
  exactly like a player who has left — hides the system bars with
  `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`, and re-hides them whenever focus
  comes back. The manifest locks the activity to portrait, which ADR-0006
  assumed and nothing had yet enforced.
- **No permissions at all**, `INTERNET` included. The Capacitor template ships
  it; nothing here opens a socket, because the WebView loads `https://localhost`
  through Capacitor's local asset loader and the request never reaches the
  network stack. Non-negotiable 8 is now true of the installed app and not just
  of the source.
- **Adaptive launcher icon**, two vector drawables: the art target's sky as the
  background, a ridge line and a road as the foreground. No Capacitor logo on
  the home screen.
- **CI builds the APK** (`.github/workflows/android.yml`) and attaches it to a
  rolling `dev` prerelease, so there is one stable URL a phone can install
  from. `.github/workflows/pages.yml` also publishes the web build, because
  iterating on feel through a URL is a second and iterating through an APK
  install is a minute.
- **Three-finger tap toggles the debug panel**, and the panel now defaults to
  *off* inside the app. In a browser it stays on: every screenshot wants it,
  and there is a URL to switch it off with. In the app there is no URL, and it
  sits on top of the sky. Driving takes exactly one finger, so a third pointer
  is never an accident.

**Decided:** ADR-0015 — the APK is built in CI and the native project is
committed.

**Learned / noted:**

- The container cannot build an APK and never will: `dl.google.com` is refused
  by the egress policy with a 403, which takes out the SDK *and* Google's Maven
  repository, so neither the Android Gradle Plugin nor any AndroidX artifact
  can be resolved. Phase 0 recorded "no Android SDK"; the sharper version is
  that there is no route to one. This is the second time that constraint has
  decided something structural — it picked the stack, and now it has picked
  where the app is compiled.
- The generated Capacitor project would not have compiled as shipped. Its
  `styles.xml` references `@color/colorPrimary`, `colorPrimaryDark` and
  `colorAccent`, and the template ships no `colors.xml` defining them. Moot
  here, because the theme was rewritten anyway, but worth knowing before
  anyone blames their own first build.
- The template's instrumented test asserts the package name is
  `com.getcapacitor.app`. Both example tests were deleted rather than fixed —
  the project's tests live in `tests/` and run under vitest.
- Committing `android/` means `npx cap add android` must never be run again;
  `npx cap sync android` (via `npm run android`) is the routine one. Written
  into ADR-0015 because it is exactly the command someone will reach for.

**Next:** drive it. Phase 2's five constants are at the top of TODO.md, and
every one of them is a question a still image cannot answer.

---

## 2026-09-20 — Phase 2 signed off, and sound goes back in

**The verdict:** the owner installed the APK and drove it. *"Got it running,
really good!"* Phase 2's exit criterion is met — the one criterion in the
project that could never be met from this side of the screen.

Two things came back with it, and they pull in opposite directions.

### 1. Nothing is calibrated, and that is fine

*"Gameplay wise, it's quite obvious that nothing is calibrated, i.e.
acceleration, top speed, turning g's all of that stuff. But as long as you keep
stuff properly modular, we can just fix that later."*

Recorded rather than acted on, deliberately. Phase 2 was about whether the
*model* produces a car you can place and lean on; it does. What the numbers
should be is a different question, and it is now the first item under "Later"
with the specific constants named and real-world figures to aim at
(~5.5 s to 100 km/h, ~245 km/h, ~0.85 g).

It is worth noting what made "we can just fix that later" true rather than
hopeful. Every one of those values is a named constant in `sim/tuning.ts` with
a comment saying which direction makes it more of something, because
non-negotiable 5 says so. A calibration pass is a diff to one file, and
`npm run telemetry` already prints what the car actually does, so it is a
measure-then-set job rather than a search.

### 2. Sound is back

*"I take back that it doesn't need sound, it definitely does."*

"No sound" was in the opening brief, was written into the vision doc as an
explicit non-goal, and was non-negotiable 6. It shaped real design work — the
HUD was specified to carry everything audio usually would. It was also a guess
made before anyone had driven the game, and it has now been tested. ADR-0016
reverses it and keeps the part of the instinct that was right: no music, no
interface sound, no samples, and the game must stay completely legible muted.

**Built:** a new sealed `audio/` domain. Three voices, all synthesised from the
car's own state, all continuous — nothing in the mix starts, stops or repeats.

- **Engine** — a triangle sub at half order, a detuned sawtooth at the firing
  frequency (rpm/60 × 1.5, a flat six), and a second sawtooth just off the
  octave, through a lowpass whose cutoff opens exponentially with load. No
  gearbox, so the note is monotonic in speed and never drops back; that is
  ADR-0004's "one finger, no thought" showing up in the sound.
- **Wind** — filtered noise rising with the *square* of speed, because that is
  what drag does and the ear knows when it doesn't.
- **Tyres** — filtered noise, colour by surface and level by speed and lateral
  g. Gravel is loud and bright, grass is loud and dull.

**Decided:** ADR-0016 — there is sound after all.

**Learned / noted:**

- **The architecture paid for itself.** Sound is the least planned-for change
  this codebase has had — it was explicitly ruled out — and outside
  `src/audio/` it cost one line in the manifest, one word in the lint config,
  and two additive contract fields. No domain changed. `sim/` does not know the
  car can be heard; `world/` does not know its gravel sounds different. ADR-0011
  claimed this would be true and had never been tested by anything nobody
  planned for. It is now, and it is written up as a worked example in
  `06-modules.md` so the next person can check the claim rather than trust it.
- **The lint config caught the one shortcut I took.** The first version of
  `audio-module.ts` imported `CAR.MAX_RPM` from `sim/tuning.ts`, which is
  exactly the cross-domain import the rules forbid. The fix was better than the
  shortcut: `maxRpm` became a field on `CarView`, where the Phase 4 tachometer
  needs it anyway — `rpm` is meaningless without knowing where the needle runs
  out. The architecture is the lint config, and the lint config improved the
  contract.
- **`GameModule` gained `pause`/`resume`.** Most modules do not need them —
  they simply stop being asked to do anything. Audio does: an AudioContext
  keeps playing whatever it was last told while the game is backgrounded and
  nothing is stepping it. It fades rather than cutting, because suspending an
  audible graph leaves half a cycle hanging and that click lands exactly as the
  player is leaving the app.
- **Sound cannot start before the first touch.** Browsers refuse it, the
  Android WebView included. The context starts suspended and resumes the first
  time `controls.active` goes true, which in a one-finger game is the same
  moment the drive starts — so the audio domain needs no window listener of its
  own and there is exactly one place where sound can begin.
- **Nothing here has been heard.** This container has no audio device, the
  tests run in Node and the screenshot harness runs headless. What is tested is
  the mapping from car state to sound parameters, which is where the
  interesting mistakes live: the suite asserts that the engine is quieter
  coasting at 6000 rpm than pulling at 3000 (the difference between an engine
  being driven and a dentist's drill), that wind is super-linear in speed, that
  tyre scrub is symmetric in corner direction, and that the three voices
  summed at their worst case still come in under unity so the mix cannot clip.
  201 tests.

**Next:** Phase 3 — vegetation and roadside furniture, the two biggest
remaining gaps to the art target. And a listen, which only the owner can do.

---

## 2026-09-20 — Vegetation, and the roadside stops being empty

**Built:** billboard vegetation, the largest remaining gap between what the
game looks like and `docs/reference/art-target.png` — which is full of dark
shrub clusters and had, until now, none.

- **The billboard is built in the vertex shader.** The buffer holds one anchor
  position repeated four times plus a corner offset; the shader expands it
  around the anchor. Nothing is recomputed as the camera turns, so several
  thousand plants cost one draw call and no per-frame CPU work at all.
- **Cylindrical, not spherical.** The expansion uses *world* up rather than the
  camera's. The camera rolls with the car (ADR-0002's attitude springs), and
  plants that roll with it read as the world tilting rather than the car
  leaning.
- **The silhouette is drawn, not sampled.** No texture anywhere: a mound is
  four circles maxed together and a spire is a tapering width, both cut out
  with `discard`. Every plant gets a different outline from one float of
  variation, the APK gains no art assets, and because it discards rather than
  blends there is no back-to-front sorting to do.
- **Placement is deterministic and clumped.** Everything about a plant comes
  from hashing its station index and slot, so it lands in the same place
  however many times the window has scrolled past it. Density is a slow noise
  field along the road, so you drive through thickets and out into clearings —
  a uniform scatter reads as wallpaper however well each plant is drawn.

**Learned / noted:**

- **Interpolate the centreline, do not reuse the station's height.** The first
  version jittered plants along the 4 m station spacing — necessary, or they
  land on a visible grid — but took the ground height from the station they
  started at. On a 7.5% gradient that is enough error to leave a shrub floating
  or half-buried. Plants now interpolate position between the two stations they
  sit between, and sample `terrainHeightAt` at the interpolated distance, which
  is the same function the terrain mesh uses, so they cannot disagree with the
  ground they stand on.
- **`inverse()` does not exist in GLSL ES 1.00**, which is what three.js
  compiles by default even on a WebGL2 context. The first vertex shader used it
  to get the billboard's right vector back out of view space. The fix is better
  than the original: build the frame in world space and carry it *into* view
  space, which needs no inverse and hands the fragment shader a world-space
  normal for free.
- **The first spires were flat-topped black obelisks.** The width function held
  roughly constant and the top was chopped off with a hard clamp. Caught on the
  contact sheet, which is exactly what it is for. They taper to a point now.
- **The shared lighting and fog GLSL is now exported** from `view/materials.ts`
  rather than private to it. Vegetation must fog on precisely the same curve as
  the ground it stands on, and two fog implementations that agree today will
  disagree the first time one of them is tuned.

**Seen:** `--seed 7 --at 620 --time golden` is the closest the game has come to
the art target — dark shrub silhouettes scattered across a warm plain under a
violet sky. `--seed 3 --at 2400 --time noon` and `--seed 11 --at 900 --time
morning` show the same thing works in daylight against green.

**Next:** roadside furniture — guardrail, chevrons, telegraph poles. The
roadside still has no *near-field* speed cue: vegetation starts 7.5 m out
because a maintained verge is bare, so nothing sweeps past close to the car.
Telegraph poles are the classic answer and the reason every driving game since
1982 has had them.

---

## 2026-09-20 — Telegraph poles, and the road goes somewhere

**Built:** telegraph poles every 40 m with three wires strung between them.

The roadside had no **near-field** speed cue. Vegetation stands 7.5 m out and
further, because a maintained verge is bare — so nothing passed close to the
car, and something passing close is most of what makes speed *felt* rather than
read off a dial. Every driving game since 1982 has had these, for this reason.

- **Poles are billboards**, built exactly like the vegetation. A pole is a
  cylinder and a cylinder has the same silhouette from every angle, so real
  geometry would buy nothing.
- **Wires are line segments with a parabolic sag** between consecutive
  crossarms. A parabola is a close enough catenary at a 40 m span, and it is
  the sag that says "old road", not the exact curve.
- **The line stays on one side for the whole drive**, picked from the seed.
  A line that hopped the road would read as a glitch rather than as a detail.
- Poles are keyed on the absolute station index (`index % 10 === 0`), so a pole
  stays exactly where it was put however many times the window scrolls over it.

**Learned / noted:**

- **Thin vertical things need a minimum screen width.** A pole is ~0.18 m
  across. At 150 m that is a fraction of a pixel, and a silhouette cut with
  `discard` either vanishes or flickers as the sample point crosses it — the
  reason distant power lines shimmer in most games. The fix was already in the
  codebase: `fwidth` gives the uv covered by one pixel, which is how the road
  markings stay one pixel wide into the distance, so the post is simply never
  drawn narrower than that. Distant poles come out slightly too wide instead of
  disappearing, which is much the better error.

**Cost**, measured on the software rasteriser — absolute numbers mean nothing,
the differences do:

| Scene | p50 frame |
|---|---|
| Neither drawn | 172.4 ms |
| Vegetation only | 178.9 ms |
| Vegetation and roadside | 180.9 ms |

So vegetation is about 3.8% of frame time and the whole roadside about 1.2%,
against a baseline dominated by the full-screen sky shader — which a software
rasteriser punishes far harder than a phone will. Two extra draw calls, no
per-frame CPU work in either. Real numbers are a device question (Phase 6).

**Next:** guardrail and chevron signs. Chevrons are the more interesting: with
no HUD, a chevron is how a corner announces itself before you can see through
it — information the player needs, delivered as scenery rather than as UI.

---

## 2026-09-20 — Chevron signs, and a convention worth testing

**Built:** chevron signs on corners tighter than a 150 m radius.

These are the only advance warning the game gives the player, and they are
given as **scenery rather than as interface**. There is no HUD to tell you a
corner is tight (`01-design.md` §6), so the corner has to say so itself —
which is exactly what chevrons do on a real road. A sign on every bend would be
a sign on no bend, so the threshold matters more than the drawing does.

- Real oriented quads, not billboards. A sign that turned to follow the camera
  would still be readable from behind, which is the one thing a sign must not
  be. The plate faces back down the road at the driver coming into the corner.
- The plate, the chevrons, the dark border and the post are all one quad, drawn
  analytically in the fragment shader — no texture, and the post gets the same
  minimum-pixel-width guard the telegraph poles need.

**Learned / noted:**

- **The arrow direction was inverted, and it took a text dump to see it.** The
  `k` term that bends each band into an arrow had the wrong sign, so every sign
  pointed *out* of its corner rather than into it — worse than no sign at all,
  because it actively misleads. At the size a chevron plate occupies on screen,
  roughly twenty pixels, squinting at the screenshot could not settle it: the
  glyphs read as "«" or "»" depending on what you expected to see. Printing the
  shader's pattern function as ASCII, for both signs of the term, settled it in
  one go. **When a visual check is ambiguous, render the function as text.**
  This is the same lesson as the normals bug in Phase 1, arriving by a
  different road: diagnose from numbers, not from the picture.
- **The placement rule moved to `world/gen/signage.ts`.** Which side of the
  road a sign stands on and which way it points are facts about the road, not
  about how it is drawn, and they are facts that can be inverted silently —
  which had just happened. They are pure functions now, with
  `tests/signage.test.ts` pinning the convention down: the sign goes on the
  outside of the bend, the arrows point into it, and `side` is always the
  negation of `turn`. 206 tests.

**Seen:** `--seed 3 --at 1770` and `--seed 1 --at 520` are both approaches to
sub-60 m-radius corners, and the signs read correctly at both.

**Next:** guardrail where the ground falls away. After that Phase 3's remaining
items are all colour and post — grading, bloom, vignette, grain, height fog,
the moon — which is the end-production work the terrain palette was already
deferred into, so Phase 4 (the cockpit) is probably the better next phase.

---

## 2026-09-20 — Phase 4 opens: there is a car around you

**Built:** the render architecture the cabin needs, and a cabin blocked in.

The bottom half of the screen has been flat black since Phase 0. It could not
be anything else: the world is scissored to the aperture band, so cockpit
geometry added to the world scene would have been clipped to the windscreen
along with everything else.

**Decided:** ADR-0017 — the cockpit is a second pass, over the whole display,
on its own layer, with its own camera. The cockpit camera shares the world
camera's position and rotation every frame and differs only in projection: the
world's frustum extended to the screen edges and kept *centred on the aperture*
rather than on the screen, via `setViewOffset`. Both cameras then agree about
angular scale and about where straight ahead is, so the cabin and the road
share one horizon.

What landed with it:

- **A wheel that turns with your thumb.** Driven from `CarView.steerAngle` —
  the same number the tyres get — so the rim and the finger can never disagree,
  which is what ADR-0004 requires. Verified turning the right way: at 14.4° of
  steer into a right-hander the rim comes round about 75° clockwise.
- **A dash**, blocked in: one solid mass, far wider and deeper than the frame,
  with a darker band along its leading edge.
- **The cabin does not take `lookYaw`.** It is placed in the car's frame and
  the camera turns inside it, so entering a bend swings the cabin across the
  view instead of rotating the interior with the camera. `ViewState.lookYaw`
  has carried a comment specifying exactly this since Phase 0 and nothing had
  implemented it until now.

**Learned / noted:**

- **`autoClear` has to go off.** three.js clears at the start of every `render`
  call, so the second full-viewport pass wiped the world. Caught immediately,
  but it is the kind of thing that looks like the cockpit failing to draw.
- **The eye position moved into the contract.** The cabin has to sit exactly
  where the camera is, and both `render/` and `cockpit/` needed the seat offset
  and eye height to work it out. `ViewState` now carries `eyeX/eyeY/eyeZ`,
  written by `render/`, which owns the camera and therefore owns the answer.
  That also fixed a doc bug: `ViewState.x/y/z` has been commented as the eye
  position since Phase 0 and has always been the car's.
- **A thin plate reads as furniture.** The dash was first built the way you
  would model it — a shelf and a separate face — and from the driver's seat you
  could see the underside of the shelf and the edge where it stopped. It read
  as a table. One solid mass, oversized in every direction so no edge is ever
  in shot, reads as a car. The same thing then happened again with the binnacle
  hood, which is a thin plate with two cheeks: one cheek in frame, and it was a
  table with a leg.
- **So the binnacle was built and then removed.** A hood only makes sense with
  dials under it to be hooded, and shipping it empty made the cabin worse.
  Its dimensions are still in `tuning.ts` and are the thing to distrust when it
  comes back: 0.62 m across at 0.6 m from the eye subtends nearly
  three-quarters of the screen, about twice what it should be.
- **The cabin cannot be authored at life size.** The field of view is
  deliberately much wider than a real windscreen subtends (ADR-0009), so a
  physically correct dash and wheel come out enormous. Every length in
  `cockpit/tuning.ts` was found by putting the thing on screen and moving it,
  not by measuring a car. That is the right way round for a stage set, and it
  is worth saying out loud so nobody later "corrects" the numbers to real ones.

**Honestly:** the cabin is blocked in, not designed. It is flat red boxes with
one light on them, there are no dials, and the shapes want the owner's eye far
more than mine — the art target shows the interior, and the whole point of
`cockpit/tuning.ts` is that a styling pass is a diff to one file.

**Cost:** 7 draw calls and 836 triangles for the entire frame, cabin included.

**Next:** the dials, and the contract that lets the cabin know what time of day
it is. `world/gen/daylight.ts` already computes `instrumentGlow` for exactly
this and the cockpit cannot see it; that seam is the interesting design
question in this phase.

---

## 2026-09-20 — The cabin is lit by the same sun as the road

**Built:** the `daylight` contract, and the cabin consuming it.

The cabin shipped lit by a fixed lamp, which looks wrong the moment the road
outside turns orange — and the art target is precisely a car interior lit by a
sunset. `world/gen/daylight.ts` has computed the sun's colour, the ambient fill
and an `instrumentGlow` value since Phase 3, and `cockpit/` could not see any
of it, because domains do not import one another.

- **`contracts/daylight.ts`** — phase, sun direction, key and fill colours, how
  much daylight there is, and how much the instruments ought to be lighting
  themselves. `world/` provides it; it is the fourth service, and the first new
  one since Phase 1.
- **The service is a live view, not a copy.** Getters onto the same palette
  object the sky is drawn from, so a consumer reading it during `frame()` sees
  this frame's values and there is nothing to keep in step.
- **The cabin transforms the sun into its own frame** before lighting itself,
  so driving into a sunset lights the dash from the front and turning away from
  it drops the cabin to ambient. The sun is held just above the cabin's
  horizontal — once it sets, an interior should fall to ambient rather than
  start being lit from under the floorpan, which is the same guard the terrain
  already uses.
- **The key fades with the daylight, not with the sun's height**, so the cabin
  dims through dusk instead of snapping dark the instant the disc drops.

**Learned / noted:**

- **`Rgb` was about to exist twice.** The palette had its own and the contract
  needed one. `world/gen/daylight.ts` now re-exports the contract's. Two
  subtly different notions of a colour is exactly the kind of thing that is
  invisible until a conversion goes missing somewhere.
- **The cabin's rotation order was wrong and had not shown yet.** `Object3D`
  defaults to XYZ and the camera uses YXZ. With any roll or pitch those are
  different rotations, so the cabin would have drifted against the view
  whenever the body leaned — visible only in motion, which is to say invisible
  to the screenshot harness. Found by reading the code while wiring the sun
  transform, not by looking at a picture.
- **An interior is much darker than a sunlit exterior, and should be.** The
  cabin came out considerably dimmer once the key was a real colour multiplied
  by a real strength rather than an implicit white. That is correct, and it
  silhouettes the wheel rim against the dash properly for the first time.

**Seen:** at golden hour the dash is a deep red-brown and the alloy spokes go
violet-warm with the sky; at noon the leading edge is bright and the mass falls
away into shadow beneath it.

**Next:** the dials. `daylight.instrumentGlow` is now reachable and nothing
reads it, so the cabin goes black at night — which is the one time of day the
instruments are supposed to be the brightest thing in the car.

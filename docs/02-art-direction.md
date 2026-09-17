# 02 — Art Direction

*Last updated: 2026-09-17*

## The look in one line

Stylised low-poly geometry, lit and graded like a photograph. Beauty comes
from light, atmosphere and composition — not from polygon count or texture
resolution.

## Principles

1. **Flat-shaded forms, cinematic light.** Simple silhouettes carry the
   shapes; the sky, fog and sun do the emotional work.
2. **Few colours, held firmly.** Each biome/time pairing gets a palette of
   about six colours. Everything in frame is drawn from it. Consistency of
   palette is what makes low-poly read as "designed" rather than "cheap".
3. **Atmosphere is a first-class object.** Fog is not a draw-distance hack —
   it is the main depth cue and the main mood control. Its colour always
   derives from the sky in the view direction, never a fixed grey.
4. **Nothing pure black, nothing pure white.** Shadows carry the sky's colour.
   Highlights carry the sun's. This one rule does more for "looks good" than
   any amount of geometry.
5. **Silhouette over detail.** At the distance things are actually seen, a
   tree is a shape against a sky. Spend effort on the shape.

## The portrait problem, and the solution

Portrait was chosen deliberately (ADR-0006) for one-handed, in-bed
ergonomics. It is a genuinely awkward frame for a road disappearing toward a
horizon, so the framing is designed rather than inherited:

```
┌─────────────────┐  ← 9:19.5 portrait (412×915 CSS px shown)
│ ░ mirror  dist ░│   5%   header strip: rear-view mirror, distance readout
├─────────────────┤
│                 │
│                 │
│    the world    │  46%   THE WINDSCREEN — the only band the 3D world is
│   ╲         ╱   │        drawn into. Roughly square on a typical phone.
│    ╲_______╱    │        A-pillars cut the top corners.
├─────────────────┤
│  ○   ◉   ○      │  15%   dash top + five-dial binnacle, big tach centre
├─────────────────┤
│    ╭───────╮    │  34%   the wheel — rim crosses the lower screen, hub and
│    │   ╳   │    │        spokes visible, bottom of the rim off-screen
└────┴───────┴────┘
```

Live values are in `VIEW` in `src/sim/tuning.ts`. Phase 4 finalises them
against the real cockpit geometry.

Key decisions that make this work:

- **The windscreen gets the space; the dash gives it up.** The binnacle sits
  *behind* the wheel in the real car, so the dials can overlap the top of the
  wheel band rather than needing a tall strip of their own. That frees the
  dash band down to 15% and hands the difference to the view, which is
  pillar #2.
- **Field of view is specified horizontally (72°), not vertically.** See
  ADR-0009 for why horizontally. The value is deliberately exaggerated: a
  physically honest FOV for a phone at arm's length is about 25°, which looks
  like driving through a telescope and destroys any sense of speed. 72°
  is where the road starts to move. Shot against 60° and 84° — 84° visibly
  distorts at the frame edges and flattens the horizon, 60° is calmer but
  reads slower.
- **The view leads the car into corners** (ADR-0010). The camera yaws toward
  the road ahead, so you look *through* a bend instead of at the outside of
  it. Partway only — a view fully aligned with the road ahead would pin the
  road to the centre of the frame and the corner would stop reading as a
  corner.
- **Horizon sits at 62% of the aperture height.** More sky than road. Sky is
  where the mood is. Implemented as a camera pitch offset, so it is free.
- **The wheel's bottom is off-screen.** We see the top of the rim and the
  spokes. Showing the whole wheel would waste a third of the display on the
  inside of a car.
- **The dash is never a flat overlay.** It's real geometry on the same camera,
  so it pitches and rolls with the body. That parallax between dash and world
  is a large part of why the lean will feel physical.

## The car interior

A recognisable early-1970s air-cooled sports car cabin. Shape and layout only
— no badges, no marque names, no model numbers, anywhere (see non-goals).

### What defines the look

| Element | Treatment |
|---|---|
| **Dash** | Flat, horizontal, black textured vinyl. Almost no curvature — this is the period tell. A shallow cowl hoods the dials. |
| **Instruments** | **Five overlapping round dials**, tach dead centre and largest, speedo to its right, oil/fuel/clock to the sides. Black faces, white numerals, thin white needles with orange tips. This layout *is* the car. |
| **Steering wheel** | Thin-rimmed, ~380 mm, three flat spokes meeting a small centre hub, slightly dished toward the driver. Black leather rim with visible stitching along the inner edge. Riveted spokes. |
| **Column & stalks** | Black column shroud, two thin chrome-tipped stalks. |
| **Centre console** | Minimal. Three vertical toggle/slider heater levers, a gear lever with a black ball knob and a thin chrome shaft. |
| **Doors / A-pillars** | Black vinyl pillars, thin. Visible door card edge and window rubber at the frame edges. |
| **Mirror** | Small rectangular rear-view on a short stalk, top centre. Shows a simple receding-road reflection (cheap render-to-texture or a faked gradient + moving road lines — decide in Phase 4). |
| **Materials** | Everything is black. Differentiation comes entirely from *finish*: matte vinyl dash, semi-gloss leather rim, brushed aluminium spokes, glass dial covers with a moving specular streak. |

### Why "everything is black" is an asset, not a problem

A black interior means the cabin is almost a silhouette, which:

- costs nearly nothing to render,
- never fights the landscape for attention,
- and reacts beautifully to time of day — at dusk the dash is a black shape
  against an orange sky; at night it's lit only by the green-orange dial
  glow. The cabin becomes a mood instrument for free.

### Dial illumination

Gauges are backlit with a warm amber-green glow that comes up as the ambient
light falls. At night this is the only interior light source and it should
spill faintly onto the wheel rim and the driver's side of the dash. This is
the single most evocative detail in the whole game and is worth real effort in
Phase 4.

## Biomes

Seamless blending over distance (ADR-0006). Each biome is a *parameter set*,
not a level — so blending is just interpolating numbers and cross-fading prop
spawn tables.

| | **Mountain** | **Desert** | **Country** |
|---|---|---|---|
| Terrain | Steep, layered ridges, exposed rock | Broad flats, mesas, dunes | Rolling, soft, hedged fields |
| Palette | Slate blue, pine green, cold grey | Ochre, rust, pale sand, dusty pink | Olive, wheat gold, warm green |
| Road | Narrow, dark tarmac, armco, rock cuttings | Wide, pale sun-bleached, no barriers | Mid-width, patched, hedgerows |
| Curvature | High — sweepers and hairpins | Low — long straights, gentle arcs | Medium — constant gentle bends |
| Grade | Steep, frequent crests | Near-flat, long grades | Gentle undulation |
| Fog | Dense, cool, blue | Thin, warm, heat-haze shimmer | Medium, soft, golden |
| Props | Pines, boulders, guardrail, snow poles, tunnels | Cacti, scrub, mesas, telegraph poles, road signs | Oaks, hedges, fences, barns, hay bales |
| Sky | High cloud, dramatic | Vast, cloudless, gradient | Soft cumulus |

**Transitions** run over ~4–6 km of driving, driven by a slow noise over
distance, so you are usually somewhere between two biomes. The in-between
states (pine giving way to scrub, hedges thinning into dust) are often the
best-looking part and should be treated as destinations, not as transitions to
get through.

## Time of day

One full cycle is ~25 minutes of driving. It runs continuously and
independently of the biome cycle, so the combinations are never the same twice.

| Phase | Sky | Sun | Fog | Interior |
|---|---|---|---|---|
| Dawn | Cold violet → peach | Low, warm, long shadows | Thick, blue, ground-hugging | Dials fading down |
| Morning | Clean blue gradient | High, neutral, crisp | Thin | Dials off |
| Afternoon | Warm blue, haze | High, slightly warm | Medium, warm | Dials off |
| Golden hour | Amber → rose → indigo | Very low, very warm, rim-lighting everything | Thick, golden, volumetric | Dials coming up |
| Dusk | Deep orange band under indigo | Below horizon, sky-glow only | Deep, cool | Dials warm, cabin mostly dark |
| Night | Near-black blue, stars, moon | Moon key light, very dim | Deep, headlight cone reads | Dials the only light; headlight wash on the road |

Night is the hardest and the most rewarding. Budget real time for it in Phase 7
rather than trying to get it right in Phase 3.

## Rendering approach — hybrid 3D / 2.5D

Per ADR-0003:

- **Real 3D:** road surface, verges, near terrain, the car interior, traffic,
  near props (out to ~120 m).
- **Billboarded / impostor:** mid and far vegetation and rocks, and all distant
  mountain silhouettes (layered parallax cards at 3–4 depths).
- **Why it works here:** the camera never leaves the road and never looks
  behind itself, so the parallax error that normally gives billboards away is
  nearly unobservable. We get a dense-looking world for a fraction of the cost.
- **The seam to watch:** the transition where a 3D near tree becomes a
  billboard. Handle with a short cross-fade band, and keep near-tree geometry
  deliberately flat-ish so the swap isn't a silhouette change.

## Post-processing

Subtle, and always in service of "photograph, not render":

- Filmic tonemapping (ACES-ish), on from day one — this alone is most of the
  difference between "looks like a game" and "looks good".
- Slight bloom, thresholded high, so only the sun and the dial glow bloom.
- Vignette, gentle.
- Fine dithered grain, animated — hides banding in the sky gradients, which
  is otherwise the #1 visual flaw of this kind of game on a phone.
- Per-biome/per-time colour grading as a simple lift/gamma/gain.
- Radial blur at the frame edges above ~140 km/h, very subtle.

**Not used:** SSAO (too costly, little benefit on flat-shaded forms), screen
space reflections, depth of field, motion blur, chromatic aberration except
as the brief collision shudder.

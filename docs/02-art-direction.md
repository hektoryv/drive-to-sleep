# 02 — Art Direction

*Last updated: 2026-09-20*

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
│                 │
│                 │
│    the world    │  61%   THE WINDSCREEN — the only band the 3D world is
│   ╲         ╱   │        drawn into. Sky reaches the top edge.
│    ╲_______╱    │        A-pillars cut the top corners.
├─────────────────┤
│  ○   ◉   ○      │  11%   dash top + five-dial binnacle, big tach centre
├─────────────────┤
│    ╭───────╮    │  28%   the wheel — rim crosses the lower screen, hub and
│    │   ╳   │    │        spokes visible, bottom of the rim off-screen
└────┴───────┴────┘
```

Live values are in `VIEW` in `src/render/tuning.ts`. Phase 4 finalises them
against the layered cockpit art.

Key decisions that make this work:

- **The windscreen gets the space; the dash gives it up.** The binnacle sits
  *behind* the wheel in the real car, so the dials can overlap the top of the
  wheel band rather than needing a tall strip of their own. That frees the
  dash band down to 11% and hands the difference to the view, which is
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
- **Horizon sits at 68% of the aperture height.** More sky than road. Sky is
  where the mood is. Implemented as a camera pitch offset, so it is free.
- **The wheel's bottom is off-screen.** We see the top of the rim and the
  spokes. Showing the whole wheel would waste a third of the display on the
  inside of a car.
- **The dash is layered rather than monolithic.** Roof shell, near-horizontal
  scuttle, vertical dashboard, angled driver's door, shadows and wheel occupy
  separate cards in the cockpit pass. Their local angles create real depth;
  depth-weighted lateral offsets preserve look-ahead parallax (ADR-0019).

## The car interior

A recognisable early-1970s air-cooled sports car cabin. Shape and layout only
— no badges, no marque names, no model numbers, anywhere (see non-goals).

### What defines the look

| Element | Treatment |
|---|---|
| **Dash** | Red upholstered top over a dark instrument face. Almost no curvature — this is the period tell. A shallow cowl hoods the dials. |
| **Instruments** | **Five overlapping round dials**, tach dead centre and largest, speedo to its right, oil/fuel/clock to the sides. Black faces, white numerals, thin white needles with orange tips. This layout *is* the car. |
| **Steering wheel** | Thin-rimmed, ~380 mm, three flat spokes meeting a small centre hub, slightly dished toward the driver. Black leather rim with visible stitching along the inner edge. Riveted spokes. |
| **Column & stalks** | Black column shroud, two thin chrome-tipped stalks. |
| **Centre console** | Minimal. Three vertical toggle/slider heater levers, a gear lever with a black ball knob and a thin chrome shaft. |
| **Doors / A-pillars** | Dark vinyl pillars against red door cards. Visible window rubber at the frame edges. |
| **Mirror** | Small rectangular rear-view on a short stalk, top centre. Shows a simple receding-road reflection (cheap render-to-texture or a faked gradient + moving road lines — decide in Phase 4). |
| **Materials** | Red upholstery frames a dark instrument panel. Differentiation also comes from *finish*: matte vinyl dash, semi-gloss leather rim, brushed aluminium spokes, glass dial covers with a moving specular streak. |

### Why the dark instrument panel is an asset

The dark centre means the working part of the cabin is almost a silhouette,
while the red perimeter catches the sunset (ADR-0014). This:

- costs nearly nothing to render,
- never fights the landscape for attention,
- and reacts beautifully to time of day — at dusk the dash is a black shape
  against an orange sky; at night it's lit only by the green-orange dial
  glow. The cabin becomes a mood instrument for free.

### Dial illumination

Gauges are backlit with a restrained warm red/amber glow that comes up as the ambient
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

One full cycle is ~25 minutes of driving, running continuously and
independently of the biome cycle, so the combinations are never the same twice.

**Built.** Ten keyframes in `world/gen/daylight.ts`, each about a dozen
colours, blended with smootherstep. One phase value drives the sun's position
and every colour in the world — sky, fog, ambient, the light on the terrain,
the distant ranges, and from Phase 4 the dashboard. Nothing else decides what
colour anything is, which is what stops them drifting apart.

| Moment | Phase | Character |
|---|---|---|
| Midnight | 0.00 | Near-black blue, stars out, instruments the only light |
| Pre-dawn | 0.19 | First violet, a rose band low down |
| Dawn | 0.25 | Sun on the horizon, peach against cold violet |
| Morning | 0.34 | Clean, cool, crisp |
| Noon | 0.50 | Blue gradient, pale horizon, thin fog |
| Afternoon | 0.66 | Warming, haze building |
| **Golden** | **0.735** | **The art target.** Sun ~2° up, violet zenith, orange horizon |
| Sunset | 0.75 | Sun exactly on the horizon |
| Dusk | 0.79 | Sun below, deep orange band under indigo |
| Twilight | 0.86 | Rose remnant, first stars |

Shoot the whole day at once with `npm run shoot -- --sheet`. That sheet is the
one that matters most: it shows whether the keyframes actually join up.

Night is still the hardest. Headlights, the moon as a key light and the
headlight cone are Phase 7, not Phase 3.

## Rendering approach — hybrid 3D / 2.5D

Per ADR-0003:

- **Real 3D:** road surface, verges, near terrain, traffic and near props (out
  to ~120 m).
- **Layered 2.5D:** the cockpit card model — shell, horizontal dash top,
  vertical dash, angled door, shadows and wheel in the second camera pass
  (ADRs 0018–0019).
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

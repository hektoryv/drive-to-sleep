# Drive to Sleep — Godot handoff

This document is the standalone brief for rebuilding the project in Godot. It
describes the intended game, the procedural environment model from the Three.js
prototype, what worked in device testing, and what should **not** be ported
unchanged.

## 1. The goal

Build a calm, endless, portrait-orientation driving game for Android. The
player is inside a recognisable early-1970s sports-car cockpit, driving a
procedurally generated road through mountain, desert and country regions while
the time of day changes continuously.

The experience should feel like taking an atmospheric drive, not completing a
race:

- one-finger driving with no conventional on-screen joystick;
- predictable arcade handling with convincing body roll, pitch and road feel;
- a beautiful road worth following, with straights, sweepers, hairpins, crests
  and dips rather than undirected noise;
- large, legible environmental compositions around that road;
- changing light, weathered materials and strong silhouettes;
- no ads, analytics, network requirement, permissions, energy systems or
  aggressive scoring;
- a stable 60 fps on a mid-range Android phone.

The car interior should evoke a 1970s air-cooled sports car through its red
upholstery, five overlapping dials and thin three-spoke wheel, but must contain
no badges, marques or model names.

The project is moving to Godot because the owner wants more performance
headroom and direct access to the engine's terrain, physics, asset and template
ecosystem. The Three.js version is a design and systems prototype, not an
implementation that has to be preserved line for line.

## 2. What the owner has validated

The following parts of the prototype were played on a phone and received
positive feedback:

- The road itself and the driving feel are good.
- Adding real road elevation and a named maximum grade was a major improvement.
- Large-scale asymmetric landscapes were a major improvement over the original
  flat ribbon.
- A road with a wall/cutting on one side and an exposed drop, guardrail and lake
  on the other is the correct composition.
- The same mountain-scale verticality may occur in country regions; mountains
  are not exclusive to the biome named `mountain`.
- Desert canyons and mesas are appropriate equivalents.
- A temporary invisible wall 2 m beyond each changing tarmac edge works well
  and prevents the player falling through unfinished scenery.
- The compact FPS/performance display works well. The test phone holds its
  display-synchronised 60 fps almost continuously, so there is useful headroom.

The following was **not** successful enough:

- Increasing terrain cross-section samples, alternating triangle diagonals,
  adding small crag displacement and subtle procedural rock colour did not
  produce a clearly noticeable difference while driving.
- The environment still reads too often as one broad homogeneous hill.
- Numerically denser terrain is not the same as perceptibly more detailed
  terrain. Do not treat vertex count as the visual goal.

The next version needs bolder, unmistakable near-field structure: actual rock
slabs, cut faces, shelves, ledges, boulder clusters, material boundaries and
silhouette changes close enough to sweep past the car. Use Godot assets and
modular authored pieces where they outperform procedural noise.

## 3. Core generator model

The most valuable part to preserve is the coordinate model.

### Road coordinates

The world is generated in road space:

- `s`: arc length along the road centreline in metres;
- `t`: signed lateral distance from the centreline in metres, positive right;
- `x, y, z`: integrated world position, with `y` up.

Terrain, water, guardrail and prop placement are functions of `(seed, s, t)`.
Working in road coordinates guarantees that terrain joins the road and makes
left/right compositions straightforward. The simulation sees the road through
a small query API: sample the road at `s`, convert world position back to
`(s,t)`, ask for surface type, and ask for ground height.

### Determinism

The seed and distance must reproduce the same road, biome, landscape and prop
placement every time. This makes a bad location shareable as “seed N at S km”,
allows deterministic resume points and makes visual regression useful.

Use separate seed offsets/streams for curvature, grade, width, biome,
landscape side, props and materials so changing one system does not correlate
or unnecessarily reshuffle the others.

### Road fields

The road begins as continuous scalar fields over `s`, then is integrated into
centreline stations.

| Field | Prototype behaviour |
|---|---|
| Curvature | fBm at 340 m scale, 3 octaves, nominal peak `1/250 m`; sign-preserving exponent `0.62` pushes values away from endless near-straights |
| Grade | fBm at 900 m scale with `0.075` amplitude, plus a 2.6 km field at `0.032` amplitude |
| Maximum grade | Hard clamp at `±0.14`, i.e. 14% |
| Half-width | 3.6 m plus slow `±0.7 m` variation over 1.3 km |
| Bank | Proportional to curvature, capped at 6 degrees |

The generated centreline is sampled every 4 m. Each station stores world
position, unwrapped heading, curvature, grade, bank and road half-width.
Heading and elevation are integrated forward using the mean heading over the
step. The first part of every seed is forced calm so a new drive does not begin
inside a correction.

### Authored road events

Pure noise creates an unmemorable sequence of medium bends. The prototype
therefore overlays deterministic authored events approximately every 620 m,
with ±260 m spacing jitter and 90 m easing at each end:

- straights: 30%, 180–340 m;
- sweepers: 28%, 240–420 m;
- crests: 16%, 90–150 m;
- hairpins: 14%, 55–95 m;
- dips: 12%, 90–150 m.

These events are the highest-leverage part of the road generator. Keep the
idea even if Godot's spline implementation is different. A good road should
have rhythm and anticipation, not merely smooth randomness.

## 4. Biomes and kilometre-scale composition

### Biome regions

The prototype chooses one of three biome parameter sets per 5.6 km cell and
blends into the new cell over 1.4 km. A cell may choose the same biome as its
neighbour, naturally producing a longer region.

The biome weight affects terrain palette, exposed rock, shoulder/verge colour,
plant density, plant size, prop types, water colour and distant silhouettes.
The transition should be a real mixed environment, not a loading corridor.

The initial categories are:

- **Mountain:** tall cold ridges, pines, rock cuttings, exposed shelves and
  lakes.
- **Desert:** ochre/rust terrain, sparse cactus and scrub, canyons, broad dry
  basins and mesas.
- **Country:** olive/wheat terrain, softer vegetation, lakes and valleys—but
  still allowed to contain substantial mountain-scale landforms.

### Landscape cells

Fine terrain noise cannot compose a view. A second deterministic layer divides
the road into 1.32 km landscape cells. Each cell fades to neutral terrain
across 190 m at both ends, then chooses a deliberate left/right composition.

The left and right sides are intentionally asymmetric. A seed hash decides
which side is open; another decides the composition:

- **Mountain:** usually an exposed shelf, optionally with a lake, facing a
  122 m rising wall; occasionally an asymmetric pass with both sides rising.
- **Desert:** usually a 54 m dry-basin drop opposite a 92 m canyon wall;
  otherwise both sides rise at unequal heights.
- **Country:** a 36 m lake/valley drop or gentler 15 m open valley opposite a
  54 m wall.

Prototype landmark values:

| Parameter | Value |
|---|---:|
| Mountain open-side drop | 92 m |
| Mountain closed-side wall | 122 m |
| Mountain pass wall | 92 m |
| Desert drop / wall | 54 m / 92 m |
| Country drop / wall | 36 m / 54 m |
| Mountain lake probability | 46% |
| Country lake probability | 28% |

These are composition targets, not sacred Godot constants. Their purpose is
to make the road sit *inside* a place rather than on top of a noisy carpet.

## 5. Terrain profile used in the prototype

The prototype sweeps a terrain cross-section along the same road stations.
Terrain height is evaluated in road coordinates, so its inner edge cannot
intersect the road.

1. Base terrain sits 0.45 m below the road.
2. It remains calm through a 7.5 m flat margin.
3. Ordinary relief blends in over the next 24 m.
4. A landscape rise or drop begins about 8.5 m from the centreline.
5. Open sides establish 76% of their final drop within 15 m, producing a clear
   exposed edge suitable for guardrail.
6. Rising sides use two nominal faces: an 11 m first face, a 6 m ledge, then a
   17 m second face. Together they establish 27% of the total wall height; the
   remaining height develops toward the far edge.
7. Large-scale wall/drop height is modulated by slow 390 m noise. Independent
   left and right noise prevents mirror symmetry.
8. Short-scale crag displacement exists only on the close rising side.

The last prototype mesh sampled each side at these lateral offsets:

```text
6, 7.5, 9, 11, 14, 18, 23, 29, 37, 48, 62, 82,
108, 142, 188, 248, 308, 360 metres
```

This concentrates geometry near the road and leaves broad triangles under the
far haze. Triangle diagonals alternate and face normals are used for a faceted
look. This is useful reference, but **it was still visually too homogeneous**.
In Godot, prefer a chunked base terrain plus strongly authored near-road cliff
modules, scatter assets, decals/material layers and appropriate LOD. The
mathematical heightfield should establish composition; it should not be asked
to create every memorable rock face.

## 6. Water, roadside and distant depth

### Lakes

Mountain and country lake cells contain horizontal 3D water. The prototype
starts the visible shore 46 m from the road and extends it nearly to the 360 m
terrain edge. Each cell's water plane is 16 m below its lowest road station,
and terrain under it is forced lower so it cannot poke through. The road-facing
edge should be hidden by the terrain drop and guardrail, not look like a
rectangular plane.

### Guardrail

Guardrail is generated from terrain rather than placed everywhere. For every
road side, sample ground about 18 m beyond the rail; generate protection where
the sustained drop exceeds roughly 1.65 m. Join very short gaps and reject
short isolated fragments so the result reads like an engineered run rather
than threshold noise.

### Vegetation and props

The prototype uses one billboard population for middle-distance vegetation and
real faceted stones near the road:

- three plant candidates per 4 m station;
- cover varies in broad 260 m clumps between about 6% and 62%;
- vegetation occupies roughly 7.5–90 m from the centreline;
- biome weights change density, height and silhouette tables;
- close stones spawn between 7.2 and 22 m, but only at 20% of candidates.

This population is too restrained for the desired next pass. Godot should use
`MultiMeshInstance3D` or an equivalent batched/instanced system for boulders,
trees, shrubs, posts and cliff dressing, with density controlled by a runtime
tuning resource.

### Distant ranges

The prototype uses four biome-shaped silhouette layers from approximately
1.4–5.2 km. Mountain layers are tall and serrated, desert layers become
stepped mesas, and country layers are lower hills. They wash progressively
toward the sky/fog colour. In Godot these can remain cheap meshes, impostors or
skyline cards; close/middle mountains that the player can meaningfully judge
must remain real 3D.

## 7. Streaming and precision

The prototype keeps 13 road chunks alive: two behind, ten ahead and the current
chunk. A chunk is 128 stations × 4 m, approximately 512 m, for a 6.6 km live
window. Geometry buffers are rebuilt when the generated window advances by
one chunk.

World-space centreline positions are retained at high precision, while render
vertices are rebased near the car before being sent to the GPU. The Godot
version should use chunk-local coordinates and/or floating-origin rebasing so
an endless drive does not develop jitter.

Godot does not need to preserve the single-mesh strategy. Chunked terrain and
road meshes are likely a better fit for frustum culling, threaded generation,
collision ownership and LOD, provided seams are deterministic and invisible.

## 8. Atmosphere and rendering target

The intended look is stylised low-poly illustration rather than realism:

- coherent limited palettes per biome/time pairing;
- strong silhouettes and readable colour blocks;
- coloured shadows and highlights—nothing pure black or pure white;
- distance and height fog as major depth/mood controls;
- real 3D road, nearby terrain and nearby props;
- cheaper representation for far vegetation and distant ranges;
- a continuous roughly 25-minute day/night cycle, with golden hour as the
  primary visual target.

The Three.js renderer used subtle procedural soil mottling and world-space rock
strata without texture assets. This was cheap but too subtle. The Godot version
should use proper reusable rock/ground materials, normal detail, decals and
asset variation where they visibly improve close surfaces. Do not add detail
that disappears under fog, speed or the cockpit framing.

The last measured representative scenes were around 41 draw calls and
145–149k triangles. The target phone held 60 fps. These figures are reference,
not a mandate; Godot should establish its own profiler-driven budgets.

## 9. Collision and road containment

Until falling/crash recovery exists, keep an invisible vertical boundary 2 m
beyond each current tarmac edge. It follows road width and curvature. On
contact, project the car back to the boundary and remove only the velocity
pointing through it, preserving velocity along the wall. This makes shallow
scrapes non-destructive and was approved in device testing.

In Godot this can be implemented as generated static collision segments, or as
a deterministic road-space constraint in the car controller. A road-space
constraint is cheaper and avoids gaps between physics segments, while physical
colliders may integrate more naturally with a standard vehicle template.

## 10. Required live tuning menu

Before the next major environment pass, add an in-game developer tuning menu.
The owner explicitly wants to tune on the target phone while watching FPS,
frame time, draw calls and visible complexity.

Recommended controls:

- terrain/render distance and chunk count;
- near, middle and far LOD distances;
- terrain cross-section/subdivision density;
- vegetation, boulder and cliff-dressing density;
- cliff height, start distance, face steepness, ledge width and ledge count;
- open-side drop and lake distance;
- crag/noise amplitude and scale;
- rock/soil material contrast and detail scale;
- fog distance and height-fog strength;
- biome override, seed, time of day and jump-to-landscape-cell;
- render scale and quality preset.

The menu should pause driving while open and provide:

- **Apply/rebuild** for geometry-affecting values;
- **Reset defaults**;
- **Save/load preset**;
- **Copy settings as JSON**, so the owner can send an exact successful setup
  back to the agent.

Use typed Godot `Resource` objects or an equivalent central configuration,
not constants scattered through generator scripts. Clearly label whether a
control updates immediately, rebuilds visible chunks, or restarts the road.
Road curvature/grade changes should restart the drive to avoid seams and
simulation disagreement; material and fog parameters may update live.

## 11. Recommended Godot translation

Preserve concepts, not Three.js structures:

1. A deterministic `RoadGenerator` produces stations or a `Curve3D` from
   `(seed, s)` fields plus authored road events.
2. A read-only road query/controller API exposes pose, width, grade, surface
   and world/road coordinate conversion.
3. A chunk manager owns road mesh, terrain mesh, collisions and spawned assets
   for a bounded window around the car.
4. Terrain chunks use the road profile for guaranteed joins, then attach or
   blend strongly authored cliff/canyon modules on selected sides.
5. Landscape cells choose compositions such as `lake_shelf`, `rock_pass`,
   `desert_canyon` and `country_valley`; biomes choose the assets/materials
   used to realise them.
6. `MultiMeshInstance3D`, visibility ranges and engine LOD/HLOD systems carry
   repeated props instead of hand-building every object into one buffer.
7. A floating origin or chunk-local coordinate system protects long drives.
8. A developer tuning resource/menu is present from the start, not added after
   the generator has become difficult to change.

The first Godot milestone should not be “port every system.” It should be one
excellent, deterministic 2–3 km mountain/lake composition with the road,
guardrail, a close rock cutting, an open lake side, strong middle-distance 3D
mountains, the safety boundary and the live tuning menu. Once that scene is
visibly right and holds 60 fps on the phone, generalise it into the three
biomes and endless chunk stream.

## 12. Source map in the prototype

If implementation details are useful, these are the relevant reference files:

- `src/world/gen/fields.ts` — curvature, grade, width and bank fields;
- `src/world/gen/events.ts` — authored road-event grammar;
- `src/world/gen/stations.ts` — integration, ring buffer and coordinate conversion;
- `src/world/gen/biomes.ts` — deterministic biome blending;
- `src/world/gen/landscape.ts` — asymmetric kilometre-scale compositions;
- `src/world/gen/terrain.ts` — road-relative terrain height;
- `src/world/view/terrain-mesh.ts` — swept terrain mesh;
- `src/world/view/water.ts` — lake surfaces;
- `src/world/view/roadside.ts` — poles, wires, chevrons and guardrail;
- `src/world/view/vegetation.ts` and `near-props.ts` — population systems;
- `src/world/view/ridges.ts` — distant biome-dependent ranges;
- `src/world/tuning.ts` — current values;
- `docs/00-vision.md`, `01-design.md` and `02-art-direction.md` — full product context.

The final Three.js review branch is `codex/environment-detail-pass`. Its last
playable environment commit is `1c58c99`, followed by APK workflow/documentation
commit `14c00a0`.

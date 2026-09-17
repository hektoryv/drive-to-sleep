# 03 — Architecture

*Last updated: 2026-09-17*

## The one rule

> **`sim/` must never import from `render/`.**

The simulation is pure: seed in, state out, no WebGL, no DOM, no three.js. The
renderer reads simulation state and draws it.

This is enforced by a lint rule, and it buys:

- the whole vehicle model and world generator are testable in plain Node,
- handling can be tuned and regression-tested without a GPU,
- deterministic replay from a seed for debugging "that corner felt wrong".

Everything else in this document is negotiable. This isn't.

## Module map

```
src/
├─ main.ts                  bootstrap, canvas, orientation lock, resize
│
├─ core/                    no dependencies on anything below
│  ├─ loop.ts               fixed-step accumulator + interpolation alpha
│  ├─ rng.ts                seeded PRNG + hash-based value/gradient noise
│  ├─ math.ts               vec2/vec3, spring-damper, easing, clamp, lerp
│  ├─ events.ts             tiny typed event bus (sim → ui, sim → fx)
│  └─ storage.ts            localStorage wrapper (best distance, settings, resume point)
│
├─ input/
│  ├─ pointer.ts            raw touch/mouse → normalised offset from dynamic origin
│  └─ controls.ts           offset → { steer, throttle, brake } with curves + drift
│
├─ sim/                     PURE. no three.js, no DOM.
│  ├─ tuning.ts             ★ every magic number in the game lives here
│  ├─ vehicle.ts            the car: speed, yaw, grip, slide
│  ├─ attitude.ts           roll / pitch / heave springs
│  ├─ traffic.ts            AI car spawn, follow, despawn
│  ├─ collision.ts          capsule tests + impulse response
│  ├─ scoring.ts            distance, flow, overtakes
│  └─ world-query.ts        "what is the road doing at distance s?" — the sim's
│                           read-only view of the world
│
├─ world/                   generation. also pure — no three.js.
│  ├─ road.ts               curvature/grade/width fields over distance → stations
│  ├─ stations.ts           the sampled centreline; the shared coordinate backbone
│  ├─ chunks.ts             chunk lifecycle, ring buffer, recycling
│  ├─ terrain.ts            road-relative terrain ribbon heights
│  ├─ props.ts              deterministic prop placement per chunk
│  └─ biome.ts              biome weights over distance + parameter blending
│
├─ render/                  three.js lives here and nowhere else
│  ├─ renderer.ts           WebGLRenderer setup, tonemapping, resize, quality tiers
│  ├─ camera.ts             driver-eye rig; consumes attitude
│  ├─ sky.ts                gradient sky shader, sun, stars, moon
│  ├─ atmosphere.ts         fog colour derived from sky; height fog
│  ├─ road-mesh.ts          sweeps the cross-section along stations → geometry
│  ├─ terrain-mesh.ts       terrain ribbons
│  ├─ props-render.ts       instanced billboards + impostor mountain layers
│  ├─ traffic-render.ts     instanced traffic meshes
│  ├─ materials.ts          shared shaders, the palette uniform block
│  ├─ post.ts               tonemap, bloom, vignette, grain, grade
│  └─ debug.ts              wireframes, station markers, free-fly camera, stats
│
├─ cockpit/                 the 911 interior — its own module, it's that big
│  ├─ interior.ts           dash, pillars, console, door cards
│  ├─ wheel.ts              rim, spokes, hub; rotates with steer input
│  ├─ gauges.ts             five dials, needles, backlighting
│  └─ mirror.ts             rear-view
│
├─ ui/
│  ├─ hud.ts                distance, flow arc, overtake tally
│  └─ screens.ts            start, pause panel, drive summary
│
└─ fx/
   ├─ dust.ts               off-road particle wash
   └─ shake.ts              collision jolt → attitude spring impulses
```

## Coordinate systems

Three of them. Confusing them is the most likely source of bugs, so they are
named explicitly and conversions live in exactly one place (`world/stations.ts`).

| Space | Symbol | Meaning |
|---|---|---|
| **World** | `(x, y, z)` | Metres, y up. The car, traffic and camera live here. |
| **Road** | `(s, t)` | `s` = arc length along the centreline from the world origin, in metres. `t` = signed lateral offset from the centreline, in metres, positive right. Used for road queries, traffic, spawning. |
| **Screen** | `(px, py)` | Pixels. Input only. |

`world → road` is an approximate nearest-station search seeded by the previous
frame's `s` (it only moves a little per frame, so this is O(1) in practice).
`road → world` is exact interpolation between stations.

## The road: how endlessness actually works

The road is defined by three continuous scalar fields over distance `s`:

```
curvature(s)   1/radius, signed — layered noise + injected "events"
grade(s)       rise over run — slower, larger-scale noise
width(s)       metres — biome-driven, smoothed
```

Integrate `curvature` to get heading, integrate heading to get position.
Because it's all a pure function of `s` and the seed, **any point on the road
can be evaluated at any time without having generated what came before it** —
which is what lets us spawn traffic far ahead and keep everything deterministic.

**Stations** are the discretisation: the centreline sampled every 4 m, each
carrying position, heading, curvature, grade, bank, width and biome weights.
Every other system reads stations, never the raw fields.

**Events** are the anti-monotony mechanism. On top of the noise, the generator
injects hand-authored shapes at intervals — a hairpin, a long descending
sweeper, a crest with a blind corner behind it, a bridge, a straight with a
view. These are what make the road feel designed rather than random, and are
the highest-leverage place to spend tuning time.

**Chunks** are 128 stations (~512 m). A ring buffer of ~12 chunks is kept
alive: 2 behind, 10 ahead. Geometry is recycled — buffers are written in place,
never reallocated, so there is no GC churn while driving.

## Frame flow

```
    ┌──────────── fixed 120 Hz ────────────┐    ┌─── every frame ───┐

    input.sample()
        ↓
    controls.update()  ──→ { steer, throttle, brake }
        ↓
    world.ensureChunks(s)                              render.camera.update(α)
        ↓                                                     ↓
    vehicle.step(dt)  ←── world-query(s,t): grip, grade, bank  render.sky/atmos
        ↓                                                     ↓
    attitude.step(dt) ←── lateral/longitudinal accel      render.world
        ↓                                                     ↓
    traffic.step(dt)                                     render.cockpit
        ↓                                                     ↓
    collision.resolve()                                  render.post
        ↓                                                     ↓
    scoring.update(dt)                                   ui.hud
```

Simulation runs at a **fixed 120 Hz** regardless of display rate; rendering
interpolates between the last two sim states. Fixed-step is non-negotiable for
the springs — variable dt makes damped springs behave differently at different
frame rates, which would mean the car feels different on different phones.

120 Hz (not 60) because the attitude springs run up to 3.2 Hz and we want
plenty of headroom for a crisp, non-mushy response.

## Performance budget

Target: **60 fps on a mid-range 2022 Android phone in a WebView.** That's the
constraint everything is sized against.

| Resource | Budget |
|---|---|
| Frame time | 16.6 ms, with ~4 ms headroom → aim for 12 ms |
| Draw calls | < 120 |
| Triangles | < 150 k |
| Textures | < 24 MB (atlases only; no 4K anything) |
| Sim time | < 2 ms/frame |
| GC allocation while driving | **zero** — pre-allocate everything, pool everything |
| Startup to first frame | < 2 s |

Quality tiers (auto-detected, user-overridable): draw distance, prop density,
shadow resolution, post-effect stack, and render scale all step down together.

## Determinism

The entire world is a pure function of `(seed, s)`. Given a seed, the road,
terrain, props, biome sequence and traffic are all identical every time. This
means:

- "that corner at 47.3 km felt wrong" is a reproducible bug report,
- the resume point is just a seed and a distance,
- screenshot regression tests are meaningful.

Only the sun's position and the player's own inputs are outside this.

## Testing

| Layer | How |
|---|---|
| `core/`, `sim/`, `world/` | Plain Vitest unit tests in Node. No browser. These are the ones that matter. |
| Handling regression | Scripted input sequences ("full throttle, then 2 s of right lock") → assert on resulting trajectory and attitude envelopes. Catches "I tuned one constant and broke the car". |
| Determinism | Same seed twice → byte-identical station data. |
| Visual | Playwright + headless Chromium: drive a fixed seed to fixed distances, screenshot. Compared by eye, not by pixel diff (too brittle for a continuously-varying scene). |
| Performance | Scripted 60 s drive with frame-time capture; assert p95 frame time. |

## Build and delivery

- **Vite** + TypeScript, strict mode.
- **three.js** as the only runtime dependency of consequence.
- **Capacitor** wraps the built bundle as a native Android app — added at
  Phase 6, not before, so it can't slow down the phases that matter.
- No assets are downloaded at runtime. Everything ships in the bundle; the app
  is fully functional offline and requests no permissions.

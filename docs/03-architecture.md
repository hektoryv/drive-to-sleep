# 03 — Architecture

*Last updated: 2026-09-20*

## The two rules

> **1. No domain imports another domain.**
> **2. `sim/` and `world/gen/` never import three.js or touch the DOM.**

The first is what lets separate people work on the environment, the cockpit and
the UI at once without their changes reaching each other (ADR-0011). The second
is what keeps the simulation and the generator testable in plain Node and
portable off this rendering stack (ADR-0002).

Both are enforced by ESLint rather than left to discipline, with error messages
that say what to do instead. Everything else in this document is negotiable;
these are not.

The full ownership map and the guide to working inside one domain are in
[06-modules.md](06-modules.md). The short version:

```
src/
├─ core/        maths, RNG, loop, event bus, storage. Depends on nothing.
├─ contracts/   the interfaces between domains. Types only.
├─ app/         composition root, module registry, debug overlay.
│
├─ world/       THE ENVIRONMENT — generation *and* its meshes.
│  ├─ gen/      pure: fields, events, stations, terrain, road query
│  ├─ view/     three.js: road mesh, terrain mesh, sky, materials
│  └─ world-module.ts
├─ sim/         THE CAR — pure. vehicle, attitude, traffic, collision, scoring.
├─ input/       touch → control state
├─ render/      engine layer: WebGL, camera rig, framing, post
├─ cockpit/     the 911 interior
├─ ui/          HUD and screens
├─ audio/       the engine, the wind and the tyres — synthesised
└─ fx/          particles, shake
```

Each domain exposes one `GameModule`. The registry gives it its own
`THREE.Group` and its own DOM layer and drives
`init → start → step → frame → resize → dispose`, plus `pause`/`resume` for
anything holding a resource with a clock of its own. A module that stays inside
its own group and overlay cannot affect another one.

`audio/` uses neither its group nor its overlay — it has nothing to draw. It is
in the list on the same terms as everything else because a domain is defined by
what it owns, not by whether it happens to be visible.

## Coordinate systems

Three of them. Confusing them is the most likely source of bugs, so they are
named explicitly and conversions live in exactly one place (`world/gen/stations.ts`).

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
carrying position, heading, curvature, grade, bank and width. Every other
system reads stations, never the raw fields.

A caveat discovered in Phase 1 and recorded as ADR-0012: position and heading
are the *integral* of curvature, so they are not randomly addressable the way
the fields are. Stations are integrated forward from zero into a ring buffer;
reaching an arbitrary distance costs one linear walk, paid once at startup.
A seed plus a distance still specifies a place exactly — it is only the cost
model that differs from the fields.

**Events** are the anti-monotony mechanism. On top of the noise, the generator
injects hand-authored shapes at intervals — a hairpin, a long descending
sweeper, a crest with a blind corner behind it, a bridge, a straight with a
view. These are what make the road feel designed rather than random, and are
the highest-leverage place to spend tuning time.

**Chunks** are 128 stations (~512 m). A ring buffer of 13 chunks is kept alive:
2 behind, 10 ahead, ~6.6 km in total. Writing station `i` overwrites station
`i - capacity`, so eviction needs no bookkeeping and nothing is ever
reallocated.

The meshes are **one buffer each**, rewritten in place when the window advances
by a whole chunk — roughly every 17 seconds at cruising speed. Not per-chunk
meshes: the live road runs 6.6 km and the far plane is at 4 km, so the far end
of the buffer is always at least half a kilometre beyond anything visible and
nothing can pop. One mesh, one draw call, no chunk lifecycle to get wrong.

Vertex positions are stored relative to a rebase point near the camera, with
the offset carried in the mesh transform. A float32 at 500 km resolves to about
6 cm — visible jitter — while three.js composes the model-view matrix on the
CPU in float64, so keeping the vertices small preserves precision however far
you drive.

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
| `core/`, `sim/`, `world/gen/` | Plain Vitest unit tests in Node. No browser. These are the ones that matter. |
| Domain boundaries | `npm run lint`. The architecture is the lint config. |
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

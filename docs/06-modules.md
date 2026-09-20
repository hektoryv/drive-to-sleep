# 06 — Modules and domain ownership

*Last updated: 2026-09-21*

This project is built so that several people — or several agents — can work on
different parts of it at once without their changes reaching each other. That
requires more than good intentions, so it is built into the structure and
checked by the linter (ADR-0011).

## The domains

Each is a sealed vertical slice. It owns its generation, its geometry, its DOM,
its shaders and its tuning constants.

| Domain | Owns | Lives in |
|---|---|---|
| **world** | The environment. Road generation, terrain, props, biomes, sky — *and* all of their meshes and shaders. | `src/world/` |
| **sim** | The car. Vehicle model, attitude, traffic, collision, scoring. | `src/sim/` |
| **input** | Touch handling, control curves, the dynamic-origin scheme. | `src/input/` |
| **render** | The engine layer: WebGL setup, the camera rig, framing, post-processing. Infrastructure, not content. | `src/render/` |
| **cockpit** | The 70s interior. Depth-separated sprite cards, wheel, gauges, mirror. Drawn in its own pass (ADRs 0017–0019). | `src/cockpit/` |
| **ui** | HUD, start screen, pause panel, summary. | `src/ui/` |
| **audio** | The engine note, wind and tyres. Synthesised — no samples, no music. | `src/audio/` |
| **fx** | Particles, camera shake. | `src/fx/` |

And three shared things that are nobody's domain:

| | | |
|---|---|---|
| **core** | Maths, RNG, the loop, the event bus, storage. Depends on nothing. | `src/core/` |
| **contracts** | The interfaces between domains. Types only. | `src/contracts/` |
| **app** | The composition root. The only place that knows more than one domain. | `src/app/` |

## The rule

> **No domain imports another domain.**

`world/` has never heard of `ui/`. `cockpit/` has never heard of `world/`. They
each import `core/` and `contracts/`, and `app/` wires the real implementations
together at runtime.

This is checked by ESLint, not left to discipline. Try it:

```ts
// in src/ui/hud.ts
import { createRoad } from '../world/gen/road-query.js';
//     ^ error  Domains must not import one another (ADR-0011). If you need
//              something from another domain, add or use an interface in
//              src/contracts/ and let app/ wire the implementation in.
```

There is a second rule layered on top, from ADR-0002: **`sim/` and
`world/gen/` may not touch three.js or the DOM**, so the simulation and the
generator stay testable in plain Node and portable off this rendering stack.
Also linted.

## How a module works

A module is one domain's entire presence in the running game. It gets three
things and may touch nothing else:

1. **Its own scene subtree** (`ctx.scene`, a `THREE.Group`). Do anything you
   like inside it. Nothing else will ever touch it, and you will never touch
   anything else's. This is why the environment cannot move the cockpit.
2. **Its own DOM layer** (`ctx.overlay`). Same deal for anything in HTML.
3. **Services** (`ctx.services`), to reach other domains through contracts.

```ts
export function createCockpitModule(): GameModule {
  let car: CarView | undefined;

  return {
    name: 'cockpit',

    // Pass one: build state, register anything you provide.
    init(ctx) {
      ctx.scene.add(buildCockpitSprites());
    },

    // Pass two: resolve what you need. Everything has run init by now, so
    // registration order does not matter.
    start(ctx) {
      car = ctx.services.require('car');
    },

    // Fixed 120 Hz. Always the same dt.
    step(dt) { /* ... */ },

    // Once per displayed frame. Never advance simulation state here.
    frame(alpha, view) { /* ... */ },

    resize(framing) { /* ... */ },
    dispose() { /* ... */ },
  };
}
```

## The three coordination points

Everything else is private to a domain. These three are shared, and a change to
any of them can break someone else's build — so they are deliberately small,
and they are the only places you need to coordinate.

**1. `src/contracts/`** — the interfaces between domains.
Adding a field or an event is safe. Changing or removing one means checking
every consumer in the same commit and saying so in `PROGRESS.md`.

**2. `src/contracts/services.ts`** — the `Services` interface.
Adding a key here means a new cross-domain capability exists. Exactly one
domain provides each service; providing one twice is an error at startup, with
a message saying so.

There are four: `road` and `daylight` from `world/`, `car` from `sim/`, and
`controls` from `input/`. `daylight` was the most recent and is a good example
of when a key is earned — the cabin has to be lit by the same sun as the road,
and no amount of local cleverness in `cockpit/` can work out what colour that
sun is.

**3. `src/app/modules.ts`** — the manifest.
One line per domain. Adding a domain touches this file and nothing else.

## Tuning constants are per-domain

There is no single `tuning.ts`. A shared constants file is the most reliable
merge conflict in a codebase worked on from several directions at once, so
each domain owns its own:

| | |
|---|---|
| `src/sim/tuning.ts` | vehicle, attitude, simulation rate |
| `src/world/tuning.ts` | road, events, terrain, time of day |
| `src/render/tuning.ts` | framing, field of view, camera look-ahead |
| `src/input/tuning.ts` | control radii, curves, deadzone |
| `src/audio/tuning.ts` | engine voices, wind, tyres, master level |
| `src/cockpit/tuning.ts` | sprite placement, wheel motion, painted light |

The rule from `05-conventions.md` still holds — no feel or look constant is
written inline in logic — it has one home per domain instead of one shared file.

## Working in parallel

If you are picking up one domain:

1. Read this file and the relevant ADRs.
2. Work inside `src/<domain>/` and `tests/`. You should not need to touch
   anything else.
3. If you need something from another domain, you need a **contract**, not an
   import. Add it, note it in `PROGRESS.md`, and move on.
4. Run `npm run lint` before you commit — it is checking the architecture, not
   just the formatting.
5. Log what you did in `docs/PROGRESS.md` and move your tasks in
   `docs/TODO.md`, in the same commit.

The debug overlay shows per-module step cost, so "which domain got slower" is
answerable without profiling.

## A worked example: adding the audio domain

Sound was ruled out at the start of the project and ruled back in on
2026-09-20 (ADR-0016) — the least planned-for change this codebase has had, and
therefore the only honest test of the claim this document makes.

What it cost outside `src/audio/`:

- **one line** in `src/app/modules.ts`, the manifest;
- **one word** in `eslint.config.js`, adding `audio` to the domain list so the
  boundary is enforced for it too;
- **two additive contract fields** — `CarView.maxRpm`, and `pause`/`resume` on
  `GameModule` — each of which was independently justified: the tachometer
  needs the redline, and an AudioContext keeps playing while backgrounded.

No domain changed. `sim/` does not know the car can be heard, and `world/` does
not know the tyres make a different noise on its gravel. If a future domain
costs more than this, something has gone wrong with the seams rather than with
the domain.

## The one sanctioned exception

`input/pointer.ts` listens on `window` rather than on its own overlay layer.
That is deliberate: "input" is precisely the domain whose job is global, the
game is fullscreen, and routing touches through a stack of overlay layers would
make the control scheme depend on DOM ordering — which is exactly the kind of
accidental coupling between domains the architecture exists to prevent.

It is the only one. If you find yourself wanting a second, that is a sign a
contract is missing.

## What goes in `app/`

Almost nothing. It owns the canvas, the renderer, the scene, the loop and the
clock, and it drives the module lifecycle. If you are adding domain logic
there, it belongs in a module instead.

The one deliberate exception is the debug overlay, which is development
tooling rather than a domain and needs loop and renderer internals that no
module should have.

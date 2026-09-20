# Drive to Sleep

An endless, calm driving game for Android. You sit in the driver's seat of a
1970s Porsche 911 and drive a procedurally generated road that never ends —
mountain, desert, country — as the sun goes down and comes back up.

One finger does everything. Left/right steers. Up/down is gas and brake.
No sound.

## Status

**Phase 2 code complete, awaiting a device.** The road generates and the car
drives it: arcade handling with a grip clamp that produces real understeer,
three attitude springs that give the body weight, and the one-finger control
scheme. 168 tests, including 20 km of the real generated road under autopilot
without leaving the tarmac.

What's missing is the only thing that matters: **whether it feels good.** That
needs hands on a real build, and it's the phase's actual exit criterion.
See [docs/TODO.md](docs/TODO.md) for the five constants to try first.

The codebase is split into sealed domains so it can be worked on from several
directions at once — see [docs/06-modules.md](docs/06-modules.md).

```
npm install
npm run dev                                   # play it in a browser
npm test                                      # 49 tests
npm run shoot -- --seed 1 --at 500 --debug 1  # photograph it
npm run shoot -- --sheet                      # contact sheet
npm run shoot -- --sequence --from 480 --to 640   # a strip through one corner
npm run lint                                  # also checks the architecture
npm run shoot -- --handling                   # the car caught mid-corner
npm run telemetry                             # drive, and print what it did
npm run shoot -- --sheet                      # the whole day, one sheet
npm run shoot -- --at 200 --time golden       # the art target's moment
```

## Where things are

| Document | What it's for |
|---|---|
| [docs/00-vision.md](docs/00-vision.md) | What this game is and, more importantly, what it isn't |
| [docs/01-design.md](docs/01-design.md) | The loop, controls, traffic, scoring, feel targets |
| [docs/02-art-direction.md](docs/02-art-direction.md) | Look, palette, biomes, the 911 interior, portrait framing |
| [docs/03-architecture.md](docs/03-architecture.md) | Module map, coordinate systems, data flow, budgets |
| [docs/04-roadmap.md](docs/04-roadmap.md) | Phases, tasks, exit criteria |
| [docs/05-conventions.md](docs/05-conventions.md) | Code style, tuning policy, testing, definition of done |
| [docs/06-modules.md](docs/06-modules.md) | Domain ownership, module lifecycle, working in parallel |
| [docs/reference/art-target.png](docs/reference/art-target.png) | The picture this is trying to be |
| [docs/decisions/](docs/decisions/) | Locked decisions, one file each, with the reasoning |
| [docs/PROGRESS.md](docs/PROGRESS.md) | Append-only log of what actually happened |
| [docs/TODO.md](docs/TODO.md) | Live backlog |

## Stack

TypeScript + three.js (WebGL2), built with Vite, wrapped as a native Android
app with Capacitor. See [ADR-0001](docs/decisions/ADR-0001-tech-stack.md).

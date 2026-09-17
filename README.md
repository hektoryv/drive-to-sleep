# Drive to Sleep

An endless, calm driving game for Android. You sit in the driver's seat of a
1970s Porsche 911 and drive a procedurally generated road that never ends —
mountain, desert, country — as the sun goes down and comes back up.

One finger does everything. Left/right steers. Up/down is gas and brake.
No sound.

## Status

**Phase 1 complete.** The road generates: curvature, grade and width as noise
fields over distance with hairpins, sweepers and crests injected on top, swept
into geometry with terrain either side. The codebase is split into sealed
domains so it can be worked on from several directions at once
([docs/06-modules.md](docs/06-modules.md)).

Phase 2 is next, and it's the one that matters: making the car feel good.

```
npm install
npm run dev                                   # play it in a browser
npm test                                      # 49 tests
npm run shoot -- --seed 1 --at 500 --debug 1  # photograph it
npm run shoot -- --sheet                      # contact sheet
npm run shoot -- --sequence --from 480 --to 640   # a strip through one corner
npm run lint                                  # also checks the architecture
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
| [docs/decisions/](docs/decisions/) | Locked decisions, one file each, with the reasoning |
| [docs/PROGRESS.md](docs/PROGRESS.md) | Append-only log of what actually happened |
| [docs/TODO.md](docs/TODO.md) | Live backlog |

## Stack

TypeScript + three.js (WebGL2), built with Vite, wrapped as a native Android
app with Capacitor. See [ADR-0001](docs/decisions/ADR-0001-tech-stack.md).

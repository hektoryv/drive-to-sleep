# 05 — Conventions

*Last updated: 2026-09-17*

The point of this file is that a session six weeks from now can pick the
project up without guessing.

## Code

- **TypeScript strict.** No `any`. No non-null `!` assertions outside tests.
- **No classes where a function will do.** Systems are modules with explicit
  state objects passed in, not singletons with hidden state — this is what
  keeps the sim testable and deterministic.
- **Explicit units in names.** `speedMs`, `angleRad`, `distanceM`,
  `durationS`. Mixed units are the bug this project is most likely to have.
- **Radians internally, always.** Degrees only in `tuning.ts`, converted once.
- **No allocation in the hot path.** Anything running per-frame writes into
  pre-allocated objects. `new` inside `step()` or `update()` is a bug.
- **File size:** if a file passes ~300 lines, it's probably two files.

## The tuning rule

> Every number that affects how the game feels or looks lives in
> `sim/tuning.ts` or the biome parameter sets. Never inline in logic.

Because: tuning is iterative, tuning happens in a feedback loop with you
looking at screenshots, and a constant buried on line 214 of `vehicle.ts` is a
constant that never gets tuned. Each constant carries a one-line comment
saying what it does and which direction makes it feel *more* of something.

## Layering

```
core  ←  input, sim, world, render, cockpit, ui, fx
sim   ←  render, ui        (render reads sim; sim never sees render)
world ←  sim, render
```

`sim/` and `world/` import **nothing** from `render/`, `cockpit/`, `ui/`, or
three.js. Enforced by an ESLint `no-restricted-imports` rule, not by good
intentions.

## Naming

| Thing | Convention | Example |
|---|---|---|
| Files | kebab-case | `road-mesh.ts` |
| Types / interfaces | PascalCase | `VehicleState` |
| Functions / vars | camelCase | `stepVehicle` |
| Constants in tuning | SCREAMING_SNAKE | `MAX_STEER_RAD` |
| Distance along road | always `s` | |
| Lateral offset | always `t` | |

## Commits

`<area>: <what changed>` — e.g. `sim: add roll spring to attitude model`.

Areas: `core`, `input`, `sim`, `world`, `render`, `cockpit`, `ui`, `fx`,
`tools`, `docs`, `build`, `android`.

One logical change per commit. A commit that touches a phase's checklist
updates `TODO.md` in the same commit.

## Documentation discipline

This is the part the brief specifically asked for, so it's a hard rule:

1. **Every phase-completing change appends to `PROGRESS.md`.** What was built,
   what was learned, what surprised us, what's next. Append-only — never
   rewrite history there.
2. **Every decision that closes off an alternative gets an ADR.** If we
   considered two ways and picked one, that's an ADR. Numbered, dated, with
   the rejected options and *why* they were rejected. Superseding an ADR means
   writing a new one that references the old, never editing the old one.
3. **`TODO.md` is the live truth.** Tasks move between Now / Next / Later /
   Done as work happens, in the same commit as the work.
4. **When a doc and the code disagree, that's a bug in the doc.** Fix it in
   the same commit that revealed it.
5. **Tuning changes that materially change feel get a line in `PROGRESS.md`**
   with the before and after values. Handling is tuned by memory of how it
   felt; the log is that memory.

## Definition of done

A task is done when all of:

- it works in the built app,
- it has tests if it's in `core/`, `sim/`, or `world/`,
- no new allocation in the hot path,
- `TODO.md` is updated,
- any constants introduced are in `tuning.ts` with a comment,
- it's committed with a message that says what changed.

## Commands

```
npm run dev              # vite dev server
npm run build            # production bundle
npm test                 # vitest
npm run lint             # eslint, incl. the layering rule
npm run shoot            # screenshot harness — see below
npm run shoot -- --seed 7 --at 1200 --time dusk --out shots/
npm run perf             # scripted 60 s drive, frame-time report
npx cap sync android     # (phase 6+) push the build into the Android project
```

## The screenshot workflow

Given the choice to review by screenshot rather than by running builds, the
harness is a primary tool, not a debug convenience. It must be able to:

- drive a given seed to a given distance and hold,
- force a time of day and a biome blend,
- play back a recorded input sequence,
- position a free camera for framing checks,
- and emit a contact sheet of many shots in one run.

Any visual change is reviewed by a contact sheet before it's called done.

**The known limitation:** screenshots cannot judge motion. Anything about
feel, lean, latency or camera movement needs either a capture or your hands on
a real build. Phase 2's exit criterion depends on this and it's flagged there.

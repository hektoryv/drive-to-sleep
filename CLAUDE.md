# Working agreement — Drive to Sleep

Read this first, then [docs/06-modules.md](docs/06-modules.md) if you are
working inside one domain. [docs/04-roadmap.md](docs/04-roadmap.md) says where
we are; [docs/TODO.md](docs/TODO.md) says what's next.

## What this project is

An endless, calm, portrait-orientation driving game for Android. One finger
steers and controls gas/brake. The player sits in a 1970s
911-style cockpit driving a procedurally generated road that blends between
mountain, desert and country as the sun cycles.

Full context: [docs/00-vision.md](docs/00-vision.md).

## Non-negotiables

1. **No domain imports another domain.** `world/`, `sim/`, `input/`, `render/`,
   `cockpit/`, `ui/` and `fx/` are sealed. They talk through `contracts/`, and
   `app/` wires them. This is what lets several people work at once without
   breaking each other (ADR-0011).
2. **`sim/` and `world/gen/` never import three.js or touch the DOM.** They
   must run in plain Node (ADR-0002).
3. **The simulation runs at a fixed 120 Hz.** Never tie physics to frame rate.
4. **No allocation in the hot path.** Pre-allocate, pool, write in place.
5. **Every feel/look constant lives in its domain's `tuning.ts`**, with a
   comment saying which direction makes it more of something. Never inline.
6. **Sound is the car and the air, and nothing else.** No music, no
   interface clicks, no samples — everything is synthesised from the car's
   own state (ADR-0016). The game must still be completely legible with the
   phone muted: sound adds to the feedback, it never carries it alone.
7. **No badges, marques or model names on the car.** It's "a 70s sports car".
8. **No network, no analytics, no ads, no IAP, no permissions.**

Rules 1 and 2 are checked by `npm run lint`. The architecture *is* the lint
config; the documentation describes it.

## Documentation discipline

This project was explicitly set up to be well-documented. Keeping that true is
part of every task, not a separate chore:

- Finishing a meaningful piece of work → append to
  [docs/PROGRESS.md](docs/PROGRESS.md). Append-only.
- Making a decision that rules out an alternative → write an ADR in
  [docs/decisions/](docs/decisions/). Never edit an accepted one; supersede it.
- Moving work → update [docs/TODO.md](docs/TODO.md) **in the same commit**.
- Doc disagrees with code → the doc is the bug. Fix it in the same commit.
- Materially changing how the car feels → log the before/after values in
  PROGRESS.md. Handling is tuned by memory; that log is the memory.

Full conventions: [docs/05-conventions.md](docs/05-conventions.md).

## Working inside a domain

Work in `src/<domain>/` and `tests/`. You should not need to touch anything
else. If you need something from another domain you need a **contract**, not an
import — add it to `src/contracts/`, note it in PROGRESS.md, move on.

The three shared files, and the only places that need coordination:
`src/contracts/*`, the `Services` interface, and `src/app/modules.ts`.

## Working rhythm

- **Phases are sequential and their exit criteria are real.** Don't start
  Phase 3 because Phase 2 is nearly done. Phase 2 in particular (the car
  feeling good) gates everything after it.
- **The screenshot harness is how the game gets seen.** Any visual change is
  reviewed on a contact sheet before it's called done:
  `npm run shoot -- --seed 7 --at 1200 --time dusk`
- **Screenshots cannot judge motion.** Anything about feel, lean, latency or
  camera movement needs a capture or a real device. Don't sign off feel from a
  still. See ADR-0008.

## Commands

```
npm run dev      npm run build     npm test     npm run lint
npm run shoot    npm run perf      npx cap sync android   # phase 6+
```

## Branch

Development happens on `claude/android-driving-game-plan-pw5z30`.

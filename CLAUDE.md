# Working agreement — Drive to Sleep

Read this first. Then [docs/04-roadmap.md](docs/04-roadmap.md) to see where we
are, and [docs/TODO.md](docs/TODO.md) for what's next.

## What this project is

An endless, calm, portrait-orientation driving game for Android. One finger
steers and controls gas/brake. No sound. The player sits in a 1970s
911-style cockpit driving a procedurally generated road that blends between
mountain, desert and country as the sun cycles.

Full context: [docs/00-vision.md](docs/00-vision.md).

## Non-negotiables

1. **`sim/` and `world/` never import from `render/`, `cockpit/`, `ui/`, or
   three.js.** This is the load-bearing architectural rule. See ADR-0002.
2. **The simulation runs at a fixed 120 Hz.** Never tie physics to frame rate.
3. **No allocation in the hot path.** Pre-allocate, pool, write in place.
4. **Every feel/look constant lives in `sim/tuning.ts`** or a biome parameter
   set, with a comment. Never inline in logic.
5. **No audio, ever.** It's a design decision, not an omission.
6. **No badges, marques or model names on the car.** It's "a 70s sports car".
7. **No network, no analytics, no ads, no IAP, no permissions.**

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

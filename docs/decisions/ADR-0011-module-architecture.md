# ADR-0011 — Sealed domains with a contract layer and a module lifecycle

**Date:** 2026-09-17 · **Status:** Accepted
**Refines:** [ADR-0002](ADR-0002-sim-render-separation.md)

## Context

The intended way of working on this project is several people — or several
agents — on different parts at once: one on the generated environment, one on
the interior and its art, one on the UI, and so on. That only works if a change
inside one part genuinely cannot break another.

ADR-0002 gave one boundary, `sim ↛ render`, which is a *horizontal* split:
pure logic underneath, rendering on top. It is a good rule and it stays. But it
is the wrong shape for parallel work, because the road cuts across it — road
generation is pure, road meshing is not — so "the environment" would have been
two directories owned by two rules, and an agent working on it would have been
editing `render/` alongside whoever owned the cockpit.

The three things that actually cause collisions between parallel workers:

1. **Shared mutable files.** One `tuning.ts` that everyone edits. One `game.ts`
   that grows a line per subsystem.
2. **Implicit coupling.** One module reaching into another's internals, so a
   refactor in one place breaks somewhere unrelated.
3. **Unclear ownership.** Two people both fixing the same thing, differently.

## Decision

Cut the codebase **vertically** into sealed domains, and keep ADR-0002's
horizontal purity rule inside them.

1. **Domains.** `world`, `sim`, `input`, `render`, `cockpit`, `ui`, `fx`. Each
   owns its generation, its geometry, its shaders, its DOM and its tuning
   constants. `world/` owns the road mesh as well as the road; `cockpit/` owns
   the dashboard geometry as well as its logic.

2. **No domain imports another domain.** They import `core/` and
   `contracts/`; `app/` wires the implementations together at runtime.

3. **`contracts/`** holds the interfaces between domains — `RoadQuery`,
   `CarView`, `ViewState`, the event map, the service registry. Types and tiny
   pure helpers only.

4. **A module lifecycle.** Each domain exposes one `GameModule`. The registry
   hands it its own `THREE.Group` and its own DOM layer and drives
   `init → start → step → frame → resize → dispose`. A module that stays inside
   its own group and its own overlay *cannot* affect another.

5. **Two-phase startup.** Everything registers services in `init`, everything
   resolves them in `start`. Registration order therefore carries no meaning,
   so the manifest is not a dependency ordering anyone has to reason about.

6. **Per-domain tuning files**, replacing the single `sim/tuning.ts`.

7. **The linter enforces all of it.** `no-restricted-imports` per directory,
   with error messages that say what to do instead. The architecture is the
   lint config; this document describes it.

## Why the linter and not a convention

Because every architecture document ever written has been quietly violated by
someone in a hurry, and a boundary that is not checked is a boundary that
erodes. The rules are also the fastest way to tell a newcomer — human or
otherwise — what the shape of the project is: they find out the moment they try
to do the wrong thing, with a message pointing at the right thing.

## Alternatives rejected

- **Keep the horizontal split and rely on discipline.** Cheapest, and it was
  already starting to smear: the road would have been split across `world/` and
  `render/` before Phase 1 was finished.
- **Separate npm packages per domain, in a monorepo.** Genuinely enforces the
  boundary. Rejected as far too much machinery for a game this size — build
  wiring, version bumps and cross-package type resolution, to solve a problem
  eight lines of lint config solves.
- **An ECS.** The usual answer to "make game subsystems independent". Rejected:
  this game has one car, one road and one cockpit. An ECS would be a large
  amount of indirection to decouple things that are not numerous.
- **A dependency-injection container.** The service registry is deliberately
  about forty lines with two methods. Anything more would be solving a problem
  we do not have.

## Consequences

- **`world/` now owns three.js code.** ADR-0002's purity rule applies to
  `sim/` and `world/gen/`, not to all of `world/`. This is a clarification
  rather than a weakening: the mesh builders were never going to be pure, and
  the parts that matter for testability and portability — the vehicle model and
  the generator — still are, and are still linted.
- **Three coordination points exist and are named**: `contracts/`, the
  `Services` interface, and `app/modules.ts`. Everything else is private.
- Some indirection is now the price of entry: reaching another domain means
  defining a contract rather than importing a function. That is the cost, and
  it is the point.
- Per-module step timings are in the debug overlay, so "which domain got
  slower" is answerable without a profiler.

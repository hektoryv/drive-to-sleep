# ADR-0006 — Portrait cockpit view; seamless biome and time-of-day drift

**Date:** 2026-09-17 · **Status:** Accepted

Two decisions, recorded together because they interact.

## Portrait

**Decision:** locked portrait, always from the driver's seat.

**Why:** the ergonomics are the point. Phone held normally in one hand, thumb
on the screen, in bed. Landscape would be a better frame for a road and a
worse fit for how this game is actually going to be played, and how it's
played is pillar #3.

**The cost, and how it's paid:** a tall thin window is a poor frame for a
landscape, and a steering wheel can easily eat the screen. Mitigations, all
specified in [02-art-direction.md](../02-art-direction.md):

- The windscreen is a **wide letterbox aperture** (~2.4:1) occupying the middle
  ~46% of the display — true to a 911's shallow screen, and it turns the
  portrait constraint into a cinematic frame rather than fighting it.
- **Vertical FOV ~38°**, far narrower than a default 60°, which compresses the
  scene, stabilises the horizon, makes mountains read as large, and costs less
  to render.
- **The bottom of the wheel is off-screen.** We see the top two-thirds of the
  rim, the spokes and the hub — enough to read the steering, without spending a
  third of the display on the inside of a car.

If in Phase 4 the framing still doesn't work, that's the point to reopen this,
not before.

## Seamless world drift

**Decision:** one endless road. Biomes (mountain / desert / country) blend
into each other over 4–6 km, driven by slow noise over distance. Time of day
runs a continuous ~25-minute cycle, independent of the biome cycle. No menus,
no selection, no loading.

**Why:** it matches the pillar — endless, not repetitive — and it puts all the
variety work in one place (the generator) rather than in level content. The
independence of the two cycles means their combinations are effectively never
repeated. And the in-between states, pine giving way to scrub, hedges thinning
into dust, are usually the best-looking part.

**Consequences:** biomes must be *parameter sets*, not levels, so blending is
just interpolation and weighted prop-table sampling. Nothing may be
biome-specific in a way that can't be blended. Impostor mountain layers must
regenerate as the blend moves. And the player can't choose a mood — which is
accepted, and is why the sun's cycle is short enough (~25 min) that waiting for
a mood is never long.

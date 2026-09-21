# ADR-0023 — Near landscapes are asymmetric 3D composition cells

**Date:** 2026-09-21 · **Status:** Accepted

## Context

The Phase 3 terrain was continuous and deterministic, but it was one symmetric
noise ribbon in every biome. Biomes changed palette and vegetation while their
landforms remained identical. The result was technically varied and visually
flat: distant ridge curtains supplied a horizon, but the road never sat on a
mountainside, above a lake, or inside a canyon.

The desired compositions put meaningful elevation close enough to the road to
have real parallax. One side may fall away behind guardrail while the other
rises into rock. Mountain and country regions may contain lakes; desert uses
canyon floors and mesas. The road also needs longer climbs and descents without
turning into an implausible hill climb.

## Decision

- Divide distance into deterministic 1.32 km landscape cells. Each cell picks
  an authored composition from its biome and fades to neutral terrain at both
  ends, so categorical scenes never meet at a hard seam.
- Generate the left and right sides independently. Exposed shelves, lake
  valleys and canyon floors deliberately oppose a rising wall; passes close in
  asymmetrically on both sides.
- Keep this middle-distance landscape as real swept 3D terrain out to 360 m.
  Distant ridge curtains remain the far-field solution, but their silhouette
  grammar and height now change by biome.
- Render lakes as horizontal 3D surfaces inside eligible mountain and country
  cells. Desert cells never select water.
- Add a slow grade field beneath existing road undulation and events, with a
  hard absolute grade cap of 14%. The cap is a named tuning value so device
  driving can revise it later without changing generator structure.
- Keep the existing shared terrain-height function authoritative. Vegetation,
  stones, guardrail decisions and off-road ground queries therefore agree with
  the visible landform.

## Alternatives rejected

- **Turn up the old terrain noise.** This makes larger random lumps, not
  composed views, and preserves the mirrored character of both road sides.
- **Use more backdrop cards.** Cards are correct for far silhouettes but lack
  the parallax and roadside contact required for a cliff, lake shore or rock
  cutting.
- **Build one unrestricted world-space heightfield.** It makes road/ground
  joins, endless recycling and curved-road cuttings substantially harder while
  discarding the road-coordinate system that already keeps every consumer in
  agreement.
- **Make every kilometre spectacular.** Landscape cells retain calm entries
  and exits. Contrast is part of the composition and prevents verticality from
  becoming a new kind of monotony.

## Consequences

- Terrain vertices rise from 20 to 28 across each station and water adds one
  draw call when present. The software-rendered lake stress scene measured a
  26.3 ms median versus the previously documented ~24.9 ms Phase 3 median;
  real-device GPU measurement remains required.
- Lakes are deliberately stylised strips following a landscape cell rather
  than a general hydrology simulation.
- Tunnels, bridges, buildings and villages remain separate authored landmarks
  and are not part of this terrain pass.

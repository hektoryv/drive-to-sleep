# ADR-0019 — Cockpit sprites occupy angled planes and an asymmetric crop

**Date:** 2026-09-21 · **Status:** Accepted

**Refines:** [ADR-0018](ADR-0018-layered-cockpit-sprites.md)

## Context

ADR-0018 correctly rejected the full-car GLB, but its first implementation put
four atlas quadrants on parallel camera-facing planes. To force a landscape
cockpit into the portrait aperture it vertically stretched the shell. The
result was a symmetrical toy-car cutaway: both doors were visible, the roof had
almost no mass, every surface shared one depth, and a painted overlay could not
create convincing contact shadows.

The fixed driver camera makes sprite art viable, but “sprite” does not have to
mean “flat screen overlay.” The cockpit needs authored perspective *and* enough
physical separation for parallax, occlusion and shadow joins.

## Decision

**Use separate transparent textures on a small asymmetric 2.5D card model.**

- The master composition is from the actual left-hand driver's eye. The near
  left pillar and a slice of the driver's door are visible; the passenger door
  and exterior mirror are intentionally outside the field of view.
- A deep roof/headliner and windshield shell is the farthest card.
- The upper dash/scuttle is mounted on a steeply raked, near-horizontal plane.
- The five-dial dashboard face is a separate vertical card in front of it.
- The driver's door card is yawed inward from the left.
- The steering wheel is the nearest card, tilted and free to rotate.
- Two procedural soft-alpha cards provide contact shadows beneath the dash and
  wheel. Their opacity increases as daylight falls.
- Look-ahead is depth-weighted lateral parallax: near cards move farther than
  the shell, while the rig continues to face the cockpit camera.

## Consequences

- Eight cards cost eight draw calls and sixteen triangles.
- Five downscaled source textures total 1.24 MB on disk, about 9.25 MiB at base
  RGBA resolution and roughly 12.3 MiB with mipmaps — inside the 24 MB budget.
- The deliberately cropped passenger side is not missing content; it is the
  adult-scale perspective. Showing less of the cabin makes it feel larger.
- Painted surface shading supplies material character; actual plane angles,
  depth separation, overlap and shadow cards supply spatial depth.
- Gauge needles remain painted and static. Live tach/speed overlays are still
  separate Phase 4 work.
- ADR-0018's rejection of a full 3D car remains accepted. This ADR supersedes
  only its single-atlas, parallel-camera-facing implementation.

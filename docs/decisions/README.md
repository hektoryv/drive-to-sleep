# Architecture Decision Records

One file per decision that closed off an alternative. Numbered, dated, never
edited after acceptance — a decision that changes gets a *new* ADR that
supersedes the old one, so the reasoning trail stays intact.

| # | Decision | Status |
|---|---|---|
| [0001](ADR-0001-tech-stack.md) | TypeScript + three.js + Capacitor | Accepted |
| [0002](ADR-0002-sim-render-separation.md) | Sim/render separation, fixed timestep | Accepted (refined by 0011, 0012) |
| [0003](ADR-0003-hybrid-rendering.md) | Hybrid 3D road / 2.5D scenery | Accepted |
| [0004](ADR-0004-one-finger-control.md) | Position-mapped one-finger control | Accepted (drift mechanism replaced by 0013) |
| [0005](ADR-0005-traffic-and-stakes.md) | Same-direction traffic, soft collisions, no fail state | Accepted |
| [0006](ADR-0006-portrait-and-world.md) | Portrait cockpit; seamless biome and time drift | Accepted (framing figures superseded by 0009) |
| [0007](ADR-0007-art-direction.md) | Stylised low-poly with a detailed 70s interior | Accepted (interior colour superseded by 0014) |
| [0008](ADR-0008-dev-feedback-loop.md) | Screenshot-first development loop | Accepted |
| [0009](ADR-0009-horizontal-fov.md) | FOV authored horizontally; aperture proportions corrected | Accepted |
| [0010](ADR-0010-camera-look-ahead.md) | The view leads the car into corners | Accepted |
| [0011](ADR-0011-module-architecture.md) | Sealed domains, contract layer, module lifecycle | Accepted |
| [0012](ADR-0012-road-integration.md) | Road geometry is integrated forward, not randomly addressable | Accepted |
| [0013](ADR-0013-origin-drag.md) | The touch origin is dragged, never drifted | Accepted |
| [0014](ADR-0014-red-interior.md) | The car is red, not black | Accepted |
| [0015](ADR-0015-ci-android-builds.md) | The APK is built in CI; the native project is committed | Accepted |
| [0016](ADR-0016-sound-after-all.md) | There is sound after all — synthesised, no music, no samples | Accepted |

# Progress Log

Append-only. Newest entries at the top. Never rewrite a past entry — if
something turned out to be wrong, say so in a new entry.

Each entry: what was built, what was learned, what surprised us, what's next.

---

## 2026-09-17 — Phase 0: planning

**Built:** the plan. Repo documentation structure, vision, game design,
art direction, architecture, roadmap, conventions, and eight ADRs covering
every decision made so far.

**Decided** (details in `decisions/`):

| Question | Answer |
|---|---|
| Stack | TypeScript + three.js + Vite, wrapped with Capacitor |
| Rendering | Hybrid — 3D road and near world, 2.5D distant scenery |
| Loop | Endless, gentle scoring, mild traffic |
| Art | Stylised low-poly world, detailed 1970s 911-style interior |
| Traffic | Same direction only, soft collisions, no fail state |
| View | **Portrait**, cockpit, locked |
| World | Seamless biome blending + independent time-of-day cycle |
| Dev loop | Screenshot-first from the container |

**Learned / noted:**

- The build container has Node, Java, Gradle, Chromium and Playwright but
  **no Android SDK**. This drove the stack decision more than anything else —
  a web stack is the only one that can be seen and iterated on from here.
- Portrait is a real constraint, not a free choice. The resolution is to make
  the windscreen a wide letterbox aperture with a narrow (~38°) vertical FOV,
  which turns the awkward frame into a cinematic one and is also true to the
  shallow screen of the car being evoked. Written up in the art direction doc
  and ADR-0006.
- The screenshot-first loop has one gap that can't be papered over:
  **it cannot judge motion.** Phase 2 (handling and feel) therefore has an exit
  criterion that explicitly requires a real build on a real phone. Recorded in
  ADR-0008 rather than discovered later.
- WebView touch latency is the single biggest risk to the project, because the
  control scheme *is* the game. Moved to early in Phase 6 rather than the end.

**Next:** Phase 0 implementation — Vite/TS/lint/test scaffold, fixed-step loop,
seeded noise, debug overlay, and the screenshot harness. Exit when
`npm run shoot` produces a PNG and the overlay shows a stable 60 fps.

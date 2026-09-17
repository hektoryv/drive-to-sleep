# Progress Log

Append-only. Newest entries at the top. Never rewrite a past entry — if
something turned out to be wrong, say so in a new entry.

Each entry: what was built, what was learned, what surprised us, what's next.

---

## 2026-09-17 — Phase 0 complete: foundation

**Built:** the toolchain, the core runtime, the portrait framing, and the
thing everything else depends on — the screenshot harness.

- **Build:** Vite + TypeScript in strict mode (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, no `any`, no `!`), Vitest, ESLint. The
  `sim ↛ render` layering rule from ADR-0002 is enforced by
  `no-restricted-imports`, not by good intentions.
- **`core/loop.ts`** — fixed 120 Hz accumulator with render interpolation, a
  sub-step cap, and an `advance()` path that runs simulation steps with no
  rendering so the harness can fast-forward deterministically.
- **`core/math.ts`** — the spring-damper the whole feel of the car will hang
  off, plus frame-rate-independent easing and allocation-free vectors.
- **`core/rng.ts`** — seeded streams and hash-based value/gradient/ridged
  noise. Purely positional, so any point is evaluable without having generated
  what precedes it. That property is tested directly.
- **`core/events.ts`, `core/storage.ts`** — typed bus; localStorage that
  survives being blocked, corrupt, or written by an older build.
- **`render/framing.ts`** — the four-band portrait layout, in one place.
- **`render/renderer.ts`** — three.js, ACES filmic tonemapping from day one
  (ADR-0007), and the world scissored to the aperture so the GPU never shades
  the 57% of the display the car covers.
- **`render/debug.ts`** — frame timings plus framing guides that draw where the
  horizon *should* be, derived back out of the camera pitch.
- **`tools/shoot.ts`** — single shots and contact sheets. **`tools/perf.ts`** —
  frame-time percentiles over a scripted drive.
- **49 tests**, all passing. `npm run build` clean, `npm run lint` clean.

**Three bugs the tests caught, all real:**

1. **The loop used `0` as its "first frame" sentinel.** `performance.now()`
   starts near zero on a fresh page, so the sentinel kept re-triggering and
   every frame delta collapsed to a single step — the simulation would have run
   at a fraction of real time and the sub-step cap would never have fired. This
   one would have been genuinely nasty to find later, sitting underneath
   handling that felt inexplicably sluggish. Replaced with an explicit flag.
2. **The event bus skipped a listener when one removed itself during
   dispatch** — the classic splice-while-iterating bug. Fixed with tombstones
   and deferred compaction, so it stays allocation-free.
3. **`fps` and `frameMs` were smoothed independently**, so the debug panel
   showed "95 fps / 33 ms" simultaneously. fps is now derived from the smoothed
   frame time. A perf readout that contradicts itself is worse than none.

**The plan was wrong about the framing, and the harness caught it on the first
render.** ADR-0006 specified a "~2.4:1 aperture at ~46% of the display" —
arithmetically impossible on a 9:19.5 phone, where a full-width band at 46%
height is about 1:1. Getting 2.4:1 would have meant a strip under a fifth of
the screen tall, with the landscape — pillar #2, the reward — squeezed into it.
Corrected to 5/38/22/35 with the aperture at ~1.2:1, and **field of view is now
authored horizontally (52°)** rather than vertically, so retuning the aperture
in Phase 4 can't silently change how far you can see into a corner. Written up
as ADR-0009; ADR-0006 left unedited with a pointer, per the convention.

**Measured (headless SwiftShader — software rasteriser, not phone numbers):**

| | |
|---|---|
| p50 frame | 34.5 ms |
| p95 frame | 64.2 ms |
| sim | < 0.01 ms/frame |
| draw calls | 2 |
| triangles | 962 |

Useful only as a commit-to-commit baseline. Real device performance is Phase 6.

**Exit criterion met:** `npm run shoot -- --seed 1 --at 500` produces a PNG,
the framing guides land exactly on the rendered horizon, and `--sheet`
produces a contact sheet across seeds, distances and times of day.

**Next:** Phase 1 — the road. Curvature/grade/width fields over distance,
station sampling, the chunk ring buffer, the road mesh sweep, and the event
injection that stops the road feeling like undifferentiated noise.

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

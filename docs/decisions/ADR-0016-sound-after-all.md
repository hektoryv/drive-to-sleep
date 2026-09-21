# ADR-0016 — There is sound after all

**Date:** 2026-09-20 · **Status:** Accepted
**Supersedes:** the "no sound" non-goal in
[00-vision.md](../00-vision.md) and non-negotiable 6 in
[CLAUDE.md](../../CLAUDE.md)

## Context

"No sound" was in the opening brief and was written down twice as a hard
constraint — a design decision, not an omission. It shaped real work: the
design doc says "with no audio, the dash gauges are also the feedback channel:
the needle sweep *is* the engine note", and the HUD was specified to carry
everything audio usually would.

On 2026-09-20 the owner drove the first Android build and reversed it: *"I take
back that it doesn't need sound, it definitely does."*

That is the only evidence that matters. The original constraint was a guess
made before anyone had driven it; this is a judgement made after. The right
response to a constraint being tested and found wrong is to change it, not to
defend it.

## Decision

**The game has sound.** Three voices, all synthesised, all driven by the car.

1. **Engine** — oscillators at the firing frequency with a sub and a harmonic,
   through a lowpass that opens with load.
2. **Wind** — filtered noise rising with the square of speed.
3. **Tyres** — filtered noise whose colour is the surface and whose level
   carries lateral load.

And four rules that keep it the *kind* of sound this game wants:

- **No music.** The original instinct was right about one thing: a soundtrack
  would make this a different game. Nothing on the timeline, nothing with a
  key, nothing that repeats on a bar line.
- **No samples.** Everything is synthesised at runtime. A recorded engine
  cannot follow the revs without a crossfading playback engine behind it,
  weighs a megabyte, and is somebody else's car. Oscillators bend perfectly
  and add nothing to the APK.
- **No interface sound.** No clicks, no confirmations, no menu blips. Only the
  car and the air.
- **The visual channel stays complete.** The design doc's claim that the game
  must be legible in silence is not withdrawn — someone will play this with
  the phone muted, on a bus. Sound is now an addition to the feedback, never a
  replacement for it. The gauges still say everything.

## Alternatives considered

- **Keep it silent.** Rejected: the person who asked for silence has driven it
  and asked for sound. There is no stronger evidence available.
- **Samples of a real flat six.** Rejected on licensing, size, and the
  crossfade machinery it would need to track a continuously varying engine
  speed — which is the whole engine note in a game with no gears.
- **A music bed, calm and ambient.** Tempting for a game whose goal is to be
  soporific, and rejected anyway: the drive has no tempo, and anything with one
  would impose a rhythm on a world whose whole idea is that nothing happens on
  a schedule. Open to revisiting, as a decision of its own, once the car
  sounds right.
- **Sound as a `render/` concern.** Rejected: `render/` is the engine layer for
  WebGL, and hanging an unrelated output device off it would give one domain
  two reasons to change. Sound is its own domain.

## Consequences

- **A new sealed domain, `audio/`**, with the same rules as every other: it
  imports no other domain, owns its own constants in `audio/tuning.ts`, and
  reaches the car through the existing `car` and `controls` contracts. Adding
  it changed no other domain's code. That is the architecture (ADR-0011) doing
  exactly what it was built for, and it is the first time that claim has been
  tested by something nobody planned for.
- **Two additions to shared files**, both additive and both justified beyond
  audio: `CarView.maxRpm`, because `rpm` is meaningless without it and the
  Phase 4 tachometer needs it too; and `pause`/`resume` on `GameModule`,
  because an AudioContext keeps playing whatever it was last told while the
  game is backgrounded and nothing is stepping it.
- **Sound cannot start until the first touch.** Browsers, the Android WebView
  included, refuse audio before an interaction. The context starts suspended
  and resumes the first time `controls.active` goes true — which in a game you
  drive with one finger is the same moment the drive starts.
- **Non-negotiable 6 is rewritten rather than deleted.** "No audio, ever"
  becomes a rule about what kind of audio, because the part of the original
  instinct that was right — no music, no interface noise — is worth keeping as
  a rule rather than losing along with the part that was wrong.
- **A new phase.** Sound gets Phase 8 in the roadmap; what has landed now is a
  first slice, the way Phase 6's wrapper was.

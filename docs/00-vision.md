# 00 — Vision

*Last updated: 2026-09-17*

## The one-sentence version

You sit in a 1970s Porsche 911 and drive a road that never ends, through a
world that keeps quietly becoming somewhere else.

## What it should feel like

The target feeling is the last hour of a long drive home. Warm dashboard
lights, an empty road, the landscape sliding past. You are not trying to win.
You are driving because driving is pleasant.

Three feelings we are actively engineering for:

1. **Weight.** The car has mass. It leans into corners, squats under throttle,
   dives under braking. This is the single biggest contributor to "feels good"
   and it's cheap — it's all in one spring-damper.
2. **Somewhere-ness.** The world should feel like a place with a geography,
   not a treadmill. Crests you come over. Corners you can see into. Mountains
   that stay put on the horizon while you approach them.
3. **Unhurriedness.** Nothing flashes, nothing counts down, nothing is
   urgent. The HUD is almost absent. The only pressure is a slow car ahead.

## Design pillars

These break ties. When a decision is unclear, the earlier pillar wins.

1. **Feel over fidelity.** A car that handles beautifully in a simple world
   beats a car that handles badly in a detailed one.
2. **The view is the reward.** Every technical choice should be judged by
   whether it makes the windscreen more worth looking at.
3. **One finger, no thought.** The control scheme must be learnable in three
   seconds and usable half-asleep, one-handed, in the dark.
4. **Endless, not repetitive.** The generator's job is to keep producing
   things you haven't seen, without ever loading a screen.

## Explicit non-goals

Written down so we can point at them later instead of re-arguing:

- **No sound.** Confirmed by the brief. No engine note, no music, no UI
  clicks. The game must be fully legible silently — which means the HUD and
  the visual feedback carry all the information that audio usually would.
- **No fail state.** No crash screen, no game over, no respawn, no restart.
- **No oncoming traffic.** Same-direction only. See ADR-0005.
- **No multiplayer, no accounts, no network.** The game runs entirely offline.
  There is nothing to log into and nothing is uploaded.
- **No licensed content.** The car is a recognisable 1970s 911 *interior* in
  the sense of shape and layout — five round dials, thin three-spoke wheel,
  black vinyl. No badges, no model names, no marques, no branding anywhere in
  the game or the store listing. It's "a 70s sports car", legally speaking.
- **No monetisation.** No ads, no IAP, no analytics, no telemetry.
- **Not a racing sim.** No gearbox, no clutch, no tyre model, no setup screen.
- **Not an open world.** There is exactly one road. You cannot leave it in any
  meaningful sense — off-road is a penalty surface, not a destination.

## Who it's for

One person, in bed, holding their phone in one hand, winding down. If the
game is ever stressful, we've failed.

## How we'll know it worked

The honest test: you open it intending to play for two minutes, and look up
twenty minutes later without having thought about the score once.

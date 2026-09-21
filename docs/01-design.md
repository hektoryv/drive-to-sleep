# 01 — Game Design

*Last updated: 2026-09-18*

Everything here is a starting value to be tuned against the real thing, not a
law. Numbers live in `src/sim/tuning.ts` so they can be changed in one place.

## 1. The loop

There is one screen and one activity. You press start, and you are driving.
You drive until you stop driving. Distance accumulates, the world changes
around you, the sun moves. Occasionally you come up behind a slower car and
go around it.

That's it. The loop is a line, not a circle, which is the point.

## 2. Controls

### The gesture

One finger, anywhere on the screen. The control is a **dynamic-origin virtual
joystick**: wherever you first touch becomes the neutral point, and your
offset from that point is the input.

```
             ← finger offset from origin →

                      ▲  full throttle
                      │
       full left  ◄───●───►  full right      ● = touch origin (wherever you pressed)
                      │
                      ▼  full brake
```

- **X offset → steering.** Direct position mapping, not rate. Finger 60 px
  right of origin = wheel held 60 px right. Let go and it self-centres.
- **Y offset → longitudinal.** Up (toward the top of the phone) is throttle,
  down is brake. Neutral is coast.

### Why position-mapped steering

Because the brief asks the on-screen steering wheel to turn with the finger.
If steering were rate-based (finger held right = keep turning further right),
the wheel and the finger would immediately disagree. Position mapping means
**wheel angle is literally a function of finger offset**, so the wheel on the
dash is always exactly where your hand is. That direct correspondence is most
of the reason this control scheme will feel good.

### Parameters (starting values)

| Parameter | Value | Notes |
|---|---|---|
| `steerRadius` | 22% of screen width | Offset for full lock |
| `throttleRadius` | 14% of screen height | Offset for full throttle |
| `brakeRadius` | 12% of screen height | Shorter — brakes should be eager |
| `deadzone` | 4% of `steerRadius` | Stops micro-jitter from a resting thumb |
| `steerCurve` | `x * (0.35 + 0.65*x²)` | Fine control near centre, full lock available |
| origin drag | 1 radius, hard | See below |
| `releaseRecentre` | 6.0 /s exponential | How fast the wheel returns on lift-off |

### Origin drag

A real problem with dynamic-origin sticks: hold a long corner and your finger
walks to the edge of the screen and runs out of room. Fix: the **origin is
dragged along behind the finger**, never further than one radius away. Push
past full deflection and the origin comes with you, so the edge of the screen
is not a limit.

Note what it deliberately does *not* do: creep toward the finger on its own.
That was the first version and it silently un-steered the car — thirty seconds
of held lock decayed to half lock with the thumb completely still. See
ADR-0013.

### Lift-off behaviour

Lifting the finger is *not* an emergency stop. Steering returns to centre over
~0.3 s and the throttle goes to a gentle coast. The car keeps rolling. You can
put your finger down again anywhere and carry on. Putting the phone down
should feel like taking your hands off the wheel on a straight, not like
crashing.

### Accessibility

- Works identically for left and right thumb — nothing is anchored to a corner.
- No gesture requires more than one contact point.
- No timed or double-tap inputs anywhere in the game.
- A settings toggle inverts the Y axis for people who read "pull back = go".

## 3. The car

Arcade handling with a physical skeleton. Not a simulation — but the model is
real enough that the resulting motion is something you can predict and lean on.

### Model

Bicycle-ish model in world space (not road-relative), so leaving the road
happens naturally rather than as a special case.

State: `position(x,z)`, `yaw`, `velocity(x,z)`, `yawRate`, `speed`.

```
speed:     v' = throttle*accel(v) - brake*decel - drag*v² - rollingResist - grade*g
steering:  targetYawRate = (v / wheelbase) * tan(steerAngle * speedFalloff(v))
yaw:       yawRate → targetYawRate, spring-damped (gives the car a hint of inertia)
lateral:   grip limit per surface; exceeding it bleeds lateral velocity into a slide
```

`speedFalloff(v)` reduces effective lock at speed — this is what stops the car
feeling twitchy at 160 km/h, and it's the single most important handling
constant.

### Starting values

Measured from the built model, not estimated:

| Parameter | Value |
|---|---|
| Top speed | 189 km/h (drag-limited, not clamped) |
| 0–100 km/h | 5.8 s |
| 0–160 km/h | 12.2 s |
| 100–0 km/h | 40 m |
| Peak lateral | 0.85 g |
| Wheelbase | 2.27 m |
| Max steer angle | 32° at the wheels |
| Steer falloff | full lock below 30 km/h → 20% authority at top speed |
| Grip (tarmac / gravel / grass) | 1.0 / 0.62 / 0.45 |

Slightly quicker off the line and slower at the top end than the real car it
evokes, which suits a game where you are rarely at either extreme.

### Body attitude — the lean

This is pillar #1 and gets its own attention. Three angles, each a critically
damped spring driven by an acceleration:

| Angle | Driven by | Max | Frequency / damping |
|---|---|---|---|
| **Roll** (lean into corners) | lateral acceleration | 4.5° | 2.2 Hz, ζ 0.7 |
| **Pitch** (dive/squat) | longitudinal acceleration | 2.5° | 2.8 Hz, ζ 0.8 |
| **Heave** (body over bumps) | road grade change + surface | 4 cm | 3.2 Hz, ζ 0.6 |

Notes:

- The car leans **outward** in a corner (body roll on the outside springs), as
  a real car does. Getting this backwards is a classic and instantly wrong-looking.
- The camera and the whole cockpit inherit these angles, so the lean is
  something you feel through the windscreen moving, not something you watch
  happen to a car.
- Underdamping slightly (ζ ≈ 0.7) leaves a single soft overshoot on turn-in.
  That overshoot is what reads as "weight". Do not fully damp it.
- Roll is capped well below what a real car does; on a small screen, 4.5° is
  already a lot of horizon movement.

### The view leads the car

The camera is not bolted rigidly to the car's nose. It carries a look-ahead
yaw that turns it toward the road's heading roughly three quarters of a second
ahead, so you look through a corner rather than at the outside of it
(ADR-0010). Partway only, at 45% of the angle and capped at 14° — turning the
view fully into the corner would pin the road to the centre of the frame and
the corner would stop reading as a corner.

The yaw belongs to the driver's head, not the car. From Phase 4 the cockpit
stays with the car, so turning into a bend swings the A-pillars and the dash
across the view — the same thing your eyes do through a real windscreen.

### Off-road

Leaving the tarmac is a soft penalty rather than a fail state: grip drops,
drag rises, speed bleeds off, the heave spring gets a rumble input, and a
dust/grass particle wash will kick up. During environment development an
invisible safety wall follows the road 2 m beyond each tarmac edge, preventing
the car from falling through scenery that does not yet have a recovery flow.
It removes only outward velocity, so a scrape preserves motion along the road.

## 4. Traffic

Same-direction only. Soft collisions. (ADR-0005)

- **Density** rises slowly with distance driven, from near-empty at the start
  to a car every ~15 s of driving, capped. Never a queue.
- **Behaviour:** cars follow the road at 55–80% of your cruising speed, hold a
  lane with a slow lateral wander, and drift slightly wide in corners. They do
  not react to you, do not brake-check, and do not change lanes. Simple is
  correct here — unpredictable AI is stressful.
- **Spawning:** ahead of the player just beyond fog distance, despawned behind.
  Deterministic from the world seed and the distance bucket, so the same seed
  produces the same traffic.
- **Collision:** capsule vs capsule. On contact, both cars take an impulse, the
  player loses speed proportional to the closing rate, the camera takes a jolt
  (a pulse into the heave and roll springs), and a brief chromatic shudder
  plays. No damage, no spin-out, no reset. You can nudge a car for ten seconds
  and nothing bad will happen beyond going slowly.
- **Variety:** four or five low-poly silhouettes (saloon, estate, van, pickup,
  a second saloon) in a muted period palette. Seen from behind at distance,
  silhouette and colour are the entire read.

## 5. Scoring

Gentle. Visible if you look, invisible if you don't.

| Metric | Behaviour |
|---|---|
| **Distance** | Kilometres this drive. The primary number. |
| **Flow** | A 0–100 meter that rises while you're on tarmac and moving well, and drops on contact or off-road excursions. Recovers within ~10 s. |
| **Overtakes** | Counted, shown as a small tally. |
| **Best distance** | Persisted locally. Shown only on the start screen. |

Rules that keep it calm:

- Nothing is ever lost permanently. Flow always recovers.
- No combo timers, no multipliers, no "streak broken!" messaging.
- No leaderboards, no comparison to anyone else.
- The score does not gate content. Biomes and time of day are on their own
  schedule regardless of how you drive.

## 6. HUD

Portrait, so vertical space is precious and the dash already occupies the
bottom. The HUD is therefore almost nothing:

- **Speed** — rendered *on the tachometer/speedometer in the dash*, not as
  overlay text. It's a 70s car; it has gauges. Use them.
- **Distance** — small, top-left, low contrast, in km.
- **Flow** — a thin arc around the edge of one dial. No numbers.
- **Overtakes** — a tally that appears for 2 s when it increments, then fades.

The dash gauges are a feedback channel in their own right: the needle sweep
says what the engine note says, and it has to keep saying it, because the game
must work with the phone muted (ADR-0016). Sound doubles this channel; it
never replaces it.

## 6b. Sound

Three voices, all synthesised from the car's own state, all continuous — there
is nothing in the mix that starts, stops or repeats.

| Voice | Driven by | What it is for |
|---|---|---|
| **Engine** | rpm and throttle | The only thing that tells you the car is working rather than coasting. Quiet on a closed throttle however high the revs. |
| **Wind** | speed, squared | Speed, felt rather than read. It is the voice that makes 140 feel different from 90 when the road ahead looks the same. |
| **Tyres** | speed, surface, lateral g | What you are driving *on*, and how close to the limit. Gravel is loud and bright; it is how you know a wheel is off before you can see it. |

Tyre scrub rising with lateral load is the only warning the game gives that
the car is near the edge, since there is no fail state to find the edge with
(ADR-0005). That is deliberate: it is a warning you can ignore.

No music. The drive has no tempo, and anything with one would impose a rhythm
on a world whose whole idea is that nothing happens on a schedule.

## 7. Session shape

- **Start screen:** the car sitting at the roadside at dawn, engine idling,
  one control — a time-of-day choice is *not* offered (ADR-0006: the sun is on
  its own cycle). Tap anywhere to drive. Best distance in small text.
- **In-drive:** no pause button that stops the world. Pressing the system back
  button opens a small panel (resume / end drive) and the world holds.
- **Ending a drive:** a quiet summary — distance, overtakes, best-flow — then
  back to the start screen. No stars, no ranks, no "Try again!".
- **Resuming:** the app remembers where you were in the world. Coming back
  puts you at the same point on the same road, so the drive genuinely feels
  continuous across sessions.

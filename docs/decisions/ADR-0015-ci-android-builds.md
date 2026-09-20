# ADR-0015 — The APK is built in CI, and the native project is committed

**Date:** 2026-09-20 · **Status:** Accepted
**Relates to:** [ADR-0001](ADR-0001-tech-stack.md), [ADR-0008](ADR-0008-dev-feedback-loop.md)

## Context

Phase 2 is code complete and cannot be signed off from a still image (ADR-0008).
The exit criterion is that the car feels good, and feel is motion. The only way
forward is a build on a real phone.

The development container cannot make one. It has Node, a JDK, Gradle,
Chromium and Playwright, but no Android SDK — and it cannot fetch one:
`dl.google.com` is refused by the egress policy with a 403, which takes out
both the SDK packages and Google's Maven repository, where the Android Gradle
Plugin and every AndroidX artifact live. This is not a transient failure to
retry around; it is the sandbox working as configured.

So the machine that writes the code cannot compile the app. That is a fact
about the environment, and the question is only where the compile happens
instead.

## Decision

**GitHub Actions builds the APK, and the `android/` project is committed to the
repository.**

Two halves, and the second is the one with consequences.

A runner has the Android SDK, reaches Google's Maven, and starts from a clean
checkout of a pushed commit — which is a better property than the reason we
arrived at it. `.github/workflows/android.yml` runs the same lint and tests the
container does, builds the web bundle, `npx cap sync android`, then
`./gradlew assembleDebug`. The APK is uploaded as a run artifact *and* attached
to a rolling `dev` prerelease, so there is one unchanging URL that a phone can
open and install from directly. A zip of an artifact is not something a phone
can do anything useful with.

The native project has to be committed because it is not generic. The manifest
declares no permissions, the activity is portrait-locked, `MainActivity` holds
the screen awake and hides the system bars, the theme is cabin black to the
edges, and the launcher icon is the art target's sky. Regenerating it in CI
with `cap add android` would throw all of that away every run.

`.github/workflows/pages.yml` additionally publishes the web build to GitHub
Pages. Not a shipping target — the game ships as an APK — but installing an APK
costs a minute and opening a URL costs a second, and Phase 2 is tuned by
repetition. Chrome on Android runs the same Blink engine as the WebView, so the
one thing it cannot tell you is exactly the thing Phase 6 is watching for:
WebView-specific touch latency. Judge feel on Pages, confirm it in the app.

## Alternatives considered

- **Build on the owner's machine.** Works, and is where a release build will
  eventually be signed. Rejected as the default because it puts an Android
  Studio install between every change and every test drive, and because a build
  nobody but one laptop can produce is a build that silently rots.
- **Vendor the SDK into the repository.** Gigabytes, licence-encumbered, and
  it would make every checkout enormous to solve a problem one YAML file
  solves.
- **Fetch the SDK from a mirror.** This is routing around an explicit policy
  denial, which is not ours to do.
- **A third-party cloud build service.** Another account, another set of
  credentials, and the repository is already on a platform that has runners.

## Consequences

- **Never run `npx cap add android` again.** The directory is hand-edited. If
  the platform genuinely needs regenerating, do it in a scratch directory and
  port the diff — the files that matter are `AndroidManifest.xml`,
  `MainActivity.java`, `res/values/styles.xml`, `res/values/colors.xml` and the
  two launcher-icon vectors. `npx cap sync android` is the safe, routine one;
  it only copies web assets and plugin wiring.
- **The app requests no permissions**, including `INTERNET`, which the
  Capacitor template ships by default. Nothing in the app opens a socket: the
  WebView loads `https://localhost` through Capacitor's local asset loader,
  which intercepts the request before the network stack sees it. This keeps
  non-negotiable 8 true on the installed app and not just in the source. It is
  also the first thing to put back if a build ever comes up blank.
- **The `dev` build is signed with Android's debug key**, so it installs as an
  unknown-source app and cannot be distributed. Phase 6's exit criterion needs
  a release keystore in repository secrets; that is a separate decision and a
  separate job.
- Anything Android-specific is now reviewed by a machine that can actually
  compile it, which is more than the container could ever say.

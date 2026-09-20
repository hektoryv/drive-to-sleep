# Cockpit card art

These transparent sprites were generated for this project with OpenAI's
built-in image generator on 2026-09-21. The owner's cockpit sheet and the
project's portrait art target established the component design and palette; a
new asymmetric master composition established the realistic driver-eye scale.

| File | Runtime role |
|---|---|
| `cockpit-shell.png` | roof/headliner, driver-side A-pillar, mirror, bonnet and wipers |
| `dashboard-top.png` | near-horizontal scuttle and upper dash surface |
| `dashboard-face.png` | vertical five-dial dashboard and passenger-side falloff |
| `driver-door.png` | near left door on an inward-angled card |
| `steering-wheel.png` | isolated wheel on the closest tilted card |

The source generations were downscaled with Lanczos filtering for the phone
GPU. Together they occupy about 9.25 MiB before mipmaps and 1.24 MB on disk.
They deliberately contain no marque, crest, model number or readable branding.
Runtime assembly and two procedural contact-shadow cards live in
`cockpit/sprites.ts` (ADR-0019).

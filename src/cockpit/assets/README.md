# Cockpit sprite atlas

`cockpit-sprite-atlas.png` was generated for this project from the owner's
supplied cockpit sprite-sheet reference using OpenAI's built-in image generator
on 2026-09-21. It contains four transparent quadrants:

1. exterior frame, hood and mirrors;
2. dashboard and doors without a steering wheel;
3. warm/cool lighting overlay;
4. isolated steering wheel.

The atlas deliberately contains no marque, crest, model number or readable
branding. Runtime code in `cockpit/sprites.ts` samples the quadrants separately.

# Cubefield (fan clone)

A faithful browser clone of the original 2006 Flash game **Cubefield** by **Max Abernethy / Flecko.net**.

This is a fan clone. Cubefield and its original design belong to Max Abernethy.

## Run

Install and start a local dev server in /workspace/cubefield:

npm install
npm run dev

Open the URL Vite prints (usually http://localhost:5173).

npm run build   # typecheck + production bundle in dist/
npm run preview # serve dist/

The canvas is the original 550x400 stage, scaled to the window with letterboxing. vite.config.ts uses base "./" so dist/ can be opened from disk.

## Controls

- Left / Right arrows (or A / D): strafe
- Click, Enter, Space, or arrows: start from the menu
- P: pause
- Q: cycle quality HIGH, MEDIUM, LOW

## What is ported from the 2006 SWF

Simulation runs at a fixed 30 FPS timestep (the original enterFrame rate). Rendering may be 60 FPS; scores and physics use the 30 Hz step.

- SimpleProjection with u=0.3, v=0.22, native 550x400, offset at stage center
- World strafes; the ship is a 2D triangle at the bottom-center of the screen
- Acceleration / drag / idle damp, bank rotation of the cube layers
- Two draw layers (behind / in front of the ship), far-to-near, frustum cull
- Cube mesh, four faces, fill vs wireframe, fade-in alpha
- Collision, 24-frame invincibility blink, death fade + increasing blur, top score in localStorage
- Pattern sequence: Intake, Hall, Space, RandomCubes, Diamonds, Curves
- Style cycle: orange/gold solids, green wireframe (white score, dark bg), black solids, magenta/white
- Idle SpecialRandomCubes field and SPEED UP overlay after each round

## Approximations

- The original ship and menu are Flash movieclips; this clone redraws a similar dart triangle and vector HUD.
- Flash BlurFilter is approximated with canvas filter blur.
- Flash quality HIGH/MEDIUM/LOW is mapped to canvas smoothing and far-cube skipping.
- Device fonts (Arial) stand in for the SWF text.
- Space.Generate still returns [0] (a cube at world X=0), matching the decompiled method.
- When a pattern Done() fires, the original still Generates once from the previous pattern (often a no-op past the end of its table). This clone keeps that order.

No Phaser, no Three.js. TypeScript + Vite + HTML5 Canvas 2D only.

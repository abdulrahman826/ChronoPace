# RacingScene — isolated 3D F1 racing scene component

**Date:** 2026-09-02
**Status:** Approved

## Goal

A polished, self-contained 3D visual where a Haas F1 car reads as *actively racing
forward down a circuit* — not a 3D model on a turntable. Reusable, embeddable in a
rectangular dashboard panel, coupled to nothing (no backend, no decision engine, no
other ChronoPace feature).

Acceptance: first-time viewer thinks "that F1 car is racing down a track."

## Tech

Existing stack only: React 19, Three.js 0.185, @react-three/fiber 9, @react-three/drei 10.
No new dependencies.

## GLB inspection (done)

`frontend/public/models/vf26.glb` (Sketchfab Haas VF-26, 175 meshes, 589 nodes, 0 animations).

- Scale: ~1 unit = 1 metre (wheelbase ~3.4, track ~1.6).
- Clean wheel group nodes: `WHEEL_RF`, `WHEEL_LF`, `WHEEL_RR`, `WHEEL_LR`
  (full names have numeric suffixes, e.g. `WHEEL_RF_45_60`). Each contains the
  tyre (`TYRE_*`) and rim (`wheel_*`) as children.
- Wheel-node local translations (scene-root space):
  RF (-0.808, 0.361, +1.691), LF (+0.808, 0.361, +1.691),
  RR (-0.772, 0.359, -1.714), LR (+0.772, 0.359, -1.714).
  => local +Z is forward; local X is left/right; wheel centre height ~0.36.
- Tyre mesh local bbox: X ±0.16 (width), Y/Z ±0.33 (radial) => **axle = local X**,
  wheel radius ~0.33 m.
- Node transforms are baked as `matrix` (not TRS); GLTFLoader decomposes them, so
  additive `node.rotation.x += …` spins each wheel about its own axle around its
  own centre (no pivot offset needed).
- Loaded-scene world forward axis is verified in-browser (front vs rear wheel world
  positions) and corrected with a single `CAR_YAW` constant.

## Architecture

```
frontend/src/components/RacingScene/
  RacingScene.jsx        <RacingScene showOverlay speed className /> — Canvas + Scene
  RacingScene.module.css fills parent (100% w/h, position:relative, overflow:hidden)
  Car.jsx                GLB load + Box3 normalize + wheel-node spin + subtle bob/roll
  Road.jsx               scrolling CanvasTexture asphalt: grain, kerbs, lane markings
  TrackEnvironment.jsx   recycled barrier walls, grandstand silhouettes, sky, fog, markers
  Overlay.jsx            minimal CSS overlays (presentational constants)
  useRaceSpeed.js        shared speed value (m/s), subtle sine variation
```

Each unit has one purpose, communicates via props/context, testable/understandable alone.

## Motion model

One shared `speed` (m/s, ~85 ±3, slow sine) drives everything so all motion agrees:

| Consumer            | Rule                                         |
|---------------------|----------------------------------------------|
| Road texture        | `offset.y += speed * K_ROAD * delta`         |
| Wheels (×4)         | `rotation.x += (speed / RADIUS) * delta * DIR`|
| Barrier segments    | translate +Z at `speed`, recycle by modulo   |
| Grandstand planes   | translate at `speed * 0.15` (parallax), recycle|

Car stays ~centred; environment moves past it. No car orbit, no camera orbit, no
turntable, no visible loop reset (texture wrap + modulo recycle are seamless).

## Car

- `useGLTF('/models/vf26.glb')`, clone not required (single instance).
- Box3 normalize: uniform scale to ~4.6 units length; offset so `box.min.y` sits on
  `FLOOR_Y` (tyres touch road, no float/clip).
- `CAR_YAW` rotates group so nose points down-track (−Z world).
- Wheels found by name prefix; spun about local X each frame; sign tuned so top of
  wheel moves in travel direction. No steering (straight-line only).
- Life: vertical bob ±0.02, roll oscillation ~0.4°. Nothing that reads as rotation.
- All meshes `castShadow`; body does not receive shadow.

## Road

- Plane ~9 wide × ~120 long at `FLOOR_Y`, rotated flat.
- Procedural `THREE.CanvasTexture` (256×512): dark asphalt (#1b1d21) + grain, red/white
  kerb blocks both edges, solid edge lines, dashed centre line. `RepeatWrapping`,
  `repeat ≈ (1, 26)`. Anisotropy set from renderer caps.
- `meshStandardMaterial` roughness ~0.95, metalness ~0.04, slight `polygonOffset`.

## Environment (restrained)

- Background: dusk vertical gradient (near-black → deep blue-grey) as a CanvasTexture
  on `scene.background`.
- Barrier walls: ~8 low box segments per side, recycled by modulo — parallax without a
  120-unit mesh. Dark concrete with faint top stripe.
- Grandstand: 2–3 far flat dark silhouette planes, slow parallax.
- `fog` `#05070a`, near ~25, far ~95 — vanishing point, hides recycle seams.
- A handful of dim warm/cool marker sprites low by the barriers, opacity ≤ 0.4. Not neon.

## Camera & lighting

- Static camera: rear three-quarter, `position ≈ [3.2, 1.9, 6.5]`, `fov 40`,
  `lookAt(0, 0.3, -6)`. Car large + centred, road to horizon ahead, a little behind.
  Final values tuned by eye in browser.
- Lights: `hemisphereLight` fill + 1 key `directionalLight` (shadow caster, 1024 map) +
  1 cool rim `directionalLight` low intensity. drei `<ContactShadows>` under car.
- No post-processing, no bloom, no HDR fetch. Cyan only as faint rim tint.

## Overlay

Three small `position:absolute`, `pointer-events:none` labels: top-left
`LIVE RACE SIMULATION` + pulsing dot; bottom-left `SPEED 312 KM/H`; bottom-right
`LAP 34 / 58`. Presentational constants — no telemetry logic, no live-data claims.
`showOverlay` prop (default true).

## Responsive

Component fills parent container at 1366×768 / 1440×900 / 1920×1080. No page-level
scroll. `dpr={[1, 1.5]}`. Canvas resizes with container (r3f default).

## Performance

One GLB, shared/reused materials, 3 lights + contact shadows, procedural textures
(no downloads), recycled barrier segments, `frameloop="always"`. Target smooth on a
normal laptop.

## Mounting

- `App.jsx`: center column renders `<RacingScene />` in place of `<Viewport3D />`
  (one line). `Viewport3D.jsx` file left untouched in the repo.
- `main.jsx`: `?view=racing` in the URL renders `<RacingScene />` fullscreen for
  isolated viewing; dashboard otherwise unchanged.

## Out of scope

Backend, decision logic, Monte Carlo, Rival Energy, Compliance Probe, Circuit Map,
Opportunity Horizon, telemetry, data contracts, dashboard layout/header changes.

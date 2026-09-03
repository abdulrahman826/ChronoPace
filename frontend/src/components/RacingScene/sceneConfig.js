/**
 * Shared geometry constants for the scene. The car is now a stationary,
 * rotating subject (no road/travel concept) — kept as a separate module
 * anyway since Car.jsx and RacingScene.jsx both need to agree on where
 * "the ground" is.
 */

// World Y of the ground plane. The car is placed so its tyres sit exactly
// here (matches the ContactShadows plane in RacingScene.jsx).
export const FLOOR_Y = 0

// The car is normalised to this length (metres) regardless of the GLB's
// native units, so the fixed camera always frames it the same way.
// 6.5 / 4.9 = +32.7% — inside the requested 25-40% growth band. This is
// the single knob for on-screen car size: it changes what Car.jsx's own
// scale-normalisation math resolves to, with the camera (position/FOV),
// lighting, and environment in RacingScene.jsx untouched, per the
// explicit "smallest possible change, do not touch the camera/architecture
// unless necessary" instruction that came with this resize.
export const CAR_LENGTH = 6.5

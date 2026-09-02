# ChronoPace dashboard — layout redesign (Pass 1: layout + header/footer)

## Status

Approved by user 2026-09-02. Scope decided via two explicit choices during
brainstorming (see "Scope decisions" below). This is Pass 1 of 3 — see
"Deferred to later passes."

## Motivation

The user supplied a detailed 21-section redesign brief calling for a new
3-column dashboard composition (Rival Estimator/Recommendation/Monte Carlo
on the left, a large central 3D racing visual, a Circuit Map on the
right, a secondary info row, and a header/footer), replacing the current
2-column layout. The brief bundles three fairly independent pieces of
work with very different risk profiles: repositioning already-built
components into a new grid, building a net-new Circuit Map component, and
rebuilding the 3D viewport into a moving "road" scene. This spec covers
only the first.

## Scope decisions (from brainstorming)

1. **Sequencing**: layout + header/footer first. The 3D road/motion
   system and the Circuit Map's real logic are explicit follow-up passes,
   not part of this spec.
2. **Placeholder policy**: Circuit Map and Opportunity Timeline get
   honest, empty, correctly-sized placeholders — no fake data, no logic
   that could be mistaken for the real thing. Circuit Map placeholder:
   panel title + a minimal track-map-shaped empty area. Opportunity
   Timeline placeholder: labeled exactly `OPPORTUNITY TIMELINE — COMING
   WITH OPPORTUNITY HORIZON`. Both sized/positioned so the real
   components can drop in later without restructuring the page.

## In scope

- New page structure: header → 3-column main row → 3-item lower info row
  → footer strip.
- Reposition existing components into the new structure, unchanged
  internally: `RivalEstimator`, `DecisionBanner`, `MonteCarloPlanner`,
  `ComplianceProbe`, `Viewport3D`.
- Retire `TelemetryHeader.jsx`; its fields split into two new components
  (see below) since the new layout doesn't have a slot shaped like the
  old one.
- New components: `Header`, `EnergyStatus`, `CircuitMapPlaceholder`,
  `OpportunityTimelinePlaceholder`, `FooterStrip`.
- New mock data fields, each justified individually below — no field is
  added just because the brief's example showed a number for it.
- Mode-name display mapping (`ARM_OVERTAKE_MODE` → "ARM OVERTAKE", etc.),
  applied in `DecisionBanner` and `MonteCarloPlanner`. This also resolves
  the open "presentation-layer relabeling" question flagged in
  `context.md` §4 — mark that flag resolved as part of this work.
- Responsive behavior at ~1366×768, 1440×900, 1920×1080, following the
  collapse pattern already established in `App.module.css`
  (`@media (max-width: 1100px)` → single column); exact breakpoint(s) for
  the 3-column case are tuned empirically during implementation/
  verification, not fixed numbers in this spec.

## Out of scope (do not touch)

- Backend/decision-engine logic, all Pydantic-mirroring data shapes.
- Internal logic of `ComplianceProbe`, `MonteCarloPlanner`, `RivalEstimator`.
- `Viewport3D`'s 3D scene, camera, lighting, model, or turntable animation
  — reused exactly as-is, only its position/size in the grid changes.
- Any real Circuit Map or Opportunity Horizon computation or data.
- `PosteriorPlot.jsx`, `DistributionSparkline.jsx`, `GlassPanel.jsx`,
  `Icons.jsx` — unaffected.

## New page structure

```
┌─────────────────────────────────────────────────────────────┐
│                CHRONOPACE / AI MOTORSPORT INTELLIGENCE        │  Header
│                        SESSION · LAP x/y · CAR #n · TIME · LIVE│
├────────────────┬───────────────────────────┬──────────────────┤
│ RivalEstimator │                           │  CircuitMap       │
│ DecisionBanner │      Viewport3D           │  Placeholder      │
│ MonteCarlo-    │   (unchanged, centered,   │                   │
│  Planner       │    larger than today)     │                   │
├────────────────┴───────────────────────────┴──────────────────┤
│ EnergyStatus   │  ComplianceProbe   │ OpportunityTimeline       │
│ (new)          │  (unchanged)       │ Placeholder (new)         │
├─────────────────────────────────────────────────────────────┤
│   TRACK · TEMP · AIR · WIND · TYRE · DATA RATE · SYSTEM         │  FooterStrip
└─────────────────────────────────────────────────────────────┘
```

Implementation notes:
- Top-level: `Header` → `.dashboard` (3-column grid, row 1 = main,
  row 2 = lower info row spanning all 3 columns as its own 3-item
  sub-grid) → `FooterStrip`. Follows the existing CSS Grid + CSS Modules
  convention already used in `App.module.css` — no new styling approach
  introduced.
- Starting column ratio for row 1: roughly `1fr 1.5fr 1fr`
  (left/center/right), center weighted since it's the visual anchor per
  the brief. Treat as a starting point, adjust to taste during visual
  verification, not a hard requirement.

## Component changes, in detail

### `Header.jsx` (new)

Replaces `App.jsx`'s current bare `.pageTitle` div and absorbs
`TelemetryHeader`'s wordmark (dropping the duplicate — today both the
page title and `TelemetryHeader` render "CHRONOPACE"; the new layout has
exactly one).

Renders:
- Centered wordmark ("CHRONO" + "PACE" span, same styling convention as
  today) + new subtitle line "AI MOTORSPORT INTELLIGENCE".
- Top-right cluster: `session`, `lap`/`totalLaps`, `carNumber` (existing
  `telemetry` fields, moved here) + new `raceTimeLabel` field (see mock
  data below) + a small pulsing "LIVE" dot (CSS-only, no new data).

### `EnergyStatus.jsx` (new)

Takes over `speedKmh` and `ersSoC` from the retired `TelemetryHeader`,
relabeling the SoC value "Deployable" (it's the same number — current
deployable energy — just named for what it represents in this panel
rather than as a generic gauge). Adds `Mode`, sourced from
`confidenceGatePass.recommendedMode` through the same mode-label mapping
used elsewhere.

**Deliberately dropped from the brief's example**: "Harvest Rate" and
"Next Window." Neither maps to an existing mocked or spec'd value.
"Next Window" specifically would imply an Opportunity Horizon output,
which contradicts the placeholder policy above for the exact same
reason it applies to the Opportunity Timeline panel. If the user wants
these added anyway as clearly-fake placeholder values, that's a one-line
change — flagged here rather than decided silently.

### `CircuitMapPlaceholder.jsx` (new)

Title "CIRCUIT MAP", subtitle "TRACK OVERVIEW" (matches the brief's own
labels), an empty bordered/schematic area with no track shape, no
position markers, no legend — those all imply real data. A small caption
noting it's not yet implemented is fine; a fake track outline is not.

### `OpportunityTimelinePlaceholder.jsx` (new)

Title "OPPORTUNITY TIMELINE", body text exactly `COMING WITH OPPORTUNITY
HORIZON` per the user's explicit instruction. No lap axis, no bars, no
"best window" — those are the Opportunity Horizon's actual output.

### `FooterStrip.jsx` (new)

Renders `TRACK`, `TEMP`, `AIR`, `WIND`, `TYRE`, `DATA RATE`, `SYSTEM` from
new static mock fields (below). Treated the same as `session`/`carNumber`
today — scenario flavor for a fixed demo lap, not a claim of live
sensor/weather integration. Commented as such in `mockTelemetry.js`,
consistent with the file's existing header comment.

### `DecisionBanner.jsx` / `MonteCarloPlanner.jsx` (edited, not rebuilt)

Only change: raw mode enum strings (`USE_OVERTAKE_BONUS_MODE`) are passed
through a new label lookup before rendering, everywhere a mode name is
currently shown. Everything else (gates, stats line, demo toggle,
ranking, sparklines) is untouched.

### `rule_gate.py` / any backend file

Not touched. Nothing here affects backend spec.

## Mode label mapping (new, small, shared)

```js
export const MODE_LABELS = {
  CONSERVE_MODE: 'CONSERVE',
  BALANCED_MODE: 'BALANCED',
  ARM_OVERTAKE_MODE: 'ARM OVERTAKE',
  USE_OVERTAKE_BONUS_MODE: 'USE OVERTAKE BONUS',
  PUSH_MODE: 'PUSH',
}
```

Lives in `frontend/src/data/mockTelemetry.js` alongside the mode data it
labels, or a small sibling file — implementation's call, not spec-critical.

## New mock data — exact additions to `mockTelemetry.js`

Every new field below is either a genuine repositioning of an existing
value, or a clearly-flagged static demo value with no implied
intelligence. None represent a new computed/inferred result.

```js
// Added to the existing `telemetry` export:
raceTimeLabel: '24:32.456',   // cosmetic race-clock display only, no timing logic behind it

// New export, footer strip — static scenario flavor, same spirit as
// `telemetry.session`/`carNumber` above:
export const raceStatus = {
  track: 'MONZA',
  tempC: 26,
  airTempC: 24,
  windKmh: 6,
  tyre: 'MEDIUM',
  dataRateHz: 128,
  system: 'NOMINAL',
}
```

No new fields are added for "Harvest Rate," "Next Window," or any
Circuit Map / Opportunity Horizon content — see placeholder policy above.

## Verification plan

1. `npm run build` clean, dev server loads with no console errors.
2. Visual check at 1366×768, 1440×900, 1920×1080 (Browser pane
   `resize_window`) — 3-column composition holds at the two larger sizes,
   degrades gracefully (not broken/overflowing) at 1366×768.
3. Confirm every existing interaction still works: `DecisionBanner`'s
   "Demo: toggle scenario" button, `Viewport3D`'s rotation, all data
   still renders (nothing silently dropped in the move).
4. Confirm no duplicate "CHRONOPACE" wordmark remains.
5. Confirm mode names render as the new labels everywhere a mode name
   appears, including inside `DecisionBanner`'s override reason text if
   applicable.
6. Confirm placeholders render at correct size/position and contain no
   data-shaped content (no numbers, no fake track outline, no fake
   timeline).

## Open item carried into context.md

Once implemented, update `context.md` §4's "presentation-layer relabeling
— proposed, not resolved" note to resolved, referencing the mapping
above.

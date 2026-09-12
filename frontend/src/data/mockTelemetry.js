// Static reference data for the UI mockup. Field names deliberately mirror the
// real Pydantic contracts specified in context.md (GateResult, ModeProjection,
// ConfidenceGateResult, RivalSocEstimate) so swapping this for a real API
// response later is a data-source change, not a component rewrite.

export const telemetry = {
  session: 'RACE',
  lap: 34,
  totalLaps: 58,
  carNumber: 23,
  speedKmh: 312,
  ersSoC: { currentMj: 6.8, maxMj: 9.0 },
  // Cosmetic race-clock display only — no session-timing logic behind it.
  raceTimeLabel: '24:32.456',
}

// Presentation-layer labels for the 5 backend DeploymentMode values.
// This is display text only — code that reasons about modes anywhere
// else must keep using the raw enum strings below, never these labels.
export const MODE_LABELS = {
  CONSERVE_MODE: 'CONSERVE',
  BALANCED_MODE: 'BALANCED',
  ARM_OVERTAKE_MODE: 'ARM OVERTAKE',
  USE_OVERTAKE_BONUS_MODE: 'USE OVERTAKE BONUS',
  PUSH_MODE: 'PUSH',
}

// Presentation-layer labels for the backend's strategic-rival `role` enum
// (RivalBlock.role, added 2026-09-08). Same rule as MODE_LABELS above: this
// is display text only — the raw enum value is never altered, only relabeled
// for the UI, and `role` itself always comes straight from the backend.
export const ROLE_LABELS = {
  ATTACK_TARGET: 'ATTACK TARGET',
  DEFENDING_THREAT: 'DEFENDING THREAT',
  POSITION_BATTLE: 'POSITION BATTLE',
  STRATEGICALLY_RELEVANT: 'STRATEGICALLY RELEVANT',
  NONE: 'NO IMMEDIATE RIVAL',
}

// Footer strip — static scenario flavor for this fixed demo lap, same
// spirit as `telemetry.session`/`carNumber` above: not a claim of live
// weather/sensor integration. `dataMode` exists specifically so the UI
// never implies it's receiving live FIA/team telemetry.
export const raceStatus = {
  track: 'MONZA',
  tempC: 26,
  airTempC: 24,
  windKmh: 6,
  tyre: 'MEDIUM',
  dataRateHz: 128,
  system: 'NOMINAL',
  dataMode: 'SIMULATION / REPLAY',
}

// Stage 1 — Compliance Probe
export const complianceChecks = [
  { rule: 'MGU-K Power', value: 340, limit: 350, unit: 'kW', article: 'Art. 5.4.7', status: 'pass' },
  { rule: 'Lap Deployment', value: 7.2, limit: 9.0, unit: 'MJ', article: 'Art. 5.4.10', status: 'pass' },
  { rule: 'Delta SoC Swing', value: 3.1, limit: 4.0, unit: 'MJ', article: 'Art. 5.4.9', status: 'pass' },
]

export const overtakeBonus = {
  gapS: 0.82,
  thresholdS: 1.0,
  qualified: true,
  bankedFromLap: 33,
}

export const breachExample = {
  rule: 'Lap Deployment',
  value: 9.4,
  limit: 9.0,
  unit: 'MJ',
  article: 'Art. 5.4.10',
  status: 'breach',
}

// Stage 2 — Monte Carlo Planner (ModeProjection[])
// overtakeProbability = P(this mode's simulation beats the BALANCED baseline), NOT P(overtake completion)
// attackCompletionProbability = P(the overtake attempt itself succeeds); null for BALANCED/CONSERVE
export const modeProjections = [
  { rank: 1, mode: 'USE_OVERTAKE_BONUS_MODE', laptimeDeltaS: -0.28, stdS: 0.14, sharpe: 2.0, overtakeProbability: 0.71, attackCompletionProbability: null, energyCostMj: 1.5, extra: 'Overtake prob: 71%' },
  { rank: 2, mode: 'ARM_OVERTAKE_MODE', laptimeDeltaS: -0.20, stdS: 0.18, sharpe: 1.1, overtakeProbability: 0.68, attackCompletionProbability: null, energyCostMj: 1.2, extra: 'Qualify prob: 68%' },
  { rank: 3, mode: 'PUSH_MODE', laptimeDeltaS: -0.12, stdS: 0.10, sharpe: 1.2, overtakeProbability: 0.55, attackCompletionProbability: null, energyCostMj: 0.9, extra: null },
  { rank: 4, mode: 'BALANCED_MODE', laptimeDeltaS: 0.0, stdS: 0.06, sharpe: 0.0, overtakeProbability: 0.50, attackCompletionProbability: null, energyCostMj: 0.5, extra: 'baseline' },
  { rank: 5, mode: 'CONSERVE_MODE', laptimeDeltaS: 0.15, stdS: 0.05, sharpe: -3.0, overtakeProbability: 0.22, attackCompletionProbability: null, energyCostMj: 0.2, extra: null },
]

export const nIterations = 10000
// Counterfactual companion to the planner's top pick (hardening commit 01817ec)
export const runnerUpMode = null
export const modeValueGapS = null

// Rival Energy State Estimator (RivalSocEstimate + observables)
export const rivalEstimate = {
  meanSoCMj: 2.1,
  stdSoCMj: 0.6,
  socMaxMj: 9.0,
  terminalSpeedKmh: 298,
  clippingPointFraction: 0.62,
  nObservations: 14,
  attackTendency: 'MEDIUM',
  distribution: { low: 0.12, medium: 0.58, high: 0.30 },
  confidence: 0.42,
  estimateUncertain: false,
  evidenceQuality: 'moderate',
  posteriorHealth: 'healthy',
  baselineReady: true,
  pDefend: 0.38,
  freshnessLaps: 2,
}

// Dynamic strategic-rival selection (added 2026-09-08) — synthetic mode has
// no full race field for the backend to select a strategic opponent from, so
// this is null across the board, matching the live /api/v1/decision response
// itself (every field below comes back present-but-null, not omitted). This
// is the correct "no fabricated rival" default, not a placeholder to fill in.
export const strategicRival = {
  driver: null,
  role: null,
  position: null,
  gapS: null,
  ahead: null,
  relevanceScore: null,
}

// Stage 3 — ConfidenceGateResult (the "pass" demo state)
export const confidenceGatePass = {
  recommendedMode: 'USE_OVERTAKE_BONUS_MODE',
  stage2RecommendedMode: 'USE_OVERTAKE_BONUS_MODE',
  overridden: false,
  overrideReason: null,
  action: 'ATTACK_NOW',
  decisionConfidence: 0.64,
  gates: {
    statisticalReliability: true,
    practicalSignificance: true,
    dcli: true,
    rivalConfidence: true,
    dataQuality: true,
  },
  ciLowerBoundS: 0.08,
  minActionableLaptimeDeltaS: 0.05,
  tStatistic: 4.18,
  degreesOfFreedom: 18962,
  dcliScore: 38,
  rivalStdMj: 0.6,
  rivalThresholdMj: 1.5,
  nIterations,
}

// Alt state — the override/abstention demo case
export const confidenceGateOverride = {
  recommendedMode: 'BALANCED_MODE',
  stage2RecommendedMode: 'USE_OVERTAKE_BONUS_MODE',
  overridden: true,
  overrideReason: 'Rival confidence below threshold (σ 1.9 MJ > 1.5 MJ)',
  action: 'HOLD',
  decisionConfidence: 0.41,
  gates: {
    statisticalReliability: true,
    practicalSignificance: true,
    dcli: true,
    rivalConfidence: false,
    dataQuality: true,
  },
  ciLowerBoundS: 0.07,
  minActionableLaptimeDeltaS: 0.05,
  tStatistic: 3.62,
  degreesOfFreedom: 18944,
  dcliScore: 41,
  rivalStdMj: 1.9,
  rivalThresholdMj: 1.5,
  nIterations,
}

// Opportunity Horizon — ranked strategy windows from the backend
export const opportunity = {
  recommendedStrategy: 'ATTACK_NOW',
  prefersWait: false,
  foregoneStrategy: 'WAIT_2',
  foregoneValueGapS: 0.24,
  currentWindowOvertakeProb: 0.56,
  projectedWindowOvertakeProb: null,
  projectedWindowLap: null,
  uncertaintyNote: null,
  opportunityTrend: null,
  opportunityUncertain: false,
  rankedStrategies: [
    { name: 'ATTACK_NOW', delayLaps: 0, meanHorizonDeltaS: -0.40, stdHorizonDeltaS: 0.18, ciLowerS: -0.31, strategicValue: 1.40, currentOpportunityValue: 1.40, futureOpportunityValue: 0.0, energyOpportunityCost: 0.05, energySpentMj: 1.5, endSocMj: 5.3, attackCompletionProbability: null, attackCompletionProbabilityStd: null, utilityStd: null, downsideProbability: null },
    { name: 'WAIT_2', delayLaps: 2, meanHorizonDeltaS: -0.22, stdHorizonDeltaS: 0.21, ciLowerS: -0.12, strategicValue: 1.16, currentOpportunityValue: 0.90, futureOpportunityValue: 0.26, energyOpportunityCost: 0.08, energySpentMj: 1.2, endSocMj: 5.6, attackCompletionProbability: null, attackCompletionProbabilityStd: null, utilityStd: null, downsideProbability: null },
    { name: 'WAIT_5', delayLaps: 5, meanHorizonDeltaS: -0.10, stdHorizonDeltaS: 0.24, ciLowerS: -0.02, strategicValue: 0.87, currentOpportunityValue: 0.60, futureOpportunityValue: 0.27, energyOpportunityCost: 0.10, energySpentMj: 1.0, endSocMj: 5.8, attackCompletionProbability: null, attackCompletionProbabilityStd: null, utilityStd: null, downsideProbability: null },
    { name: 'HOLD', delayLaps: 10, meanHorizonDeltaS: 0.05, stdHorizonDeltaS: 0.28, ciLowerS: 0.12, strategicValue: 0.03, currentOpportunityValue: 0.10, futureOpportunityValue: -0.07, energyOpportunityCost: 0.02, energySpentMj: 0.5, endSocMj: 6.3, attackCompletionProbability: null, attackCompletionProbabilityStd: null, utilityStd: null, downsideProbability: null },
  ],
}

// ContextAttributionBlock — no live equivalent in mock/fallback mode (this
// block didn't exist before the chronopace-demo-ready backend); `null`
// throughout so the component renders its own honest "unavailable" state
// rather than a fabricated split, exactly as it would for a real backend
// response that omitted this block.
export const contextAttribution = null

// CounterfactualBlock — same reasoning as above.
export const counterfactual = null

// Reasoning trace — empty in fallback mode; DecisionTrace hides itself
// rather than inventing stage/detail text.
export const trace = []

// Regulatory feasibility — mirrors the fixed demo mode's own 5 modes as
// "candidate", all "feasible" (the mock demo never illustrates a rejection),
// nothing rejected. Real content when connected; a plausible static
// placeholder here, not a claim about any specific real scenario.
export const actions = {
  candidate: ['ATTACK_NOW', 'WAIT_2_LAPS', 'WAIT_5_LAPS', 'CONSERVE', 'HOLD'],
  feasible: ['ATTACK_NOW', 'WAIT_2_LAPS', 'WAIT_5_LAPS', 'CONSERVE', 'HOLD'],
  rejected: [],
}

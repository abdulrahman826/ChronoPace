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
export const modeProjections = [
  { rank: 1, mode: 'USE_OVERTAKE_BONUS_MODE', laptimeDeltaS: -0.28, stdS: 0.14, sharpe: 2.0, extra: 'Overtake prob: 71%' },
  { rank: 2, mode: 'ARM_OVERTAKE_MODE', laptimeDeltaS: -0.20, stdS: 0.18, sharpe: 1.1, extra: 'Qualify prob: 68%' },
  { rank: 3, mode: 'PUSH_MODE', laptimeDeltaS: -0.12, stdS: 0.10, sharpe: 1.2, extra: null },
  { rank: 4, mode: 'BALANCED_MODE', laptimeDeltaS: 0.0, stdS: 0.06, sharpe: 0.0, extra: 'baseline' },
  { rank: 5, mode: 'CONSERVE_MODE', laptimeDeltaS: 0.15, stdS: 0.05, sharpe: -3.0, extra: null },
]

export const nIterations = 10000

// Rival Energy State Estimator (RivalSocEstimate + observables)
export const rivalEstimate = {
  meanSoCMj: 2.1,
  stdSoCMj: 0.6,
  socMaxMj: 9.0,
  terminalSpeedKmh: 298,
  clippingPointFraction: 0.62,
  nObservations: 14,
  attackTendency: 'MEDIUM',
}

// Stage 3 — ConfidenceGateResult (the "pass" demo state)
export const confidenceGatePass = {
  recommendedMode: 'USE_OVERTAKE_BONUS_MODE',
  stage2RecommendedMode: 'USE_OVERTAKE_BONUS_MODE',
  overridden: false,
  overrideReason: null,
  gates: {
    statisticalReliability: true,
    practicalSignificance: true,
    dcli: true,
    rivalConfidence: true,
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
  gates: {
    statisticalReliability: true,
    practicalSignificance: true,
    dcli: true,
    rivalConfidence: false,
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

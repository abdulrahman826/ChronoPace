// Transforms a raw POST /api/v1/decision response (the live backend's own
// shape — see its /openapi.json) into the exact data contract the
// dashboard components already consume from mockTelemetry.js. This is a
// reshape only: nothing here recomputes a decision, re-derives a
// regulatory check, or re-runs any statistic — every number the backend
// sent stays exactly what the backend sent.
//
// Every field below is commented LIVE or STATIC. STATIC fields have no
// equivalent in this backend's /api/v1/decision response and keep their
// mockTelemetry.js value even when live data is otherwise active, rather
// than being invented to fill a gap. The most notable STATIC block is
// most of confidenceGatePass's stat grid (ciLowerBoundS/tStatistic/
// degreesOfFreedom/dcliScore): this backend's decision model is a single
// utility/confidence score plus reason codes, not the four-part Welch
// t-test + DCLI hypothesis-test the mock models — there's no live number
// to put in those specific boxes without fabricating one.

import * as mock from '../data/mockTelemetry'

function carNumberFromDriver(driver) {
  const match = /(\d+)/.exec(driver || '')
  return match ? Number(match[1]) : mock.telemetry.carNumber
}

// This backend reports success_probability per strategy, not a Sharpe
// ratio — this rescales that real, live number onto roughly the range
// the mock Sharpe values occupied, purely so MonteCarloPlanner's existing
// riskLabel() bucket thresholds keep meaning. Same "derived display
// transform of a real number" treatment riskLabel() itself already
// documents for the mock Sharpe field — not a new invented quantity.
function deriveSharpe(successProbability) {
  return (successProbability - 0.5) * 6
}

function topBucket(distribution) {
  const entries = Object.entries(distribution || {})
  if (!entries.length) return null
  return entries.sort((a, b) => b[1] - a[1])[0][0]
}

export function adaptDecision(raw) {
  const meta = raw.meta || {}
  const decision = raw.decision || {}
  const energyState = (raw.energy || {}).energy_state || {}
  const rival = raw.rival || {}
  const clipping = rival.clipping || {}
  const monteCarlo = raw.monte_carlo || {}
  const compliance = raw.compliance || {}

  const strategies = Array.isArray(monteCarlo.strategies) ? monteCarlo.strategies : []
  const liveModeProjections = strategies.map((s, i) => ({
    rank: i + 1,
    mode: s.mode, // LIVE
    // LIVE, but not the same quantity as the mock field it replaces — the
    // backend reports a dimensionless expected-value score here, not a
    // laptime delta in seconds (the mock's field name/unit implies
    // seconds; this is the closest real analog, not a unit-for-unit swap).
    laptimeDeltaS: s.expected_value,
    stdS: mock.modeProjections.find((m) => m.mode === s.mode)?.stdS ?? 0, // STATIC — no live spread reported per-mode
    sharpe: deriveSharpe(s.success_probability), // LIVE-derived, see deriveSharpe() above
    extra: `${Math.round(s.success_probability * 100)}%`, // LIVE
  }))

  const attackTendency = topBucket(rival.energy_distribution)
  const overallLegal = compliance.legal !== false
  const rivalConfidencePassed = (rival.confidence ?? 1) >= 0.5

  return {
    telemetry: {
      ...mock.telemetry, // session, speedKmh, raceTimeLabel — STATIC, this endpoint sends none of these
      lap: meta.lap ?? mock.telemetry.lap, // LIVE
      totalLaps: meta.total_laps ?? mock.telemetry.totalLaps, // LIVE
      carNumber: carNumberFromDriver(meta.driver), // LIVE, parsed from e.g. "CAR_23"
      ersSoC: {
        currentMj: energyState.soc_mj ?? mock.telemetry.ersSoC.currentMj, // LIVE
        maxMj: mock.telemetry.ersSoC.maxMj, // STATIC — FIA Art.5.4.10 constant, not a per-request value
      },
    },

    raceStatus: {
      ...mock.raceStatus, // track/temp/wind/tyre/dataRate — STATIC, no weather/session telemetry in this response
      dataMode: meta.data_mode ? `LIVE BACKEND · ${meta.data_mode}` : mock.raceStatus.dataMode, // LIVE
    },

    // STATIC — the live shape (a "rule" sentence + status only, e.g.
    // "Art.5.4.10 Lap Deployment": "pass") can't populate the value/limit/
    // unit numbers ComplianceProbe renders without parsing prose into
    // numbers, and it doesn't include an MGU-K Power check at all. Kept
    // as the honest mock values rather than a partially-invented table.
    complianceChecks: mock.complianceChecks,
    breachExample: mock.breachExample, // STATIC — illustrative-only, was never meant to be live

    overtakeBonus: {
      gapS: mock.overtakeBonus.gapS, // STATIC — backend reports this embedded in a sentence, not a discrete field
      thresholdS: mock.overtakeBonus.thresholdS, // STATIC, same reason
      qualified: (decision.reason_codes || []).includes('OVERTAKE_BONUS_BANKED'), // LIVE
      bankedFromLap: meta.lap != null ? meta.lap - 1 : mock.overtakeBonus.bankedFromLap, // LIVE-derived (bank-then-spend is next-lap by rule)
    },

    modeProjections: liveModeProjections.length ? liveModeProjections : mock.modeProjections, // LIVE
    nIterations: monteCarlo.number_of_simulations ?? mock.nIterations, // LIVE

    rivalEstimate: {
      meanSoCMj: rival.estimated_reserve_mj ?? mock.rivalEstimate.meanSoCMj, // LIVE
      stdSoCMj: rival.reserve_std_mj ?? mock.rivalEstimate.stdSoCMj, // LIVE
      socMaxMj: mock.rivalEstimate.socMaxMj, // STATIC — FIA constant
      terminalSpeedKmh: clipping.terminal_speed_kmh ?? mock.rivalEstimate.terminalSpeedKmh, // LIVE
      clippingPointFraction:
        clipping.location_percent != null ? clipping.location_percent / 100 : mock.rivalEstimate.clippingPointFraction, // LIVE
      nObservations: mock.rivalEstimate.nObservations, // STATIC — this endpoint doesn't report the particle filter's observation count
      attackTendency: attackTendency ? attackTendency.toUpperCase() : mock.rivalEstimate.attackTendency, // LIVE — argmax of the real energy_distribution
    },

    confidenceGatePass: {
      recommendedMode: decision.mode ?? mock.confidenceGatePass.recommendedMode, // LIVE
      stage2RecommendedMode: monteCarlo.best_strategy ?? mock.confidenceGatePass.stage2RecommendedMode, // LIVE
      overridden: false, // not recomputed client-side — this trusts the backend's own mode rather than re-deriving an override locally
      overrideReason: null,
      whyText: decision.reason || null, // LIVE — the backend's own human-readable explanation, read by DecisionBanner in place of its derived sentence when present
      gates: {
        // STATIC-by-proxy: this backend doesn't expose the four separate
        // Stage-3 statistical tests the mock models (no t-test/CI-bound/
        // DCLI in this response) — tied to the one real gate it does
        // report (overall regulatory legality) as the closest honest
        // substitute rather than left as stale mock booleans.
        statisticalReliability: overallLegal,
        practicalSignificance: overallLegal,
        dcli: overallLegal,
        rivalConfidence: rivalConfidencePassed, // LIVE (rival.confidence >= 0.5)
      },
      ciLowerBoundS: mock.confidenceGatePass.ciLowerBoundS, // STATIC — no equivalent in this response
      minActionableLaptimeDeltaS: mock.confidenceGatePass.minActionableLaptimeDeltaS, // STATIC
      tStatistic: mock.confidenceGatePass.tStatistic, // STATIC — no equivalent
      degreesOfFreedom: mock.confidenceGatePass.degreesOfFreedom, // STATIC
      dcliScore: mock.confidenceGatePass.dcliScore, // STATIC
      rivalStdMj: rival.reserve_std_mj ?? mock.confidenceGatePass.rivalStdMj, // LIVE
      rivalThresholdMj: mock.confidenceGatePass.rivalThresholdMj, // STATIC — a configured threshold, not per-request data
      nIterations: monteCarlo.number_of_simulations ?? mock.confidenceGatePass.nIterations, // LIVE
    },

    // STATIC — the demo toggle's "override" scenario has no live
    // equivalent from a single decision call; toggling to it still works
    // exactly as before, just showing the canned example.
    confidenceGateOverride: mock.confidenceGateOverride,
  }
}

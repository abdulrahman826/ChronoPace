// Transforms a raw POST /api/v1/decision response (the live backend's own
// DecisionSnapshot shape — see its /openapi.json) into the exact data
// contract the dashboard components already consume from mockTelemetry.js.
// This is a reshape only: nothing here recomputes a decision, re-derives a
// regulatory check, or re-runs any statistic — every number the backend
// sent stays exactly what the backend sent. Where a value is genuinely
// unavailable from this response, it falls back to mockTelemetry.js rather
// than being invented.
//
// Rewritten 2026-09-06 against a materially richer DecisionSnapshot than
// the one this file originally targeted (2026-09-03) — the backend now
// exposes data_quality, window, constraints, candidate/feasible/rejected
// actions, a full trace, and — notably — the ConfidenceBlock now carries
// the actual ci_lower_bound_s/t_statistic/dcli_score/four-named-gates this
// adapter previously had no live source for at all. See context.md's
// "Backend integration" section for the full field-by-field table; the
// comments below are the authoritative per-line version of that table.
//
// Two fields disappeared in this contract version and have no live
// replacement: SnapshotMeta dropped `driver`/`rival` (so `carNumber` can
// no longer be parsed from a live value), and RivalBlock dropped the old
// `clipping` sub-object entirely (so terminal speed / clipping-point-
// fraction have no live source either, where they used to). Both fall
// back to mock, noted inline.

import * as mock from '../data/mockTelemetry'

// "gap 0.732s / 1.0s" → [0.732, 1.0]. The live compliance check this reads
// from is a human sentence, not a structured field — parsed defensively;
// any format change just falls back to mock rather than misreading it.
function parseGapSeconds(detail) {
  const match = /gap\s+([\d.]+)s\s*\/\s*([\d.]+)s/i.exec(detail || '')
  return match ? { gapS: Number(match[1]), thresholdS: Number(match[2]) } : null
}

export function adaptDecision(raw) {
  const meta = raw.meta || {}
  const decision = raw.decision || {}
  const energy = raw.energy || {}
  const rival = raw.rival || {}
  const monteCarlo = raw.monte_carlo || {}
  const compliance = raw.compliance || {}
  const confidence = raw.confidence || {}

  const rankedModes = Array.isArray(monteCarlo.ranked_modes) ? monteCarlo.ranked_modes : []
  const liveModeProjections = rankedModes.map((m, i) => ({
    rank: i + 1,
    mode: m.mode, // LIVE
    laptimeDeltaS: m.mean_laptime_delta_s, // LIVE — a real laptime delta in seconds now, not a proxy score
    stdS: m.std_laptime_delta_s, // LIVE — previously STATIC (no per-mode spread was reported at all)
    sharpe: m.sharpe_ratio, // LIVE — the backend's own real Sharpe ratio; no more client-side rescale needed
    extra: `${Math.round(m.overtake_probability * 100)}%`, // LIVE
  }))

  const overtakeCheck = (compliance.checks || []).find((c) => /overtake mode proximity/i.test(c.rule))
  const parsedGap = parseGapSeconds(overtakeCheck?.detail)

  return {
    telemetry: {
      ...mock.telemetry, // session, speedKmh, raceTimeLabel — STATIC, this endpoint sends none of these
      lap: meta.lap ?? mock.telemetry.lap, // LIVE
      totalLaps: meta.total_laps ?? mock.telemetry.totalLaps, // LIVE
      carNumber: mock.telemetry.carNumber, // STATIC — SnapshotMeta no longer carries a driver/car field at all (dropped in this contract version; was live before)
      ersSoC: {
        currentMj: energy.soc_mj ?? mock.telemetry.ersSoC.currentMj, // LIVE
        maxMj: mock.telemetry.ersSoC.maxMj, // STATIC — FIA Art.5.4.10 constant, not a per-request value
      },
    },

    raceStatus: {
      ...mock.raceStatus, // track/temp/wind/tyre/dataRate — STATIC, no weather/session telemetry in this response
      dataMode: meta.data_mode ? `LIVE BACKEND · ${meta.data_mode}` : mock.raceStatus.dataMode, // LIVE
    },

    // STATIC — the live checks (rule/provenance/status/detail) don't carry
    // discrete value/limit/unit numbers ComplianceProbe's default rendering
    // expects; ComplianceProbe now also accepts a raw `detail` string
    // directly (see its own comments) and is handed the *real* live
    // checks via `liveComplianceChecks` below instead of this STATIC list
    // whenever they're available — this field stays as the fallback shape.
    complianceChecks: mock.complianceChecks,
    // LIVE — the actual 5 checks this snapshot ran, passed straight through
    // (rule/provenance/status/detail as the backend wrote them). Null when
    // not connected; ComplianceProbe falls back to complianceChecks above.
    liveComplianceChecks: Array.isArray(compliance.checks) ? compliance.checks : null,
    breachExample: mock.breachExample, // STATIC — illustrative-only, was never meant to be live

    overtakeBonus: {
      gapS: parsedGap?.gapS ?? mock.overtakeBonus.gapS, // LIVE when the proximity check's detail parses, else STATIC
      thresholdS: parsedGap?.thresholdS ?? mock.overtakeBonus.thresholdS, // LIVE/STATIC, same condition
      qualified: (raw.reason_codes || []).includes('OVERTAKE_BONUS_BANKED'), // LIVE
      bankedFromLap: meta.lap != null ? meta.lap - 1 : mock.overtakeBonus.bankedFromLap, // LIVE-derived (bank-then-spend is next-lap by rule)
    },

    modeProjections: liveModeProjections.length ? liveModeProjections : mock.modeProjections, // LIVE
    nIterations: monteCarlo.n_iterations ?? mock.nIterations, // LIVE

    rivalEstimate: {
      meanSoCMj: rival.mean_reserve_mj ?? mock.rivalEstimate.meanSoCMj, // LIVE
      stdSoCMj: rival.reserve_std_mj ?? mock.rivalEstimate.stdSoCMj, // LIVE
      socMaxMj: mock.rivalEstimate.socMaxMj, // STATIC — FIA constant
      terminalSpeedKmh: mock.rivalEstimate.terminalSpeedKmh, // STATIC — RivalBlock's old `clipping` sub-object (terminal_speed_kmh, location_percent, detected) is gone from this contract version; was live before, no replacement field exists
      clippingPointFraction: mock.rivalEstimate.clippingPointFraction, // STATIC, same reason
      nObservations: rival.n_observations ?? mock.rivalEstimate.nObservations, // LIVE — previously STATIC, this endpoint didn't report it at all before
      attackTendency: rival.bucket ? rival.bucket.toUpperCase() : mock.rivalEstimate.attackTendency, // LIVE — the backend now computes this bucket itself (previously this adapter argmax'd `energy_distribution` client-side; that derivation is gone, this reads the backend's own field directly)
    },

    confidenceGatePass: {
      recommendedMode: decision.mode ?? mock.confidenceGatePass.recommendedMode, // LIVE
      stage2RecommendedMode: decision.stage2_mode ?? mock.confidenceGatePass.stage2RecommendedMode, // LIVE — "planner's top pick before the confidence gate", per the backend's own field description
      overridden: decision.confidence_overridden ?? false, // LIVE — previously hardcoded false client-side; the backend now reports this itself
      overrideReason: decision.override_reason || null, // LIVE
      // LIVE — prefers the real `reasons` sentence list joined into one
      // line; falls back to the backend's own `narrative` prose (requested
      // via with_narrative:true) only if reasons is empty. Deliberately
      // NOT narrative-first even though narrative exists: its template
      // repeats "Decision: X / Confidence: Y%" verbatim, which this panel
      // already shows in its own headline and stat grid — reasons alone
      // reads as the natural continuation of that, not a restatement of
      // it. Either way this is backend text, never composed here.
      whyText: raw.reasons && raw.reasons.length ? raw.reasons.join(' ') : raw.narrative || null,
      gates: {
        // LIVE — all four now come directly from ConfidenceBlock's own
        // named booleans. Previously none of these had a real per-gate
        // source (this backend didn't expose the Stage-3 breakdown at
        // all); rivalConfidence in particular used to be a `rival.confidence
        // >= 0.5` threshold computed client-side — that's gone, replaced
        // by reading the backend's own `rival_confidence_passed` boolean,
        // which is exactly the "don't put strategy logic in the frontend"
        // fix that threshold needed.
        statisticalReliability: confidence.statistical_reliability_passed ?? mock.confidenceGatePass.gates.statisticalReliability,
        practicalSignificance: confidence.practical_significance_passed ?? mock.confidenceGatePass.gates.practicalSignificance,
        dcli: confidence.dcli_passed ?? mock.confidenceGatePass.gates.dcli,
        rivalConfidence: confidence.rival_confidence_passed ?? mock.confidenceGatePass.gates.rivalConfidence,
      },
      ciLowerBoundS: confidence.ci_lower_bound_s ?? mock.confidenceGatePass.ciLowerBoundS, // LIVE — previously STATIC, no equivalent existed in the old contract
      minActionableLaptimeDeltaS: mock.confidenceGatePass.minActionableLaptimeDeltaS, // STATIC — a configured practical-significance floor, not returned by this endpoint
      tStatistic: confidence.t_statistic ?? mock.confidenceGatePass.tStatistic, // LIVE — previously STATIC
      degreesOfFreedom: mock.confidenceGatePass.degreesOfFreedom, // STATIC — still no equivalent in this contract
      dcliScore: confidence.dcli_score ?? mock.confidenceGatePass.dcliScore, // LIVE — previously STATIC
      rivalStdMj: rival.reserve_std_mj ?? mock.confidenceGatePass.rivalStdMj, // LIVE
      rivalThresholdMj: mock.confidenceGatePass.rivalThresholdMj, // STATIC — a configured threshold, not per-request data
      nIterations: monteCarlo.n_iterations ?? mock.confidenceGatePass.nIterations, // LIVE
    },

    // STATIC — the demo toggle's "override" scenario has no live
    // equivalent from a single decision call; toggling to it still works
    // exactly as before, just showing the canned example.
    confidenceGateOverride: mock.confidenceGateOverride,
  }
}

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
  const opportunity = raw.opportunity || {}

  const rankedModes = Array.isArray(monteCarlo.ranked_modes) ? monteCarlo.ranked_modes : []
  const liveModeProjections = rankedModes.map((m, i) => ({
    rank: i + 1,
    mode: m.mode, // LIVE
    laptimeDeltaS: m.mean_laptime_delta_s, // LIVE — a real laptime delta in seconds now, not a proxy score
    stdS: m.std_laptime_delta_s, // LIVE — previously STATIC (no per-mode spread was reported at all)
    sharpe: m.sharpe_ratio, // LIVE — the backend's own real Sharpe ratio; no more client-side rescale needed
    // LIVE — P(this mode's simulation beats the BALANCED baseline), NOT P(overtake completion)
    overtakeProbability: m.overtake_probability ?? null,
    energyCostMj: m.energy_cost_mj ?? null, // LIVE
    extra: `${Math.round(m.overtake_probability * 100)}%`, // kept for backward compat — prefer overtakeProbability
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
        maxMj: energy.soc_capacity_mj ?? mock.telemetry.ersSoC.maxMj, // LIVE (FIA constant 9.0, now backend-confirmed)
      },
      // additive — new EnergyBlock accounting fields (all MODEL_ASSUMPTION, from hardening commit 663c4a3)
      lapDeployedMj: energy.deployed_this_lap_mj ?? null, // LIVE — modeled deployment from real throttle trace
      lapRecoveredMj: energy.recovered_this_lap_mj ?? null, // LIVE — modeled recovery this lap
      mguKPeakKw: energy.modeled_mgu_k_peak_kw ?? null, // LIVE — modeled peak MGU-K power this lap
      energyIsModeled: energy.energy_is_modeled ?? true, // LIVE — always true for replay
    },

    raceStatus: {
      ...mock.raceStatus, // track/temp/wind/tyre/system — STATIC, no weather/session telemetry in this response
      dataRateHz: null, // suppressed — backend doesn't expose cadence at the per-decision level; 128 was fabrication (§5)
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
      meanSoCMj: rival.mean_reserve_mj ?? mock.rivalEstimate.meanSoCMj, // LIVE — as of the dynamic-strategic-rival backend (2026-09-08), this whole block is already computed against whichever driver `strategicRival.driver` below names, not a fixed focus rival; nothing here needed to change for that, it just started meaning something more specific
      stdSoCMj: rival.reserve_std_mj ?? mock.rivalEstimate.stdSoCMj, // LIVE
      socMaxMj: mock.rivalEstimate.socMaxMj, // STATIC — FIA constant
      terminalSpeedKmh: mock.rivalEstimate.terminalSpeedKmh, // STATIC — RivalBlock's old `clipping` sub-object (terminal_speed_kmh, location_percent, detected) is gone from this contract version; was live before, no replacement field exists
      clippingPointFraction: mock.rivalEstimate.clippingPointFraction, // STATIC, same reason
      nObservations: rival.n_observations ?? mock.rivalEstimate.nObservations, // LIVE — previously STATIC, this endpoint didn't report it at all before
      attackTendency: rival.bucket ? rival.bucket.toUpperCase() : mock.rivalEstimate.attackTendency, // LIVE — the backend now computes this bucket itself (previously this adapter argmax'd `energy_distribution` client-side; that derivation is gone, this reads the backend's own field directly)
      // New fields from hardened contract
      distribution: rival.distribution ?? mock.rivalEstimate.distribution, // LIVE — {low, medium, high} posterior probabilities
      confidence: rival.confidence ?? mock.rivalEstimate.confidence, // LIVE — 1 - normalized posterior std
      estimateUncertain: rival.estimate_uncertain ?? mock.rivalEstimate.estimateUncertain, // LIVE
      evidenceQuality: rival.evidence_quality ?? mock.rivalEstimate.evidenceQuality, // LIVE
      posteriorHealth: rival.posterior_health ?? mock.rivalEstimate.posteriorHealth, // LIVE
      baselineReady: rival.baseline_ready ?? mock.rivalEstimate.baselineReady, // LIVE
      pDefend: rival.p_defend ?? mock.rivalEstimate.pDefend, // LIVE — P(rival actively defends)
      freshnessLaps: rival.freshness_laps ?? mock.rivalEstimate.freshnessLaps, // LIVE
    },

    // LIVE — added 2026-09-08 alongside the backend's dynamic strategic-rival
    // selection (commit 99f58d2, engine repo). RivalBlock now additively
    // carries `driver`/`role`/`strategic_position`/`strategic_gap_s`/
    // `strategic_rival_ahead`/`relevance_score` — always present, `null`
    // across the board on synthetic responses (confirmed live: the backend
    // has no full field to select a strategic opponent from there), so this
    // reads as pure identity/role metadata, computed entirely server-side.
    // Nothing here decides who the strategic rival is or what role they're
    // in — it only reshapes the names.
    strategicRival: {
      driver: rival.driver ?? mock.strategicRival.driver, // LIVE — 3-letter code, or null (synthetic / no rival selected)
      role: rival.role ?? mock.strategicRival.role, // LIVE — raw backend enum (ATTACK_TARGET/DEFENDING_THREAT/POSITION_BATTLE/STRATEGICALLY_RELEVANT/NONE); presentation-only relabeling happens in the component, the enum value itself is never altered here
      position: rival.strategic_position ?? mock.strategicRival.position, // LIVE
      gapS: rival.strategic_gap_s ?? mock.strategicRival.gapS, // LIVE
      ahead: rival.strategic_rival_ahead ?? mock.strategicRival.ahead, // LIVE
      relevanceScore: rival.relevance_score ?? mock.strategicRival.relevanceScore, // LIVE
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
      action: decision.action ?? mock.confidenceGatePass.action, // LIVE — ATTACK_NOW | WAIT_2_LAPS | WAIT_5_LAPS | HOLD | PUSH | CONSERVE
      decisionConfidence: decision.confidence ?? mock.confidenceGatePass.decisionConfidence, // LIVE — same as confidence.overall
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
        dataQuality: confidence.data_quality_passed ?? mock.confidenceGatePass.gates.dataQuality, // LIVE
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

    // LIVE — Opportunity Horizon block: ranked strategies with horizon deltas,
    // strategic values, and window probability. All fields passed through as-is
    // (camelCase reshape only); nothing computed client-side.
    opportunity: {
      recommendedStrategy: opportunity.recommended_strategy ?? null,
      prefersWait: opportunity.prefers_wait ?? null,
      foregoneStrategy: opportunity.foregone_strategy ?? null,
      foregoneValueGapS: opportunity.foregone_value_gap_s ?? null,
      currentWindowOvertakeProb: opportunity.current_window_overtake_prob ?? null,
      projectedWindowOvertakeProb: opportunity.projected_window_overtake_prob ?? null,
      projectedWindowLap: opportunity.projected_window_lap ?? null,
      uncertaintyNote: opportunity.uncertainty_note ?? null,
      opportunityTrend: opportunity.opportunity_trend ?? null,
      opportunityUncertain: opportunity.opportunity_uncertain ?? null,
      rankedStrategies: Array.isArray(opportunity.ranked_strategies)
        ? opportunity.ranked_strategies.map((s) => ({
            name: s.name,
            delayLaps: s.delay_laps ?? null,
            meanHorizonDeltaS: s.mean_horizon_delta_s ?? null,
            stdHorizonDeltaS: s.std_horizon_delta_s ?? null,
            ciLowerS: s.ci_lower_s ?? null,
            strategicValue: s.strategic_value ?? null,
            currentOpportunityValue: s.current_opportunity_value ?? null,
            futureOpportunityValue: s.future_opportunity_value ?? null,
            energyOpportunityCost: s.energy_opportunity_cost ?? null,
            energySpentMj: s.energy_spent_mj ?? null,
            endSocMj: s.end_soc_mj ?? null,
          }))
        : mock.opportunity.rankedStrategies,
    },
  }
}

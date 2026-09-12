import { useState } from 'react'
import GlassPanel from './GlassPanel'
import { RadarIcon } from './Icons'
import StrategicRivalTimeline from './StrategicRivalTimeline'
import { useDashboardData } from '../services/DashboardDataContext'
import { ROLE_LABELS } from '../data/mockTelemetry'
import styles from './RivalEstimator.module.css'

function rolePillClass(role) {
  if (role === 'ATTACK_TARGET') return styles.roleAttack
  if (role === 'DEFENDING_THREAT') return styles.roleDefend
  if (role === 'NONE') return styles.roleNone
  return styles.roleNeutral // POSITION_BATTLE, STRATEGICALLY_RELEVANT
}

/**
 * Honest uncertainty-range visualization: a horizontal track from 0 to socMax
 * with a shaded band for mean ± std and a line marker at mean.
 *
 * Deliberately NOT a probability density curve — the backend only exposes
 * mean/std, so we only draw what the data can honestly support: a range,
 * not a distribution shape. See context.md §6.
 */
function RangeBar({ mean, std, socMax }) {
  const W = 300
  // Was 40 — trimmed to 30 (aspect ratio only, purely visual) to reclaim
  // vertical room in RivalEstimator's tightest height tiers; every other
  // coordinate below is derived from H so the drawing stays proportional.
  const H = 30
  const padX = 18
  const trackY = H / 2 + 3
  const trackW = W - padX * 2
  const clamp = (v) => Math.max(0, Math.min(1, v / socMax))
  const toX = (mj) => padX + clamp(mj) * trackW
  const x0 = toX(mean - std)
  const x1 = toX(mean + std)
  const mx = toX(mean)
  // Keep mean label from overlapping axis labels near the edges
  const labelAnchor = mx < padX + 24 ? 'start' : mx > W - padX - 24 ? 'end' : 'middle'

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
    >
      {/* Base track */}
      <line x1={padX} y1={trackY} x2={W - padX} y2={trackY} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {/* End ticks */}
      <line x1={padX} y1={trackY - 4} x2={padX} y2={trackY + 4} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      <line x1={W - padX} y1={trackY - 4} x2={W - padX} y2={trackY + 4} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      {/* Uncertainty band */}
      <rect x={x0} y={trackY - 5.5} width={Math.max(0, x1 - x0)} height={11} fill="rgba(200,190,186,0.13)" rx="2" />
      <rect x={x0} y={trackY - 5.5} width={Math.max(0, x1 - x0)} height={11} fill="none" stroke="rgba(200,190,186,0.18)" strokeWidth="0.5" rx="2" />
      {/* Mean marker */}
      <line x1={mx} y1={trackY - 7} x2={mx} y2={trackY + 7} stroke="rgba(245,240,238,0.82)" strokeWidth="1.5" />
      {/* Axis labels */}
      <text x={padX} y={H - 1} fontSize="8" fill="rgba(107,91,88,0.85)" fontFamily="var(--font-mono)" textAnchor="middle">0</text>
      <text x={W - padX} y={H - 1} fontSize="8" fill="rgba(107,91,88,0.85)" fontFamily="var(--font-mono)" textAnchor="end">{socMax.toFixed(0)} MJ</text>
      {/* Mean value label */}
      <text x={mx} y={H - 1} fontSize="8" fill="rgba(168,150,146,0.9)" fontFamily="var(--font-mono)" textAnchor={labelAnchor}>{mean.toFixed(1)}</text>
    </svg>
  )
}

/** Left column, bottom slot — ChronoPace's probabilistic belief about the
 * rival's hidden energy state, inferred from observable performance behaviour.
 * Nothing here is directly measured — see the footer disclaimer and context.md §6. */
export default function RivalEstimator() {
  const { rivalEstimate, strategicRival, historical, loadStrategicRivalTimeline, confidenceGatePass } = useDashboardData()
  const { meanSoCMj, stdSoCMj, socMaxMj, nObservations, attackTendency, distribution, confidence, evidenceQuality, pDefend } = rivalEstimate
  const inferenceGatePassed = confidenceGatePass.gates.rivalConfidence
  const [timelineOpen, setTimelineOpen] = useState(false)

  const hasStrategicRival = strategicRival.role != null
  const isNone = strategicRival.role === 'NONE'
  const tickLevel = historical.active && historical.tickSummary?.tickLevel
  const changesThisLap = historical.tickSummary?.changesThisLap

  const handleToggleTimeline = () => {
    const next = !timelineOpen
    setTimelineOpen(next)
    if (next) {
      loadStrategicRivalTimeline({
        race: historical.race, lap: historical.lap, driver: historical.driver, rival: historical.rival,
        season: historical.season, event: historical.seasonEvent, session: historical.sessionCode,
      })
    }
  }

  return (
    <GlassPanel className={styles.wrap}>

      {/* ── Header ── */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <div className="panelHeaderRow">
            <RadarIcon width={18} height={18} />
            <h3>RIVAL ENERGY STATE</h3>
          </div>
          <div className={styles.subtitle}>BAYESIAN POSTERIOR · PARTICLE FILTER</div>
        </div>
        <div className={styles.inferenceBadge}>
          <span className={styles.inferenceLabel}>INFERENCE</span>
          <span className={`${styles.inferenceDot} ${inferenceGatePassed ? styles.inferenceDotPass : styles.inferenceDotWarn}`} />
        </div>
      </div>

      {/* Everything below the header in one scrollable region — at the
          tightest supported viewport heights this card's content can still
          exceed the space the 3-column layout leaves it even after
          tightening every margin/font available; scrolling just this body
          (never the header, never the whole page) is the documented
          last-resort per the layout brief, not a workaround for the cases
          above where tightening alone was enough (it already is, at
          1440x900 and 1920x1080 — this only ever engages below that). */}
      <div className={styles.body}>

      {/* ── Strategic rival identity (conditional — null in synthetic mode) ── */}
      {hasStrategicRival && (
        <div className={styles.strategicRow}>
          <div className={styles.strategicId}>
            <span className={styles.strategicLabel}>Strategic Rival</span>
            <div className={styles.strategicHeadline}>
              <span className={`num ${styles.strategicDriver}`}>{isNone ? 'NONE' : strategicRival.driver}</span>
              {!isNone && strategicRival.position != null && strategicRival.gapS != null && (
                <span className={`num ${styles.strategicGap}`}>
                  P{strategicRival.position} &middot; {strategicRival.gapS.toFixed(2)}s {strategicRival.ahead ? 'AHEAD' : 'BEHIND'}
                </span>
              )}
            </div>
          </div>
          <div className={styles.strategicMeta}>
            <span className={`${styles.rolePill} ${rolePillClass(strategicRival.role)}`}>
              {ROLE_LABELS[strategicRival.role] ?? strategicRival.role}
            </span>
            {!isNone && strategicRival.relevanceScore != null && (
              <div className={styles.relevance}>
                <span className={styles.relevanceLabel}>Relevance</span>
                <span className="num">{Math.round(strategicRival.relevanceScore * 100)}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Primary estimate ── */}
      <div className={styles.estimateRow}>
        <div className={styles.estimateMain}>
          <span className={styles.fieldLabel}>ESTIMATED ENERGY</span>
          <div className={styles.estimateValue}>
            <span className={`num ${styles.estimateNum}`}>{meanSoCMj.toFixed(1)}</span>
            <span className={styles.estimateUnit}>MJ</span>
          </div>
          <span className={`num ${styles.estimateUncertainty}`}>±{stdSoCMj.toFixed(1)} MJ uncertainty</span>
        </div>
        <div className={styles.estimateSide}>
          <div className={styles.sideItem}>
            <span className={styles.fieldLabel}>OBSERVATIONS</span>
            <span className={`num ${styles.sideValue}`}>{nObservations}</span>
          </div>
          <div className={styles.sideItem}>
            <span className={styles.fieldLabel}>STATE BELIEF</span>
            {distribution ? (
              <div className={styles.distribution}>
                <span className={`num ${styles.distRow}`}><span className={styles.distKey}>L</span>{Math.round(distribution.low * 100)}%</span>
                <span className={`num ${styles.distRow}`}><span className={styles.distKey}>M</span>{Math.round(distribution.medium * 100)}%</span>
                <span className={`num ${styles.distRow}`}><span className={styles.distKey}>H</span>{Math.round(distribution.high * 100)}%</span>
              </div>
            ) : (
              <span className={`num ${styles.sideValue}`}>{attackTendency}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Honest uncertainty-range visualization (mean ± std on 0..socMax) ── */}
      <div className={styles.rangeBarWrap}>
        <RangeBar mean={meanSoCMj} std={stdSoCMj} socMax={socMaxMj} />
      </div>

      {/* ── Confidence gate / observable inputs / evidence quality / P(defend) —
           one 2x2 block (was two stacked rows, each with its own border+
           margin) so the section reads as one "gate + evidence" group
           without the duplicated seam. Same four values, same order. ── */}
      <div className={styles.metaRow}>
        <div className={styles.metaItem}>
          <span className={styles.fieldLabel}>CONFIDENCE GATE</span>
          <span className={`num ${styles.metaValue} ${inferenceGatePassed ? styles.gatePassed : styles.gateWarning}`}>
            {inferenceGatePassed ? 'PASSED' : 'FAILED'}
            {confidence != null && <span className={styles.gateConfidence}> · {Math.round(confidence * 100)}%</span>}
          </span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.fieldLabel}>OBSERVABLE INPUTS</span>
          <span className={styles.evidenceInputs}>Speed · Accel · Sector · Terminal</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.fieldLabel}>EVIDENCE QUALITY</span>
          <span className={`num ${styles.metaValue}`}>{evidenceQuality ? evidenceQuality.toUpperCase() : '—'}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.fieldLabel}>P(DEFEND)</span>
          <span className={`num ${styles.metaValue}`}>{pDefend != null ? `${Math.round(pDefend * 100)}%` : '—'}</span>
        </div>
      </div>

      {/* ── Telemetry-cadence tick info (historical replay only) ── */}
      {tickLevel && (
        <div className={styles.tickRow}>
          <span className={styles.tickNote}>
            {changesThisLap === 1 ? '1 change' : `${changesThisLap ?? 0} changes`} this lap (telemetry-cadence)
          </span>
          <button type="button" className={styles.tickToggle} onClick={handleToggleTimeline}>
            {timelineOpen ? 'Hide timeline' : 'Show timeline'}
          </button>
        </div>
      )}
      {tickLevel && timelineOpen && (
        <StrategicRivalTimeline
          timeline={historical.timeline}
          loading={historical.timelineLoading}
          error={historical.timelineError}
        />
      )}

      {/* ── Footer disclaimer ── */}
      <div className={styles.footer}>MODELED · NOT MEASURED</div>

      </div>
    </GlassPanel>
  )
}

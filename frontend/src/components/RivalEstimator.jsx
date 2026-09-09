import { useState } from 'react'
import GlassPanel from './GlassPanel'
import { RadarIcon } from './Icons'
import PosteriorPlot from './PosteriorPlot'
import StrategicRivalTimeline from './StrategicRivalTimeline'
import { useDashboardData } from '../services/DashboardDataContext'
import { ROLE_LABELS } from '../data/mockTelemetry'
import styles from './RivalEstimator.module.css'

// role -> pill color class. ATTACK_TARGET/DEFENDING_THREAT get the same
// red/amber treatment DecisionBanner and the clipping-point indicator below
// already use for "act now" vs. "watch out"; POSITION_BATTLE and
// STRATEGICALLY_RELEVANT are informational, not urgent, so they share a
// neutral style; NONE is deliberately the most de-emphasized of all.
function rolePillClass(role) {
  if (role === 'ATTACK_TARGET') return styles.roleAttack
  if (role === 'DEFENDING_THREAT') return styles.roleDefend
  if (role === 'NONE') return styles.roleNone
  return styles.roleNeutral // POSITION_BATTLE, STRATEGICALLY_RELEVANT
}

/** Left column, bottom slot — the key differentiator, so it gets whatever
 * vertical room the column has left (flex:1 in App.module.css) rather
 * than a fixed cramped box. Nothing here is measured, only inferred —
 * see the footer disclaimer and context.md §6. */
export default function RivalEstimator() {
  const { rivalEstimate, strategicRival, historical, loadStrategicRivalTimeline } = useDashboardData()
  const { meanSoCMj, stdSoCMj, socMaxMj, terminalSpeedKmh, clippingPointFraction, nObservations, attackTendency } = rivalEstimate
  const [timelineOpen, setTimelineOpen] = useState(false)

  // Only present on historical-replay responses (the backend sends every
  // strategicRival field as null on synthetic decisions, since there's no
  // full race field to select an opponent from there) — so this block adds
  // nothing to the synthetic-mode panel, exactly as it looked before.
  const hasStrategicRival = strategicRival.role != null
  const isNone = strategicRival.role === 'NONE'

  // Telemetry-tick detail (§14/§16): only offered when THIS lap's pick was
  // genuinely produced by the tick-level selector (raw.summary.strategic_
  // rival.tick_level) — never shown as if every lap has it.
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
      <div className="panelHeaderRow">
        <RadarIcon width={18} height={18} />
        <h3>RIVAL ENERGY ESTIMATOR</h3>
      </div>
      <div className={styles.subtitle}>PARTICLE FILTER — POSTERIOR SoC</div>

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

      <div className={styles.headlinePlot}>
        <div className={styles.headline}>
          <span className={`num ${styles.headlineValue}`}>{meanSoCMj.toFixed(1)} MJ</span>
          <span className={`num ${styles.headlineSpread}`}>&plusmn; {stdSoCMj.toFixed(1)} MJ</span>
        </div>

        <div className={styles.plotWrap}>
          <PosteriorPlot mean={meanSoCMj} std={stdSoCMj} socMax={socMaxMj} width={340} height={78} />
        </div>
      </div>

      <div className={styles.readouts}>
        <div className={styles.readout}>
          <span className={styles.readoutLabel}>Term. Speed</span>
          <span className={`num ${styles.readoutValue}`}>{terminalSpeedKmh} km/h</span>
        </div>
        <div className={styles.readout}>
          <span className={styles.readoutLabel}>Clip Point</span>
          <span className={`num ${styles.readoutValue}`}>{Math.round(clippingPointFraction * 100)}%</span>
        </div>
        <div className={styles.readout}>
          <span className={styles.readoutLabel}>Attack</span>
          <span className={`num ${styles.readoutValue}`}>{attackTendency}</span>
        </div>
      </div>

      <div className={styles.indicator}>
        <span className={styles.dot} />
        <div>
          <div className={styles.indicatorLabel}>CLIPPING POINT DETECTED — EARLY</div>
          <div className={styles.indicatorSub}>Defending Capacity: LOW</div>
        </div>
      </div>

      <div className={styles.footer}>MODELED, NOT MEASURED &middot; n = {nObservations} observations</div>
    </GlassPanel>
  )
}

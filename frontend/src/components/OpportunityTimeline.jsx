import GlassPanel from './GlassPanel'
import { TimelineIcon, BoltIcon } from './Icons'
import { MODE_LABELS } from '../data/mockTelemetry'
import { useDashboardData } from '../services/DashboardDataContext'
import styles from './OpportunityTimeline.module.css'

const STRATEGY_LABELS = {
  ATTACK_NOW: 'ATTACK NOW',
  WAIT_2: 'WAIT 2 LAPS',
  WAIT_5: 'WAIT 5 LAPS',
  HOLD: 'HOLD',
}

/** Right column, lower slot — Opportunity Horizon from the backend's
 * ranked_strategies block: each row is a strategy the engine scored against
 * the full multi-lap energy model. Strategic value incorporates current
 * opportunity value, future energy value, and opportunity cost — all
 * computed backend-side; nothing is derived here. Falls back to the
 * overtake bonus bank/spend timeline when no opportunity data is available. */
export default function OpportunityTimeline() {
  const { telemetry, overtakeBonus, modeProjections, confidenceGatePass, opportunity } = useDashboardData()
  const { lap } = telemetry
  const top = modeProjections[0]
  const runnerUp = modeProjections[1]
  const usingBonus = confidenceGatePass.recommendedMode === 'USE_OVERTAKE_BONUS_MODE'

  const hasOpportunity = opportunity && Array.isArray(opportunity.rankedStrategies) && opportunity.rankedStrategies.length > 0

  // ── Fallback: overtake bonus bank/spend view (no opportunity data) ──
  if (!hasOpportunity) {
    const nodes = [
      {
        lap: overtakeBonus.bankedFromLap,
        tag: 'QUALIFIED',
        title: 'Bonus banked',
        detail: `Gap ${overtakeBonus.gapS.toFixed(2)}s ≤ ${overtakeBonus.thresholdS.toFixed(1)}s threshold`,
      },
      {
        lap,
        tag: 'NOW',
        current: true,
        title: MODE_LABELS[confidenceGatePass.recommendedMode],
        detail: `${top.laptimeDeltaS > 0 ? '+' : ''}${top.laptimeDeltaS.toFixed(2)}s vs. baseline`,
      },
      {
        lap: lap + 1,
        tag: usingBonus ? 'WINDOW CLOSES' : 'NEXT BEST',
        title: usingBonus ? 'Bonus expires unless spent' : MODE_LABELS[runnerUp.mode],
        detail: usingBonus
          ? 'Use-it-or-lose-it — not banked past this lap'
          : `${runnerUp.laptimeDeltaS > 0 ? '+' : ''}${runnerUp.laptimeDeltaS.toFixed(2)}s vs. baseline`,
      },
    ]
    return (
      <GlassPanel className={styles.wrap}>
        <div className="panelHeaderRow">
          <TimelineIcon width={18} height={18} />
          <h3>OPPORTUNITY TIMELINE</h3>
        </div>
        <div className={styles.subtitle}>OVERTAKE BONUS WINDOW</div>
        <div className={styles.track}>
          <div className={styles.axisLine} />
          {nodes.map((n, i) => (
            <div key={i} className={styles.node}>
              <span className={`${styles.dot} ${n.current ? styles.dotCurrent : ''}`}>
                {n.current && <BoltIcon width={10} height={10} />}
              </span>
              <span className={styles.lapLabel}>LAP {n.lap}</span>
              <span className={`${styles.tag} ${n.current ? styles.tagCurrent : ''}`}>{n.tag}</span>
              <span className={styles.nodeTitle}>{n.title}</span>
              <span className={styles.nodeDetail}>{n.detail}</span>
            </div>
          ))}
        </div>
      </GlassPanel>
    )
  }

  // ── Live: ranked strategies from Opportunity Horizon ──
  const maxValue = Math.max(...opportunity.rankedStrategies.map((s) => Math.abs(s.strategicValue ?? 0)), 0.01)
  const recommended = opportunity.recommendedStrategy
  const foregone = opportunity.foregoneStrategy

  return (
    <GlassPanel className={styles.wrap}>
      <div className="panelHeaderRow">
        <TimelineIcon width={18} height={18} />
        <h3>OPPORTUNITY TIMELINE</h3>
      </div>
      <div className={styles.subtitle}>HORIZON STRATEGY RANKING</div>

      <div className={styles.strategyTable}>
        {opportunity.rankedStrategies.map((s) => {
          const isRec = s.name === recommended
          const valPct = Math.round(Math.max(0, (s.strategicValue ?? 0) / maxValue) * 100)
          return (
            <div key={s.name} className={`${styles.stratRow} ${isRec ? styles.stratRowRec : ''}`}>
              <div className={styles.stratName}>
                <span className={styles.stratLabel}>{STRATEGY_LABELS[s.name] ?? s.name}</span>
                {isRec && <span className={styles.stratBadge}>REC</span>}
                {!isRec && s.name === foregone && <span className={styles.stratBadgeAlt}>ALT</span>}
              </div>
              <div className={styles.stratBarTrack}>
                <div
                  className={`${styles.stratBarFill} ${isRec ? styles.stratBarFillRec : ''}`}
                  style={{ width: `${valPct}%` }}
                />
              </div>
              <span className={`num ${styles.stratDelta}`}>
                {s.meanHorizonDeltaS != null
                  ? `${s.meanHorizonDeltaS > 0 ? '+' : ''}${s.meanHorizonDeltaS.toFixed(2)}s`
                  : '—'}
              </span>
            </div>
          )
        })}
      </div>

      <div className={styles.footMetrics}>
        {opportunity.foregoneValueGapS != null && (
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>FOREGONE vs {STRATEGY_LABELS[foregone] ?? foregone}</span>
            <span className={`num ${styles.metricValue}`}>−{opportunity.foregoneValueGapS.toFixed(2)}s</span>
          </div>
        )}
        {opportunity.currentWindowOvertakeProb != null && (
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>WINDOW OVERTAKE PROB</span>
            <span className={`num ${styles.metricValue}`}>{Math.round(opportunity.currentWindowOvertakeProb * 100)}%</span>
          </div>
        )}
      </div>

      {opportunity.uncertaintyNote && (
        <div className={styles.uncertaintyNote}>{opportunity.uncertaintyNote}</div>
      )}
    </GlassPanel>
  )
}

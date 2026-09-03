import GlassPanel from './GlassPanel'
import { GaugeIcon } from './Icons'
import { modeProjections, nIterations, MODE_LABELS } from '../data/mockTelemetry'
import styles from './MonteCarloPlanner.module.css'

// Normalise each mode's overtake/qualify probability (when it has one) onto
// a 0-100 bar width; modes without one (PUSH/BALANCED/CONSERVE) fall back
// to a Sharpe-based width so every row still shows something proportional,
// not an empty bar. Real numbers either way — nothing invented.
function barPercent(m) {
  if (m.extra) {
    const match = /(\d+)%/.exec(m.extra)
    if (match) return Number(match[1])
  }
  return Math.round(Math.max(0, Math.min(1, (m.sharpe + 3) / 5)) * 100)
}

// Sharpe (-mean/std, already an "engineered, not measured" field per
// context.md) bucketed into a 3-level display label — a presentational
// transform of a real number, not a new invented one.
function riskLabel(sharpe) {
  if (sharpe >= 1.5) return 'LOW'
  if (sharpe >= 0.5) return 'MEDIUM'
  return 'HIGH'
}

export default function MonteCarloPlanner() {
  const top = modeProjections[0]

  return (
    <GlassPanel className={styles.wrap}>
      <div className="panelHeaderRow">
        <GaugeIcon width={16} height={16} />
        <h3>MONTE CARLO PLANNER</h3>
        <span className={styles.subtitle}>
          <span className="num">{nIterations.toLocaleString()}</span> simulations/mode
        </span>
      </div>

      <div className={styles.bars}>
        {modeProjections.map((m) => {
          const pct = barPercent(m)
          const isTop = m.rank === 1
          return (
            <div key={m.mode} className={styles.row}>
              <span className={styles.modeName}>{MODE_LABELS[m.mode]}</span>
              <div className={styles.barTrack}>
                <div
                  className={`${styles.barFill} ${isTop ? styles.barFillTop : ''}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`num ${styles.pct}`}>{pct}%</span>
              <span className={`num ${styles.delta}`}>
                {m.laptimeDeltaS > 0 ? '+' : ''}
                {m.laptimeDeltaS.toFixed(2)}s
              </span>
            </div>
          )
        })}
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Best Strategy</span>
          <span className={`num ${styles.summaryValue}`}>{MODE_LABELS[top.mode]}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Expected Gain</span>
          <span className={`num ${styles.summaryValue}`}>
            {top.laptimeDeltaS > 0 ? '+' : ''}
            {top.laptimeDeltaS.toFixed(2)}s
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Risk</span>
          <span className={`num ${styles.summaryValue}`}>{riskLabel(top.sharpe)}</span>
        </div>
      </div>
    </GlassPanel>
  )
}

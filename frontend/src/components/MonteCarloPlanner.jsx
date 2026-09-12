import GlassPanel from './GlassPanel'
import { GaugeIcon } from './Icons'
import { MODE_LABELS } from '../data/mockTelemetry'
import { useDashboardData } from '../services/DashboardDataContext'
import styles from './MonteCarloPlanner.module.css'

// P(this mode beats BALANCED baseline) as a 0-100 bar width.
// Falls back to a Sharpe-based width only when overtakeProbability is absent.
// Real numbers either way — nothing invented.
function barPercent(m) {
  if (m.overtakeProbability != null) return Math.round(m.overtakeProbability * 100)
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
  const { modeProjections, nIterations, runnerUpMode, modeValueGapS } = useDashboardData()
  const top = modeProjections[0]
  const hasCounterfactual = runnerUpMode != null && modeValueGapS != null

  return (
    <GlassPanel className={styles.wrap}>
      <div className="panelHeaderRow">
        <GaugeIcon width={16} height={16} />
        <h3>MONTE CARLO PLANNER</h3>
        <span className={styles.subtitle} title="Simulated outcome probability — not model accuracy">
          <span className="num">{nIterations.toLocaleString()}</span> STOCHASTIC ROLLOUTS/MODE
        </span>
      </div>

      <div className={styles.colHeaders}>
        <span>MODE</span>
        <span />
        <span className={styles.colHeaderRight}>VS BALANCED</span>
        <span className={styles.colHeaderRight}>Δ LAP</span>
        <span className={styles.colHeaderRight}>ENERGY</span>
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
              <span className={`num ${styles.energy}`}>
                {m.energyCostMj != null ? `${m.energyCostMj.toFixed(1)}` : '—'}
              </span>
            </div>
          )
        })}
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Planner Preference</span>
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

      {/* Counterfactual: runner-up and value gap — backend-driven, only shown when supplied */}
      {hasCounterfactual && (
        <div className={styles.counterfactual}>
          <div className={styles.cfItem}>
            <span className={styles.cfLabel}>RUNNER-UP</span>
            <span className={`num ${styles.cfValue}`}>{MODE_LABELS[runnerUpMode] ?? runnerUpMode}</span>
          </div>
          <div className={styles.cfItem}>
            <span className={styles.cfLabel}>VALUE GAP</span>
            <span className={`num ${styles.cfValue}`}>{modeValueGapS.toFixed(3)}s</span>
          </div>
          {top.attackCompletionProbability != null && (
            <div className={styles.cfItem}>
              <span className={styles.cfLabel}>ATTACK COMPLETION</span>
              <span className={`num ${styles.cfValue}`}>{Math.round(top.attackCompletionProbability * 100)}%</span>
            </div>
          )}
        </div>
      )}
    </GlassPanel>
  )
}

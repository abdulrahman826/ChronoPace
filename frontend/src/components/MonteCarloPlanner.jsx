import GlassPanel from './GlassPanel'
import { GaugeIcon } from './Icons'
import DistributionSparkline from './DistributionSparkline'
import { modeProjections, nIterations } from '../data/mockTelemetry'
import styles from './MonteCarloPlanner.module.css'

export default function MonteCarloPlanner() {
  return (
    <GlassPanel>
      <div className="panelHeaderRow">
        <GaugeIcon width={18} height={18} />
        <h3>MONTE CARLO PLANNER</h3>
      </div>
      <div className={styles.subtitle}>
        <span className="num">{nIterations.toLocaleString()}</span> ITERATIONS / MODE
      </div>

      <div className={styles.table}>
        {modeProjections.map((m) => {
          const isTop = m.rank === 1
          const color = isTop ? 'var(--color-blue)' : 'var(--color-text-secondary)'
          return (
            <div key={m.mode} className={`${styles.rowItem} ${isTop ? styles.topRow : ''}`}>
              <div className={styles.rank}>{m.rank}</div>
              <div className={styles.modeCol}>
                <span className={styles.modeName}>{m.mode}</span>
                {m.extra && <span className={styles.extra}>{m.extra}</span>}
              </div>
              <DistributionSparkline std={m.stdS} color={color} />
              <div className={styles.metrics}>
                <span className="num">
                  {m.laptimeDeltaS > 0 ? '+' : ''}
                  {m.laptimeDeltaS.toFixed(2)}s &plusmn; {m.stdS.toFixed(2)}
                </span>
                <span className={`num ${styles.sharpe}`}>Sharpe {m.sharpe.toFixed(1)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </GlassPanel>
  )
}

import GlassPanel from './GlassPanel'
import { RadarIcon } from './Icons'
import PosteriorPlot from './PosteriorPlot'
import { useDashboardData } from '../services/DashboardDataContext'
import styles from './RivalEstimator.module.css'

/** Left column, bottom slot — the key differentiator, so it gets whatever
 * vertical room the column has left (flex:1 in App.module.css) rather
 * than a fixed cramped box. Nothing here is measured, only inferred —
 * see the footer disclaimer and context.md §6. */
export default function RivalEstimator() {
  const { rivalEstimate } = useDashboardData()
  const { meanSoCMj, stdSoCMj, socMaxMj, terminalSpeedKmh, clippingPointFraction, nObservations, attackTendency } = rivalEstimate

  return (
    <GlassPanel className={styles.wrap}>
      <div className="panelHeaderRow">
        <RadarIcon width={18} height={18} />
        <h3>RIVAL ENERGY ESTIMATOR</h3>
      </div>
      <div className={styles.subtitle}>PARTICLE FILTER — POSTERIOR SoC</div>

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

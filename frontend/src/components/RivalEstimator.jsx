import GlassPanel from './GlassPanel'
import { RadarIcon } from './Icons'
import PosteriorPlot from './PosteriorPlot'
import { rivalEstimate } from '../data/mockTelemetry'
import styles from './RivalEstimator.module.css'

export default function RivalEstimator() {
  const { meanSoCMj, stdSoCMj, socMaxMj, terminalSpeedKmh, clippingPointFraction, nObservations, attackTendency } = rivalEstimate

  return (
    <GlassPanel>
      <div className="panelHeaderRow">
        <RadarIcon width={18} height={18} />
        <h3>RIVAL ENERGY ESTIMATOR</h3>
      </div>
      <div className={styles.subtitle}>PARTICLE FILTER — POSTERIOR SoC</div>

      <div className={styles.plotRow}>
        <PosteriorPlot mean={meanSoCMj} std={stdSoCMj} socMax={socMaxMj} />
        <div className={styles.plotStats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>μ</span>
            <span className="num">{meanSoCMj.toFixed(1)} MJ</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>σ</span>
            <span className="num">{stdSoCMj.toFixed(1)} MJ</span>
          </div>
        </div>
      </div>

      <div className={styles.readouts}>
        <div className={styles.readout}>
          <span className={styles.readoutLabel}>Terminal Speed (Rival)</span>
          <span className="num">{terminalSpeedKmh} km/h</span>
        </div>
        <div className={styles.readout}>
          <span className={styles.readoutLabel}>Clipping Point</span>
          <span className="num">{Math.round(clippingPointFraction * 100)}% of straight</span>
        </div>
        <div className={styles.readout}>
          <span className={styles.readoutLabel}>Attack Tendency</span>
          <span className="num">{attackTendency}</span>
        </div>
      </div>

      <div className={styles.indicator}>
        <span className={styles.dot} />
        <div>
          <div className={styles.indicatorLabel}>CLIPPING POINT DETECTED — EARLY</div>
          <div className={styles.indicatorSub}>Rival defending capacity: LOW</div>
        </div>
      </div>

      <div className={styles.footer}>MODELED, NOT MEASURED &middot; n = {nObservations} observations</div>
    </GlassPanel>
  )
}

import { telemetry, complianceChecks } from '../../data/mockTelemetry'
import styles from './RacingScene.module.css'

// Real fields, not invented ones — same mock data ComplianceProbe and
// EnergyStatus already render elsewhere. No "harvest rate" or similar
// here; that was deliberately excluded from this project's mock data
// (see context.md) and stays excluded here too.
const mgukPower = complianceChecks.find((c) => c.rule === 'MGU-K Power')
const lapDeployment = complianceChecks.find((c) => c.rule === 'Lap Deployment')

/** Small labelled readouts around the car — the "annotations" the brief
 * asks for, reframed as honest values already computed elsewhere rather
 * than pointer-lines to specific geometry (which wouldn't track correctly
 * against a continuously-rotating subject anyway). */
export default function Overlay() {
  return (
    <div className={styles.overlay} aria-hidden="true">
      <div className={styles.annotation} style={{ top: 16, left: 16 }}>
        <span className={styles.metricLabel}>MGU-K Power</span>
        <span className={styles.metricValue}>
          {mgukPower.value.toFixed(0)}
          <span className={styles.metricUnit}> {mgukPower.unit}</span>
        </span>
      </div>

      <div className={styles.annotation} style={{ top: 16, right: 16 }}>
        <span className={styles.metricLabel}>Lap Deployment</span>
        <span className={styles.metricValue}>
          {lapDeployment.value.toFixed(1)}
          <span className={styles.metricUnit}> {lapDeployment.unit}</span>
        </span>
      </div>

      <div className={styles.annotation} style={{ bottom: 16, left: 16 }}>
        <span className={styles.metricLabel}>Battery</span>
        <span className={styles.metricValue}>
          {telemetry.ersSoC.currentMj.toFixed(1)}
          <span className={styles.metricUnit}> / {telemetry.ersSoC.maxMj.toFixed(1)} MJ</span>
        </span>
      </div>

      <div className={styles.badge} style={{ bottom: 16, right: 16, left: 'auto', top: 'auto' }}>
        <span className={styles.dot} />
        Car #{telemetry.carNumber}
      </div>
    </div>
  )
}

import GlassPanel from './GlassPanel'
import { BoltIcon } from './Icons'
import { MODE_LABELS } from '../data/mockTelemetry'
import { useDashboardData } from '../services/DashboardDataContext'
import styles from './EnergyStatus.module.css'

const RADIUS = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Energy Status (You) — lower info row. Carries over speedKmh/ersSoC from
 * the retired TelemetryHeader (SoC relabeled "Deployable" — same number,
 * named for what it represents here, now shown as a radial gauge instead
 * of a linear bar) plus the current recommended mode. Deliberately does
 * NOT show "Harvest Rate" or "Next Window" — neither maps to real data,
 * and "Next Window" specifically would imply an Opportunity Horizon
 * result that doesn't exist yet (see OpportunityTimeline). */
export default function EnergyStatus() {
  const { telemetry, confidenceGatePass } = useDashboardData()
  const { speedKmh, ersSoC } = telemetry
  const socPct = Math.round((ersSoC.currentMj / ersSoC.maxMj) * 100)
  const modeLabel = MODE_LABELS[confidenceGatePass.recommendedMode]
  const dashOffset = CIRCUMFERENCE * (1 - socPct / 100)

  return (
    <GlassPanel className={styles.wrap}>
      <div className="panelHeaderRow">
        <BoltIcon width={18} height={18} />
        <h3>ENERGY STATUS (YOU)</h3>
      </div>

      <div className={styles.body}>
        <div className={styles.gaugeWrap}>
          <svg viewBox="0 0 64 64" className={styles.gauge}>
            <circle cx="32" cy="32" r={RADIUS} className={styles.gaugeTrack} />
            <circle
              cx="32"
              cy="32"
              r={RADIUS}
              className={styles.gaugeFill}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className={styles.gaugeReadout}>
            <span className={`num ${styles.gaugeValue}`}>{ersSoC.currentMj.toFixed(1)}</span>
            <span className={styles.gaugeUnit}>MJ</span>
          </div>
        </div>

        <div className={styles.grid}>
          <div className={styles.stat}>
            <span className={styles.label}>Deployable</span>
            <span className="num">
              {ersSoC.currentMj.toFixed(1)} / {ersSoC.maxMj.toFixed(1)} MJ
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.label}>Speed</span>
            <span className="num">{speedKmh} km/h</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.label}>Mode</span>
            <span className={styles.mode}>{modeLabel}</span>
          </div>
        </div>
      </div>
    </GlassPanel>
  )
}

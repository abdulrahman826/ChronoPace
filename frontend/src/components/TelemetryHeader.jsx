import GlassPanel from './GlassPanel'
import { BoltIcon } from './Icons'
import { telemetry } from '../data/mockTelemetry'
import styles from './TelemetryHeader.module.css'

/** Live Session & Telemetry (right column, top). */
export default function TelemetryHeader() {
  const { session, lap, totalLaps, carNumber, speedKmh, ersSoC } = telemetry
  const socPct = Math.round((ersSoC.currentMj / ersSoC.maxMj) * 100)

  return (
    <GlassPanel className={styles.header}>
      <div className={styles.wordmark}>CHRONO<span>PACE</span></div>

      <div className={styles.sessionLine}>
        {session} &middot; LAP {lap}/{totalLaps} &middot; CAR #{carNumber}
      </div>

      <div className={styles.speedBlock}>
        <div className={`${styles.speedValue} num`}>{speedKmh}</div>
        <div className={styles.speedUnit}>KM/H</div>
      </div>

      <div className={styles.socBlock}>
        <div className={styles.socLabel}>
          <BoltIcon width={14} height={14} />
          <span>ERS BATTERY SoC</span>
        </div>
        <div className={styles.socReadout}>
          <span className="num">{ersSoC.currentMj.toFixed(1)} / {ersSoC.maxMj.toFixed(1)} MJ</span>
          <span className="num">{socPct}%</span>
        </div>
        <div className={styles.socBar}>
          <div className={styles.socFill} style={{ width: `${socPct}%` }} />
        </div>
      </div>
    </GlassPanel>
  )
}

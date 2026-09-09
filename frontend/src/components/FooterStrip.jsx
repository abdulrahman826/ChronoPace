import { FlagIcon } from './Icons'
import { useDashboardData } from '../services/DashboardDataContext'
import styles from './FooterStrip.module.css'

/** Compact race-status strip. Static scenario flavor for this fixed demo
 * lap (same spirit as the header's session/lap/car fields) — not a claim
 * of live weather/sensor integration. `dataMode` exists specifically so
 * the strip never implies the app is receiving live FIA/team telemetry. */
export default function FooterStrip() {
  const { raceStatus } = useDashboardData()
  const { track, tempC, airTempC, windKmh, tyre, dataRateHz, system, dataMode } = raceStatus

  return (
    <footer className={styles.footer}>
      <div className={styles.items}>
        <span className={styles.item}>
          <FlagIcon width={13} height={13} />
          <span className={styles.itemLabel}>TRACK</span>
          <span className="num">{track}</span>
        </span>
        <span className={styles.item}>
          <span className={styles.itemLabel}>TEMP</span>
          <span className="num">{tempC}&deg;C</span>
        </span>
        <span className={styles.item}>
          <span className={styles.itemLabel}>AIR</span>
          <span className="num">{airTempC}&deg;C</span>
        </span>
        <span className={styles.item}>
          <span className={styles.itemLabel}>WIND</span>
          <span className="num">{windKmh} km/h</span>
        </span>
        <span className={styles.item}>
          <span className={styles.itemLabel}>TYRE</span>
          <span className="num">{tyre}</span>
        </span>
        {dataRateHz != null && (
          <span className={styles.item}>
            <span className={styles.itemLabel}>DATA RATE</span>
            <span className="num">{dataRateHz} Hz</span>
          </span>
        )}
        <span className={styles.item}>
          <span className={styles.itemLabel}>SYSTEM</span>
          <span className={`num ${styles.systemOk}`}>{system}</span>
        </span>
      </div>

      <div className={styles.dataMode}>DATA MODE: {dataMode}</div>
    </footer>
  )
}

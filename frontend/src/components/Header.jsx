import { ClockIcon, FlaskIcon } from './Icons'
import { useDashboardData } from '../services/DashboardDataContext'
import HistoricalReplayControl from './HistoricalReplayControl'
import styles from './Header.module.css'

/** Page header — single wordmark (the old per-panel duplicate in the
 * retired TelemetryHeader is gone), session/lap/car/time on the right. */
export default function Header() {
  const { telemetry, historical, view, openValidationLab, closeValidationLab } = useDashboardData()
  const { session, lap, totalLaps, carNumber, raceTimeLabel } = telemetry

  return (
    <header className={styles.header}>
      <div className={`${styles.side} ${styles.sideRow}`}>
        {view === 'dashboard' && <HistoricalReplayControl />}
        <button
          type="button"
          className={`${styles.labToggle} ${view === 'validation' ? styles.labToggleActive : ''}`}
          onClick={() => (view === 'validation' ? closeValidationLab() : openValidationLab())}
        >
          <FlaskIcon width={12} height={12} />
          {view === 'validation' ? 'BACK TO DASHBOARD' : 'VALIDATION LAB'}
        </button>
      </div>

      <div className={styles.center}>
        <div className={styles.wordmark}>
          <span className={styles.accentBar} />
          CHRONO<span className={styles.wordmarkAccent}>PACE</span>
        </div>
        <div className={styles.subtitle}>AI MOTORSPORT INTELLIGENCE</div>
      </div>

      <div className={`${styles.side} ${styles.infoCluster}`}>
        <span className="num">
          {session} &middot; LAP {lap}/{totalLaps} &middot; CAR #{carNumber}
        </span>
        <span className={styles.timeGroup}>
          <ClockIcon width={13} height={13} />
          <span className="num">{raceTimeLabel}</span>
        </span>
        {historical.active ? (
          <span className={`${styles.live} ${styles.liveReplay}`}>
            <span className={styles.liveDot} />
            REPLAY
          </span>
        ) : (
          <span className={styles.live}>
            <span className={styles.liveDot} />
            LIVE
          </span>
        )}
      </div>
    </header>
  )
}

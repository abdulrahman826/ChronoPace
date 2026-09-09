import { ROLE_LABELS } from '../data/mockTelemetry'
import styles from './StrategicRivalTimeline.module.css'

// A small, fixed palette cycled by driver code so the same driver keeps the
// same color across the bar and the legend — purely a rendering aid, not
// data. Never used to decide anything; the driver/role/timing themselves are
// 100% the backend's `GET .../timeline` response.
const SEGMENT_COLORS = ['#ff2d44', '#ffa726', '#4dabf7', '#69db7c', '#da77f2', '#ffd43b']

function colorFor(driver, drivers) {
  const i = drivers.indexOf(driver)
  return SEGMENT_COLORS[i % SEGMENT_COLORS.length]
}

/** Renders the ACTUAL telemetry-tick strategic-rival stream for one lap
 * (GET /api/v1/replay/historical/{race}/{lap}/timeline) as a compact
 * segmented bar — never a cosmetic/approximate timeline. Every segment
 * boundary is a real `change_events` entry from the backend; every driver
 * code, role, and lap_fraction is passed straight through unmodified. This
 * is TELEMETRY-CADENCE data (updates many times per lap), a different
 * concept from the lap/decision-cadence dashboard around it — labeled as
 * such so it's never mistaken for "N Monte Carlo decisions this lap". */
export default function StrategicRivalTimeline({ timeline, loading, error }) {
  if (loading) {
    return <div className={styles.status}>LOADING TICK TIMELINE&hellip;</div>
  }
  if (error) {
    return (
      <div className={styles.errorBox}>
        <div className={styles.errorTitle}>TIMELINE UNAVAILABLE</div>
        <div className={styles.errorDetail}>{error}</div>
      </div>
    )
  }
  if (!timeline) return null

  const { summary, change_events: changeEvents = [], tick_cadence_hz: cadenceHz, total_ticks_this_lap: totalTicks } = timeline
  if (!summary || !Array.isArray(changeEvents)) {
    return <div className={styles.status}>No tick-level detail for this lap.</div>
  }

  // Build bar segments from the real change events — [start%, end%, driver].
  const boundaries = [0, ...changeEvents.map((c) => c.lap_fraction), 1]
  const drivers = [summary.first_driver, ...changeEvents.map((c) => c.to)]
  const segments = drivers.map((driver, i) => ({
    driver,
    role: i === changeEvents.length ? summary.dominant_role : changeEvents[i]?.role,
    startPct: boundaries[i] * 100,
    widthPct: (boundaries[i + 1] - boundaries[i]) * 100,
  }))
  const uniqueDrivers = [...new Set(drivers)]

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.title}>Telemetry-Cadence Strategic Rival</span>
        <span className={styles.cadence}>
          {totalTicks} ticks &middot; ~{cadenceHz} Hz (actual FastF1 sampling)
        </span>
      </div>

      <div className={styles.bar} title={`${summary.n_changes} change(s) this lap`}>
        {segments.map((s, i) => (
          <div
            key={`${s.driver}-${i}`}
            className={styles.segment}
            style={{ left: `${s.startPct}%`, width: `${s.widthPct}%`, background: colorFor(s.driver, uniqueDrivers) }}
            title={`${s.driver} — ${ROLE_LABELS[s.role] ?? s.role ?? ''} (from ${s.startPct.toFixed(0)}% of the lap)`}
          />
        ))}
      </div>

      <div className={styles.legend}>
        {uniqueDrivers.map((d) => (
          <span key={d} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: colorFor(d, uniqueDrivers) }} />
            {d}
          </span>
        ))}
      </div>

      {changeEvents.length > 0 && (
        <div className={styles.events}>
          {changeEvents.map((c, i) => (
            <div key={i} className={styles.event}>
              <span className="num">{Math.round(c.lap_fraction * 100)}%</span>
              <span>
                {c.from} &rarr; {c.to}
              </span>
              <span className={styles.eventRole}>{ROLE_LABELS[c.role] ?? c.role}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

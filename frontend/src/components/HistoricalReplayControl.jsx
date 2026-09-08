import { useEffect, useRef, useState } from 'react'
import GlassPanel from './GlassPanel'
import { HistoryIcon, PlayIcon, PauseIcon } from './Icons'
import { useDashboardData } from '../services/DashboardDataContext'
import styles from './HistoricalReplayControl.module.css'

const AUTOPLAY_INTERVAL_MS = 1800

/** Judge-facing historical replay control — a compact toggle in the header
 * that opens a floating panel (position:fixed, zero layout footprint when
 * closed, so this can't reintroduce overflow into the fixed no-scroll
 * shell) rather than a permanent dashboard panel. Every lap shown here
 * comes from a real GET /api/v1/replay/historical/{race}/{lap} call —
 * nothing here computes a strategy, an energy value, or a historical
 * outcome; this component only asks for (race, lap) and renders whatever
 * DecisionSnapshot comes back, through the exact same
 * DashboardDataContext/adaptDecision.js path the synthetic dashboard uses.
 *
 * Driver/rival are shown read-only (the registry's defaults) rather than
 * as editable selects — the backend doesn't expose a list of alternate
 * drivers to choose from for this race, and inventing one would violate
 * "use exactly what the backend currently exposes." */
export default function HistoricalReplayControl() {
  const [open, setOpen] = useState(false)
  const {
    historical,
    loadHistoricalRaces,
    setHistoricalLap,
    runHistoricalReplay,
    setHistoricalPlaying,
    stopHistoricalPlayback,
    exitHistoricalMode,
  } = useDashboardData()

  useEffect(() => {
    if (open && !historical.racesLoaded && !historical.loading) {
      loadHistoricalRaces()
    }
  }, [open, historical.racesLoaded, historical.loading, loadHistoricalRaces])

  // Auto-play: one real backend request per lap, awaited before scheduling
  // the next — never a client-side loop over a pre-fetched range. Reads
  // the latest race/lap/driver/rival via a ref so the interval always acts
  // on current state without restarting itself every lap.
  const historicalRef = useRef(historical)
  useEffect(() => {
    historicalRef.current = historical
  }, [historical])

  useEffect(() => {
    if (!historical.playing) return undefined
    let cancelled = false
    let timeoutId

    const tick = async () => {
      const h = historicalRef.current
      const nextLap = h.lap + 1
      if (h.totalLaps && nextLap > h.totalLaps) {
        stopHistoricalPlayback()
        return
      }
      setHistoricalLap(nextLap)
      const ok = await runHistoricalReplay({ race: h.race, lap: nextLap, driver: h.driver, rival: h.rival })
      if (cancelled) return
      if (!ok) {
        stopHistoricalPlayback()
        return
      }
      timeoutId = setTimeout(tick, AUTOPLAY_INTERVAL_MS)
    }

    timeoutId = setTimeout(tick, AUTOPLAY_INTERVAL_MS)
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [historical.playing, runHistoricalReplay, setHistoricalLap, stopHistoricalPlayback])

  const race = historical.races.find((r) => r.key === historical.race) || null

  const handleRun = () => {
    runHistoricalReplay({ race: historical.race, lap: historical.lap, driver: historical.driver, rival: historical.rival })
  }

  const handleTogglePlay = () => {
    if (historical.playing) stopHistoricalPlayback()
    else setHistoricalPlaying(true)
  }

  const handleExit = () => {
    stopHistoricalPlayback()
    exitHistoricalMode()
    setOpen(false)
  }

  const busy = historical.loading || historical.playing

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.toggle} ${historical.active ? styles.toggleActive : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <HistoryIcon width={13} height={13} />
        {historical.active ? `REPLAY · LAP ${historical.lap}` : 'HISTORICAL REPLAY'}
      </button>

      {open && (
        <GlassPanel elevated className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>HISTORICAL REPLAY</span>
            <button type="button" className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </div>

          {historical.loading && !historical.racesLoaded ? (
            <div className={styles.status}>LOADING HISTORICAL TELEMETRY&hellip;</div>
          ) : historical.error && !historical.racesLoaded ? (
            <div className={styles.errorBox}>
              <div className={styles.errorTitle}>HISTORICAL REPLAY UNAVAILABLE</div>
              <div className={styles.errorDetail}>{historical.error}</div>
              <button type="button" className={styles.retryBtn} onClick={loadHistoricalRaces}>
                Retry
              </button>
            </div>
          ) : race ? (
            <>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Race</span>
                <span className={styles.fieldValue}>{race.name}</span>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Driver</span>
                  <span className={`num ${styles.fieldValue}`}>{historical.driver}</span>
                </div>
                <div className={styles.field}>
                  {/* "Focus Battle" — not "Rival": with dynamic strategic-rival
                      selection (backend commit 99f58d2), the opponent actually
                      relevant to the current lap's decision can be a different
                      driver entirely (see the Rival Energy Estimator's own
                      "STRATEGIC RIVAL" readout). This is the initial/fallback
                      pairing the replay was set up with, still sent as `rival`
                      on every request, but no longer presented as if it's
                      permanently the active rival. */}
                  <span className={styles.fieldLabel}>Focus Battle</span>
                  <span className={`num ${styles.fieldValue}`}>{historical.rival}</span>
                </div>
              </div>

              <div className={styles.lapField}>
                <span className={styles.fieldLabel}>LAP</span>
                <input
                  type="range"
                  min={1}
                  max={historical.totalLaps || 1}
                  value={historical.lap}
                  onChange={(e) => setHistoricalLap(Number(e.target.value))}
                  className={styles.slider}
                  disabled={historical.playing}
                />
                <div className={styles.lapScale}>
                  <span className="num">1</span>
                  <span className={`num ${styles.lapValue}`}>LAP {historical.lap}</span>
                  <span className="num">{historical.totalLaps}</span>
                </div>
              </div>

              {historical.error && (
                <div className={styles.errorBox}>
                  <div className={styles.errorTitle}>HISTORICAL REPLAY UNAVAILABLE</div>
                  <div className={styles.errorDetail}>{historical.error}</div>
                </div>
              )}

              <div className={styles.actions}>
                <button type="button" className={styles.runBtn} onClick={handleRun} disabled={busy}>
                  {historical.loading && !historical.playing ? `CALCULATING LAP ${historical.lap}…` : 'RUN REPLAY'}
                </button>
                <button
                  type="button"
                  className={styles.playBtn}
                  onClick={handleTogglePlay}
                  disabled={historical.loading && !historical.playing}
                  aria-label={historical.playing ? 'Pause' : 'Play'}
                  title={historical.playing ? 'Pause' : 'Play'}
                >
                  {historical.playing ? <PauseIcon width={13} height={13} /> : <PlayIcon width={13} height={13} />}
                </button>
              </div>

              <div className={styles.provenance}>
                <div>
                  <span className={styles.provenanceTag}>REAL TELEMETRY</span> FastF1 &middot; {race.name}
                </div>
                <div>
                  <span className={styles.provenanceTagModeled}>MODELED</span> Rival Energy &middot; Opportunity &middot;
                  Monte Carlo &middot; ChronoPace Decision
                </div>
              </div>

              {historical.active && (
                <button type="button" className={styles.exitBtn} onClick={handleExit}>
                  &larr; Back to synthetic mode
                </button>
              )}
            </>
          ) : (
            <div className={styles.status}>No historical races currently registered.</div>
          )}
        </GlassPanel>
      )}
    </div>
  )
}

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
 * outcome; this component only asks for (race, lap[, season/event/session])
 * and renders whatever DecisionSnapshot comes back, through the exact same
 * DashboardDataContext/adaptDecision.js path the synthetic dashboard uses.
 *
 * Two ways to pick a race:
 *  - the curated/featured set (GET /api/v1/replay/races) — driver/rival
 *    shown read-only, exactly as before this file grew a second mode.
 *  - "Browse other races" (added alongside the backend's Season -> Grand
 *    Prix -> Session discovery, §3/§12) — real GET /seasons, /races?season=,
 *    /sessions?season=&race= calls; driver/rival become free-text since a
 *    discovered race has no registry default. Every list rendered here is
 *    exactly what those endpoints returned — nothing enumerated client-side. */
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
    loadSeasons,
    selectSeason,
    selectSeasonEvent,
    selectSessionCode,
    setHistoricalDriver,
    setHistoricalRival,
    toggleBrowsing,
  } = useDashboardData()

  useEffect(() => {
    if (open && !historical.racesLoaded && !historical.loading) {
      loadHistoricalRaces()
    }
  }, [open, historical.racesLoaded, historical.loading, loadHistoricalRaces])

  useEffect(() => {
    if (open && historical.browsing && !historical.seasonsLoaded && !historical.seasonsLoading) {
      loadSeasons()
    }
  }, [open, historical.browsing, historical.seasonsLoaded, historical.seasonsLoading, loadSeasons])

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
      const ok = await runHistoricalReplay({
        race: h.race, lap: nextLap, driver: h.driver, rival: h.rival,
        season: h.season, event: h.seasonEvent, session: h.sessionCode, isAdHoc: h.isAdHoc,
      })
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

  const curatedRace = historical.races.find((r) => r.key === historical.race) || null
  // A replay is "loaded" (slider + RUN REPLAY visible) once either a curated
  // race is selected, or an ad-hoc replay has actually succeeded at least
  // once (we don't know an ad-hoc race's lap count until the first response).
  // While the browse panel is open and no ad-hoc replay has loaded yet, hide
  // the curated race's own lap controls rather than showing two "which race
  // is this for" UIs at once.
  const raceLoaded = historical.isAdHoc
    ? historical.active
    : Boolean(curatedRace) && !historical.browsing
  const raceLabel = curatedRace
    ? curatedRace.name
    : historical.isAdHoc && historical.season && historical.seasonEvent
      ? `${historical.season} ${historical.seasonEvent}`
      : null

  const handleRun = () => {
    runHistoricalReplay({
      race: historical.race, lap: historical.lap, driver: historical.driver, rival: historical.rival,
      season: historical.season, event: historical.seasonEvent, session: historical.sessionCode,
      isAdHoc: historical.isAdHoc,
    })
  }

  const handleLoadDiscovered = () => {
    runHistoricalReplay({
      race: historical.seasonEvent, lap: 1, driver: historical.driver, rival: historical.rival || undefined,
      season: historical.season, event: historical.seasonEvent, session: historical.sessionCode,
      isAdHoc: true,
    })
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
  const canLoadDiscovered = Boolean(
    historical.season != null && historical.seasonEvent && historical.sessionCode
    && historical.driver && historical.driver.trim().length >= 2,
  )

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

          <button type="button" className={styles.browseToggle} onClick={toggleBrowsing}>
            {historical.browsing ? '▴ Featured race' : '▾ Browse other races (2019–2025)'}
          </button>

          {historical.browsing ? (
            <BrowseSection
              historical={historical}
              selectSeason={selectSeason}
              selectSeasonEvent={selectSeasonEvent}
              selectSessionCode={selectSessionCode}
              setHistoricalDriver={setHistoricalDriver}
              setHistoricalRival={setHistoricalRival}
              onLoad={handleLoadDiscovered}
              canLoad={canLoadDiscovered}
              busy={busy}
            />
          ) : historical.loading && !historical.racesLoaded ? (
            <div className={styles.status}>LOADING HISTORICAL TELEMETRY&hellip;</div>
          ) : historical.error && !historical.racesLoaded ? (
            <div className={styles.errorBox}>
              <div className={styles.errorTitle}>HISTORICAL REPLAY UNAVAILABLE</div>
              <div className={styles.errorDetail}>{historical.error}</div>
              <button type="button" className={styles.retryBtn} onClick={loadHistoricalRaces}>
                Retry
              </button>
            </div>
          ) : curatedRace ? (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Race</span>
              <span className={styles.fieldValue}>{curatedRace.name}</span>
            </div>
          ) : (
            <div className={styles.status}>No historical races currently registered.</div>
          )}

          {!historical.browsing && curatedRace && (
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Driver</span>
                <span className={`num ${styles.fieldValue}`}>{historical.driver}</span>
              </div>
              <div className={styles.field}>
                {/* "Focus Battle" — not "Rival": with dynamic strategic-rival
                    selection, the opponent actually relevant to the current
                    lap's decision can be a different driver entirely (see the
                    Rival Energy Estimator's own "STRATEGIC RIVAL" readout).
                    This is the initial/fallback pairing the replay was set up
                    with, still sent as `rival` on every request, but no
                    longer presented as if it's permanently the active rival. */}
                <span className={styles.fieldLabel}>Focus Battle</span>
                <span className={`num ${styles.fieldValue}`}>{historical.rival}</span>
              </div>
            </div>
          )}

          {raceLoaded && (
            <>
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
                  <span className={styles.provenanceTag}>REAL TELEMETRY</span> FastF1 &middot; {raceLabel}
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
          )}
        </GlassPanel>
      )}
    </div>
  )
}

/** Season -> Grand Prix -> Session -> Driver, each level populated only once
 * the level above it is chosen — never a client-side enumeration. Handles
 * loading/empty/error at every level per spec §3, and disables an event a
 * judge could pick but that FastF1 has no telemetry for rather than hiding
 * it silently (so "why isn't Imola 1980 here" has a visible answer). */
function BrowseSection({
  historical, selectSeason, selectSeasonEvent, selectSessionCode,
  setHistoricalDriver, setHistoricalRival, onLoad, canLoad, busy,
}) {
  return (
    <div className={styles.browsePanel}>
      {historical.seasonsLoading && <div className={styles.status}>Loading seasons&hellip;</div>}
      {historical.seasonsError && <div className={styles.errorDetail}>{historical.seasonsError}</div>}

      {historical.seasonsLoaded && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Season</span>
          <select
            className={styles.select}
            value={historical.season ?? ''}
            onChange={(e) => selectSeason(Number(e.target.value))}
          >
            <option value="" disabled>
              Select&hellip;
            </option>
            {historical.seasons.map((s) => (
              <option key={s.season} value={s.season} disabled={!s.available}>
                {s.season}
                {s.available ? ` (${s.rounds} rounds)` : ' — unavailable'}
              </option>
            ))}
          </select>
        </div>
      )}

      {historical.season != null && (
        <>
          {historical.seasonRacesLoading && <div className={styles.status}>Loading races&hellip;</div>}
          {historical.seasonRacesError && <div className={styles.errorDetail}>{historical.seasonRacesError}</div>}
          {historical.seasonRacesLoaded && historical.seasonRaces.length === 0 && (
            <div className={styles.status}>No races found for {historical.season}.</div>
          )}
          {historical.seasonRacesLoaded && historical.seasonRaces.length > 0 && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Grand Prix</span>
              <select
                className={styles.select}
                value={historical.seasonEvent ?? ''}
                onChange={(e) => selectSeasonEvent(historical.season, e.target.value)}
              >
                <option value="" disabled>
                  Select&hellip;
                </option>
                {historical.seasonRaces.map((r) => (
                  <option key={r.event} value={r.event} disabled={!r.telemetry_supported}>
                    R{r.round} &middot; {r.name}
                    {r.telemetry_supported ? '' : ' — no telemetry'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {historical.seasonEvent && (
        <>
          {historical.sessionsLoading && <div className={styles.status}>Loading sessions&hellip;</div>}
          {historical.sessionsError && <div className={styles.errorDetail}>{historical.sessionsError}</div>}
          {historical.sessionsLoaded && historical.sessions.length > 0 && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Session</span>
              <select
                className={styles.select}
                value={historical.sessionCode ?? ''}
                onChange={(e) => selectSessionCode(e.target.value)}
              >
                {historical.sessions.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {historical.sessionCode && (
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Driver</span>
            <input
              type="text"
              className={styles.textInput}
              value={historical.driver || ''}
              onChange={(e) => setHistoricalDriver(e.target.value)}
              placeholder="e.g. VER"
              maxLength={3}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Focus Battle</span>
            <input
              type="text"
              className={styles.textInput}
              value={historical.rival || ''}
              onChange={(e) => setHistoricalRival(e.target.value)}
              placeholder="optional"
              maxLength={3}
            />
          </div>
        </div>
      )}

      {historical.sessionCode && (
        <button type="button" className={styles.runBtn} onClick={onLoad} disabled={!canLoad || busy}>
          {busy ? 'LOADING…' : 'LOAD REPLAY'}
        </button>
      )}

      {/* A failed LOAD REPLAY never sets historical.active, so the shared
          error box further down (gated on a race actually being loaded)
          would never render it — shown here instead, in context. */}
      {historical.error && !historical.active && (
        <div className={styles.errorBox}>
          <div className={styles.errorTitle}>HISTORICAL REPLAY UNAVAILABLE</div>
          <div className={styles.errorDetail}>{historical.error}</div>
        </div>
      )}
    </div>
  )
}

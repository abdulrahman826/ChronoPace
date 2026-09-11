import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  fetchDecision, fetchReplayRaces, fetchReplaySeasons, fetchReplaySessions,
  fetchHistoricalLap, fetchHistoricalLapTimeline, isApiConfigured,
} from './api'
import { adaptDecision } from './adaptDecision'
import * as mock from '../data/mockTelemetry'

const FALLBACK_BUNDLE = {
  telemetry: mock.telemetry,
  raceStatus: mock.raceStatus,
  complianceChecks: mock.complianceChecks,
  liveComplianceChecks: null, // null in fallback mode — ComplianceProbe renders complianceChecks (mock) instead
  breachExample: mock.breachExample,
  overtakeBonus: mock.overtakeBonus,
  modeProjections: mock.modeProjections,
  nIterations: mock.nIterations,
  rivalEstimate: mock.rivalEstimate,
  strategicRival: mock.strategicRival,
  confidenceGatePass: mock.confidenceGatePass,
  confidenceGateOverride: mock.confidenceGateOverride,
  opportunity: mock.opportunity,
}

const SYNTHETIC_PARAMS = {
  // A mid-race snapshot (lap 25/50), not the provider's default last lap
  // (50/50, "race over") — an explicit, disclosed choice of which real lap
  // to view, not fabricated data. with_narrative:true asks the backend to
  // also fill `narrative` (its own template/LLM prose, explicitly
  // documented server-side as explanation-only).
  source: 'synthetic',
  scenario: 'B',
  seed: 42,
  total_laps: 50,
  lap: 25,
  with_narrative: true,
}

const INITIAL_HISTORICAL = {
  active: false, // true only after a historical fetch has actually succeeded at least once
  racesLoaded: false,
  races: [], // [{key, name, circuit, year, session, scheduled_laps, default_driver, default_rival, note}], from GET /api/v1/replay/races (curated/featured set)
  race: null,
  driver: null,
  rival: null,
  lap: 1,
  totalLaps: null,
  playing: false,
  loading: false,
  error: null,

  // --- Season -> Grand Prix -> Session discovery (additive; the curated set
  // above keeps working exactly as before whether or not this is ever used) ---
  browsing: false, // UI toggle: show the discovery selects instead of the curated field
  seasons: [], // [{season, available, rounds}], from GET /api/v1/replay/seasons
  seasonsLoaded: false,
  seasonsLoading: false,
  seasonsError: null,
  season: null, // selected season (number)
  seasonRaces: [], // discovered events for `season`, from GET /api/v1/replay/races?season=
  seasonRacesLoaded: false,
  seasonRacesLoading: false,
  seasonRacesError: null,
  seasonEvent: null, // selected discovered event's `event` name (what the backend's get_session() accepts)
  sessions: [], // [{name, code, date_utc}] for the selected season+event, from GET /api/v1/replay/sessions
  sessionsLoaded: false,
  sessionsLoading: false,
  sessionsError: null,
  sessionCode: null, // selected session code, e.g. "R"
  isAdHoc: false, // true when the ACTIVE replay is a discovered race, not the curated registry

  // --- tick-level strategic-rival summary for the CURRENT lap (from
  // raw.summary.strategic_rival — NOT raw.snapshot.rival, which does not
  // carry these fields; see adaptDecision.js's comments) ---
  tickSummary: null, // {tickLevel, changesThisLap, tickShare} | null

  // --- telemetry-tick timeline, fetched only on explicit request and cached
  // by (race, lap, driver, rival) so switching laps never refetches one
  // already seen and moving the slider alone never fetches anything ---
  timeline: null,
  timelineKey: null,
  timelineLoading: false,
  timelineError: null,
}

const DashboardDataContext = createContext({
  ...FALLBACK_BUNDLE,
  isLive: false,
  loading: false,
  error: null,
  historical: INITIAL_HISTORICAL,
})

/** Fetches one live decision from the backend (POST /api/v1/decision) on
 * mount and provides it to every dashboard component, reshaped to match
 * mockTelemetry.js's exports exactly (see adaptDecision.js) — so no
 * component needs to know or care whether it's reading live, mock, or
 * historical-replay data; they're the same DecisionSnapshot shape either
 * way.
 *
 * Falls back to the static mock bundle, completely unchanged, whenever
 * VITE_API_URL isn't set or the *synthetic* fetch fails for any reason
 * (network, CORS, non-2xx, timeout). This fetches once per page load; it
 * does not poll.
 *
 * Historical replay (GET /api/v1/replay/races, GET /api/v1/replay/
 * historical/{race}/{lap}) is a separate, explicit user action — see
 * `historical` below and HistoricalReplayControl.jsx. It deliberately does
 * NOT share the synthetic path's fallback-to-mock behavior: a failed
 * historical fetch surfaces `historical.error` instead, and the dashboard
 * simply keeps showing whatever it last showed rather than silently
 * reverting to mock data the user never asked for. */
export function DashboardDataProvider({ children }) {
  const [state, setState] = useState({
    ...FALLBACK_BUNDLE,
    isLive: false,
    loading: isApiConfigured(),
    error: null,
  })
  const [historical, setHistorical] = useState(INITIAL_HISTORICAL)
  // Bumped on every runHistoricalReplay call, checked when each one's fetch
  // resolves — a response only gets applied if it's still the most recent
  // request in flight. Without this, a slow response to an earlier lap could
  // resolve after a faster response to a later one and overwrite it with
  // stale data (including a stale strategic rival) if the user moves the
  // slider and re-runs quickly.
  const historicalRequestSeq = useRef(0)

  const loadSynthetic = useCallback((signal) => {
    return fetchDecision(SYNTHETIC_PARAMS, { signal }).then((raw) => {
      console.info('[ChronoPace] Live decision received from backend:', raw)
      setState({ ...adaptDecision(raw), isLive: true, loading: false, error: null })
    })
  }, [])

  useEffect(() => {
    if (!isApiConfigured()) {
      console.info('[ChronoPace] VITE_API_URL not set — using mock data.')
      return
    }
    const controller = new AbortController()
    let cancelled = false

    loadSynthetic(controller.signal).catch((err) => {
      if (cancelled || err.name === 'AbortError') return
      console.error('[ChronoPace] Live decision fetch failed — falling back to mock data.', err)
      setState({ ...FALLBACK_BUNDLE, isLive: false, loading: false, error: err.message })
    })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [loadSynthetic])

  // GET /api/v1/replay/races — loaded lazily, once, the first time the
  // replay control panel is opened (not on every page load, since most
  // sessions never touch historical replay at all).
  const loadHistoricalRaces = useCallback(async () => {
    if (!isApiConfigured()) return
    setHistorical((h) => ({ ...h, loading: true, error: null }))
    try {
      const data = await fetchReplayRaces()
      const races = Array.isArray(data.races) ? data.races : []
      const first = races[0] || null
      setHistorical((h) => ({
        ...h,
        racesLoaded: true,
        races,
        race: h.race || first?.key || null,
        driver: h.driver || first?.default_driver || null,
        rival: h.rival || first?.default_rival || null,
        totalLaps: first?.scheduled_laps ?? h.totalLaps,
        loading: false,
      }))
    } catch (err) {
      setHistorical((h) => ({ ...h, loading: false, error: err.message }))
    }
  }, [])

  const setHistoricalLap = useCallback((lap) => {
    setHistorical((h) => ({ ...h, lap }))
  }, [])

  // --- Season -> Grand Prix -> Session discovery (§3) ---------------------
  // GET /api/v1/replay/seasons — loaded once, lazily, only when the user
  // opens the "browse other races" section (not on every panel open, since
  // most sessions only ever touch the curated race).
  const loadSeasons = useCallback(async () => {
    if (!isApiConfigured()) return
    setHistorical((h) => ({ ...h, seasonsLoading: true, seasonsError: null }))
    try {
      const data = await fetchReplaySeasons()
      setHistorical((h) => ({
        ...h, seasonsLoaded: true, seasonsLoading: false,
        seasons: Array.isArray(data.seasons) ? data.seasons : [],
      }))
    } catch (err) {
      setHistorical((h) => ({ ...h, seasonsLoading: false, seasonsError: err.message }))
    }
  }, [])

  // GET /api/v1/replay/races?season= — the live FastF1 schedule for one
  // season. `available` on each season entry (from loadSeasons) already says
  // whether this is expected to work; a failure here (network/cache-miss for
  // an otherwise-listed season) surfaces as seasonRacesError, never a silent
  // empty list pretending to be "no races that year".
  const selectSeason = useCallback(async (season) => {
    setHistorical((h) => ({
      ...h, season, seasonEvent: null, sessions: [], sessionsLoaded: false, sessionCode: null,
      seasonRacesLoading: true, seasonRacesError: null, seasonRaces: [], seasonRacesLoaded: false,
    }))
    try {
      const data = await fetchReplayRaces({ season })
      setHistorical((h) => (h.season !== season ? h : {
        ...h, seasonRacesLoaded: true, seasonRacesLoading: false,
        seasonRaces: Array.isArray(data.races) ? data.races : [],
      }))
    } catch (err) {
      setHistorical((h) => (h.season !== season ? h : {
        ...h, seasonRacesLoading: false, seasonRacesError: err.message,
      }))
    }
  }, [])

  // GET /api/v1/replay/sessions?season=&race= — the sessions FastF1 actually
  // scheduled for one discovered event (Race, Qualifying, Sprint, ...).
  const selectSeasonEvent = useCallback(async (season, event) => {
    setHistorical((h) => ({
      ...h, seasonEvent: event, sessionCode: null,
      sessionsLoading: true, sessionsError: null, sessions: [], sessionsLoaded: false,
    }))
    try {
      const data = await fetchReplaySessions(season, event)
      const sessions = Array.isArray(data.sessions) ? data.sessions : []
      const race = sessions.find((s) => s.code === 'R') || sessions[0] || null
      setHistorical((h) => (h.seasonEvent !== event ? h : {
        ...h, sessionsLoaded: true, sessionsLoading: false, sessions,
        sessionCode: race?.code || null,
      }))
    } catch (err) {
      setHistorical((h) => (h.seasonEvent !== event ? h : {
        ...h, sessionsLoading: false, sessionsError: err.message,
      }))
    }
  }, [])

  const selectSessionCode = useCallback((code) => {
    setHistorical((h) => ({ ...h, sessionCode: code }))
  }, [])

  // Editable in ad-hoc/browsing mode only (the curated race's driver/rival
  // come from the registry and stay read-only, exactly as before).
  const setHistoricalDriver = useCallback((code) => {
    setHistorical((h) => ({ ...h, driver: code.toUpperCase() }))
  }, [])
  const setHistoricalRival = useCallback((code) => {
    setHistorical((h) => ({ ...h, rival: code.toUpperCase() }))
  }, [])

  const toggleBrowsing = useCallback(() => {
    setHistorical((h) => {
      const browsing = !h.browsing
      // Entering browse mode: clear driver/rival so the free-text inputs
      // start empty rather than showing the curated race's leftover LEC/PIA
      // (which, with maxLength=3, silently blocked typing a real driver code
      // over it). Leaving browse mode restores the curated race's own values.
      if (browsing) {
        return { ...h, browsing, driver: '', rival: '' }
      }
      // Leaving browse mode: `h.race` may currently hold an ad-hoc event
      // name (e.g. "Spanish Grand Prix") from a discovered replay, which
      // isn't a key in the curated list at all — fall back to the first
      // curated race rather than pointing at a race that can't be found.
      const curated = h.races.find((r) => r.key === h.race) || h.races[0] || null
      return {
        ...h, browsing,
        race: curated?.key ?? h.race,
        driver: curated?.default_driver || h.driver,
        rival: curated?.default_rival || h.rival,
        totalLaps: curated?.scheduled_laps ?? h.totalLaps,
        isAdHoc: false,
      }
    })
  }, [])

  // POST-equivalent single-lap fetch (GET /api/v1/replay/historical/{race}/{lap})
  // for the exact race/lap/driver/rival currently selected. On success this
  // replaces the SAME shared bundle the synthetic path uses (so every
  // existing component updates automatically, per adaptDecision.js's
  // shape). On failure it only sets `historical.error` — `state` (the
  // dashboard's actual displayed data) is left untouched, which is what
  // keeps this from ever silently substituting mock data for a real
  // historical request the user explicitly made.
  const runHistoricalReplay = useCallback(async ({ race, lap, driver, rival, season, event, session, isAdHoc }) => {
    const seq = ++historicalRequestSeq.current
    setHistorical((h) => ({ ...h, loading: true, error: null }))
    try {
      const raw = await fetchHistoricalLap(race, lap, { driver, rival, season, event, session })
      // A newer runHistoricalReplay call has started since this one fired —
      // discard this response rather than let a slow earlier lap overwrite
      // a faster later one (§14: the latest request must always win).
      if (seq !== historicalRequestSeq.current) return false
      console.info('[ChronoPace] Historical decision received from backend:', raw)
      const adapted = adaptDecision(raw.snapshot)
      setState({
        ...adapted,
        // Overrides the adapter's own dataMode text (derived from
        // meta.data_mode, whatever the backend calls this) with the exact
        // mode label this feature calls for — a real, tracked UI state
        // (a historical fetch just genuinely succeeded), not fabricated
        // data layered on top of the response.
        raceStatus: { ...adapted.raceStatus, dataMode: 'FASTF1 HISTORICAL REPLAY' },
        isLive: true,
        loading: false,
        error: null,
      })
      // `changes_this_lap`/`tick_level`/`tick_share` live only in the compact
      // `summary.strategic_rival` block, not in `snapshot.rival` (confirmed
      // against the actual engine-repo RivalBlock schema — it doesn't carry
      // these) — captured separately here rather than invented into the
      // adapter's output.
      const srSummary = raw.summary?.strategic_rival || null
      const tickSummary = srSummary
        ? {
            tickLevel: Boolean(srSummary.tick_level),
            changesThisLap: srSummary.changes_this_lap ?? null,
            tickShare: srSummary.tick_share || null,
          }
        : null
      setHistorical((h) => ({
        ...h, active: true, race, lap, driver, rival,
        season: season ?? h.season, seasonEvent: event ?? h.seasonEvent, sessionCode: session ?? h.sessionCode,
        isAdHoc: Boolean(isAdHoc), tickSummary,
        // the registry's scheduled_laps is 0/unknown for an ad-hoc race (see
        // api.js's fetchHistoricalLap comment) — the response's own
        // meta.total_laps (already in `adapted.telemetry.totalLaps`) is the
        // real, backend-reported figure either way, so prefer it.
        totalLaps: adapted.telemetry.totalLaps ?? h.totalLaps,
        // a fresh lap invalidates any previously-fetched timeline detail
        timeline: null, timelineKey: null, timelineError: null,
        loading: false, error: null,
      }))
      return true
    } catch (err) {
      if (seq !== historicalRequestSeq.current) return false
      console.error('[ChronoPace] Historical replay fetch failed.', err)
      setHistorical((h) => ({ ...h, loading: false, error: err.message }))
      return false
    }
  }, [])

  // GET /api/v1/replay/historical/{race}/{lap}/timeline — fetched ONLY when
  // explicitly requested (never on every render/lap change), and cached by
  // (race, lap, driver, rival, season, event, session) so re-opening a lap
  // already fetched costs nothing (§12).
  const loadStrategicRivalTimeline = useCallback(async ({ race, lap, driver, rival, season, event, session }) => {
    const key = JSON.stringify([race, lap, driver, rival, season ?? null, event ?? null, session ?? null])
    let alreadyCached = false
    setHistorical((h) => {
      if (h.timelineKey === key && h.timeline) {
        alreadyCached = true
        return h
      }
      return { ...h, timelineLoading: true, timelineError: null }
    })
    if (alreadyCached) return
    try {
      const data = await fetchHistoricalLapTimeline(race, lap, { driver, rival, season, event, session })
      setHistorical((h) => ({ ...h, timeline: data, timelineKey: key, timelineLoading: false, timelineError: null }))
    } catch (err) {
      setHistorical((h) => ({ ...h, timelineLoading: false, timelineError: err.message }))
    }
  }, [])

  const stopHistoricalPlayback = useCallback(() => {
    setHistorical((h) => ({ ...h, playing: false }))
  }, [])

  const setHistoricalPlaying = useCallback((playing) => {
    setHistorical((h) => ({ ...h, playing }))
  }, [])

  // Returns the dashboard to the synthetic snapshot it showed before
  // historical replay was ever opened — a real re-fetch, not just a flag
  // flip, so "switch back to synthetic" leaves no stale historical numbers
  // behind.
  const exitHistoricalMode = useCallback(() => {
    setHistorical((h) => ({
      ...h, active: false, playing: false, error: null,
      tickSummary: null, timeline: null, timelineKey: null, timelineError: null,
    }))
    if (!isApiConfigured()) {
      setState({ ...FALLBACK_BUNDLE, isLive: false, loading: false, error: null })
      return
    }
    loadSynthetic().catch((err) => {
      console.error('[ChronoPace] Returning to synthetic mode failed — falling back to mock data.', err)
      setState({ ...FALLBACK_BUNDLE, isLive: false, loading: false, error: err.message })
    })
  }, [loadSynthetic])

  const value = {
    ...state,
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
    loadStrategicRivalTimeline,
  }

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>
}

export function useDashboardData() {
  return useContext(DashboardDataContext)
}

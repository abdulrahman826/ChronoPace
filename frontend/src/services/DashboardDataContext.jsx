import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { fetchDecision, fetchReplayRaces, fetchHistoricalLap, isApiConfigured } from './api'
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
  confidenceGatePass: mock.confidenceGatePass,
  confidenceGateOverride: mock.confidenceGateOverride,
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
  races: [], // [{key, name, circuit, year, session, scheduled_laps, default_driver, default_rival, note}], from GET /api/v1/replay/races
  race: null,
  driver: null,
  rival: null,
  lap: 1,
  totalLaps: null,
  playing: false,
  loading: false,
  error: null,
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

  // POST-equivalent single-lap fetch (GET /api/v1/replay/historical/{race}/{lap})
  // for the exact race/lap/driver/rival currently selected. On success this
  // replaces the SAME shared bundle the synthetic path uses (so every
  // existing component updates automatically, per adaptDecision.js's
  // shape). On failure it only sets `historical.error` — `state` (the
  // dashboard's actual displayed data) is left untouched, which is what
  // keeps this from ever silently substituting mock data for a real
  // historical request the user explicitly made.
  const runHistoricalReplay = useCallback(async ({ race, lap, driver, rival }) => {
    setHistorical((h) => ({ ...h, loading: true, error: null }))
    try {
      const raw = await fetchHistoricalLap(race, lap, { driver, rival })
      console.info('[ChronoPace] Historical decision received from backend:', raw)
      const adapted = adaptDecision(raw.snapshot)
      setState({
        ...adapted,
        // Overrides the adapter's own dataMode text (derived from
        // meta.data_mode, whatever the backend calls this) with the exact
        // mode label this feature calls for — a real, tracked UI state
        // (a historical fetch just genuinely succeeded), not fabricated
        // data layered on top of the response.
        raceStatus: { ...adapted.raceStatus, dataMode: 'HISTORICAL REPLAY · REAL TELEMETRY' },
        isLive: true,
        loading: false,
        error: null,
      })
      setHistorical((h) => ({ ...h, active: true, race, lap, driver, rival, loading: false, error: null }))
      return true
    } catch (err) {
      console.error('[ChronoPace] Historical replay fetch failed.', err)
      setHistorical((h) => ({ ...h, loading: false, error: err.message }))
      return false
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
    setHistorical((h) => ({ ...h, active: false, playing: false, error: null }))
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
  }

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>
}

export function useDashboardData() {
  return useContext(DashboardDataContext)
}

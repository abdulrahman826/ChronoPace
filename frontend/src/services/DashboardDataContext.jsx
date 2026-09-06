import { createContext, useContext, useEffect, useState } from 'react'
import { fetchDecision, isApiConfigured } from './api'
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

const DashboardDataContext = createContext({
  ...FALLBACK_BUNDLE,
  isLive: false,
  loading: false,
  error: null,
})

/** Fetches one live decision from the backend (POST /api/v1/decision) on
 * mount and provides it to every dashboard component, reshaped to match
 * mockTelemetry.js's exports exactly (see adaptDecision.js) — so no
 * component needs to know or care whether it's reading live or mock data.
 *
 * Falls back to the static mock bundle, completely unchanged, whenever
 * VITE_API_URL isn't set or the fetch fails for any reason (network,
 * CORS, non-2xx, timeout) — every component keeps working exactly as it
 * did before this file existed. This fetches once per page load; it does
 * not poll. */
export function DashboardDataProvider({ children }) {
  const [state, setState] = useState({
    ...FALLBACK_BUNDLE,
    isLive: false,
    loading: isApiConfigured(),
    error: null,
  })

  useEffect(() => {
    if (!isApiConfigured()) {
      console.info('[ChronoPace] VITE_API_URL not set — using mock data.')
      return
    }

    let cancelled = false
    const controller = new AbortController()

    fetchDecision(
      // A mid-race snapshot (lap 25/50), not the provider's default last
      // lap (50/50, "race over") — an explicit, disclosed choice of which
      // real lap to view, not fabricated data. with_narrative:true asks
      // the backend to also fill `narrative` (its own template/LLM prose,
      // explicitly documented server-side as explanation-only).
      { source: 'synthetic', scenario: 'B', seed: 42, total_laps: 50, lap: 25, with_narrative: true },
      { signal: controller.signal },
    )
      .then((raw) => {
        if (cancelled) return
        console.info('[ChronoPace] Live decision received from backend:', raw)
        setState({ ...adaptDecision(raw), isLive: true, loading: false, error: null })
      })
      .catch((err) => {
        if (cancelled || err.name === 'AbortError') return
        console.error('[ChronoPace] Live decision fetch failed — falling back to mock data.', err)
        setState({ ...FALLBACK_BUNDLE, isLive: false, loading: false, error: err.message })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  return <DashboardDataContext.Provider value={state}>{children}</DashboardDataContext.Provider>
}

export function useDashboardData() {
  return useContext(DashboardDataContext)
}

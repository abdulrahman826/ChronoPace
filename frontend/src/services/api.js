// Thin HTTP client for the ChronoPace backend. Response-shape adaptation
// into the UI's existing data contract lives in adaptDecision.js, kept
// separate so this file stays a plain, honest fetch wrapper with no data
// massaging in it.

const API_BASE_URL = import.meta.env.VITE_API_URL

export function isApiConfigured() {
  return Boolean(API_BASE_URL)
}

async function getJson(path, { signal } = {}) {
  if (!API_BASE_URL) {
    throw new Error('VITE_API_URL is not configured')
  }
  const res = await fetch(`${API_BASE_URL}${path}`, { signal })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}${body ? `: ${body}` : ''}`)
  }
  return res.json()
}

/**
 * POST /api/v1/decision. `params` matches the backend's own DecisionRequest
 * schema — as of the 2026-09-06 contract: `source` ('synthetic' | 'fastf1'),
 * `scenario` (A-E), `seed`, `total_laps`, `lap` (omit for the provider's
 * last lap), `with_narrative` (fills `snapshot.narrative` via the backend's
 * LLM/template layer — explicitly documented server-side as "explanation
 * only, never authoritative"), `fastf1` (a FastF1Spec, only when
 * source='fastf1'). All optional; the backend applies its own defaults for
 * anything omitted. Throws on a non-2xx response or network failure — the
 * caller (see DashboardDataContext) is what decides to fall back to mock
 * data.
 */
export async function fetchDecision(params = {}, { signal } = {}) {
  if (!API_BASE_URL) {
    throw new Error('VITE_API_URL is not configured')
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Decision API responded ${res.status}${body ? `: ${body}` : ''}`)
  }

  return res.json()
}

/**
 * GET /api/v1/replay/races — the backend's registry of supported historical
 * races. Response is `{fastf1_available: bool, races: [{key, name, circuit,
 * year, session, scheduled_laps, default_driver, default_rival, note}]}` as
 * observed live 2026-09-07 (the OpenAPI schema itself only declares this as
 * an untyped object, so this shape is read from a real response, not
 * assumed from a spec).
 */
export async function fetchReplayRaces({ signal } = {}) {
  return getJson('/api/v1/replay/races', { signal })
}

/**
 * GET /api/v1/replay/historical/{race}/{lap} — a single lap's DecisionSnapshot,
 * computed by the backend from real telemetry available up to (and not
 * beyond) that lap. `race` is a registry key from fetchReplayRaces(), `lap`
 * an integer. `driver`/`rival` are 3-letter codes (omit to use the
 * registry's defaults); `seed` defaults to 42 server-side.
 *
 * The frontend sends only race + lap (+ optional driver/rival/seed) — never
 * telemetry, never an outcome, never anything from a later lap. Causal
 * replay (only using telemetry up to lap N) is the backend's responsibility
 * entirely; this function has no way to influence that either way.
 */
export async function fetchHistoricalLap(race, lap, { driver, rival, seed, signal } = {}) {
  const params = new URLSearchParams()
  if (driver) params.set('driver', driver)
  if (rival) params.set('rival', rival)
  if (seed != null) params.set('seed', String(seed))
  params.set('full_snapshot', 'true')
  const qs = params.toString()
  return getJson(`/api/v1/replay/historical/${encodeURIComponent(race)}/${lap}${qs ? `?${qs}` : ''}`, { signal })
}

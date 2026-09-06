// Thin HTTP client for the ChronoPace backend. Talks to the one endpoint
// the dashboard currently needs (POST /api/v1/decision) and nothing else.
// Response-shape adaptation into the UI's existing data contract lives in
// adaptDecision.js, kept separate so this file stays a plain, honest
// fetch wrapper with no data massaging in it.

const API_BASE_URL = import.meta.env.VITE_API_URL

export function isApiConfigured() {
  return Boolean(API_BASE_URL)
}

/**
 * POST /api/v1/decision. `params` matches the backend's own DecisionRequest
 * schema (session_id, lap, driver, rival, scenario) — all optional; the
 * backend applies its own defaults/replay-position for anything omitted.
 * Throws on a non-2xx response or network failure — the caller (see
 * DashboardDataContext) is what decides to fall back to mock data.
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

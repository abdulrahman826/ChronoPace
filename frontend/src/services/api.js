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
 * races. With no `season`, response is `{fastf1_available, note, races:
 * [{key, name, circuit, year, session, scheduled_laps, default_driver,
 * default_rival, note}]}` — the small curated/featured set, unchanged shape.
 * With `season`, response is `{fastf1_available, season, races: [{round,
 * event, name, official_name, country, location, event_date, format,
 * telemetry_supported, sessions: [code, ...]}]}` — the live FastF1 schedule
 * for that year (app.replay.discovery.list_races), confirmed live 2026-09-09
 * against the actual engine repo response, not assumed from a spec.
 */
export async function fetchReplayRaces({ season, signal } = {}) {
  const qs = season != null ? `?season=${encodeURIComponent(season)}` : ''
  return getJson(`/api/v1/replay/races${qs}`, { signal })
}

/**
 * GET /api/v1/replay/seasons — `{fastf1_available, seasons: [{season,
 * available, rounds}]}`. `available` reflects whether that season's FastF1
 * schedule actually loads right now (cache/network) — a season can be listed
 * but not currently available, and the UI must respect that rather than
 * assuming every listed season works.
 */
export async function fetchReplaySeasons({ signal } = {}) {
  return getJson('/api/v1/replay/seasons', { signal })
}

/**
 * GET /api/v1/replay/sessions?season=&race= — `{season, round, event, name,
 * circuit, country, telemetry_supported, sessions: [{name, code, date_utc}]}`
 * for one discovered event. `race` is the event name/round FastF1 recognizes
 * (from fetchReplayRaces({season}))'s `event`/`round` field, not a made-up id.
 */
export async function fetchReplaySessions(season, race, { signal } = {}) {
  const qs = `?season=${encodeURIComponent(season)}&race=${encodeURIComponent(race)}`
  return getJson(`/api/v1/replay/sessions${qs}`, { signal })
}

/**
 * GET /api/v1/replay/historical/{race}/{lap} — a single lap's DecisionSnapshot,
 * computed by the backend from real telemetry available up to (and not
 * beyond) that lap. `race` is either a registry key from fetchReplayRaces()
 * (curated set) or, with `season`/`event`/`session` also supplied, an ad-hoc
 * race resolved live from the FastF1 schedule (app.replay.discovery) — the
 * same three params the POST /historical endpoint has always accepted,
 * additively threaded onto this GET route (engine repo, 2026-09-09) so a
 * discovered race can use the same per-lap flow as the curated one.
 * `driver`/`rival` are 3-letter codes (omit to use the registry's defaults —
 * an ad-hoc race requires `driver` explicitly, the backend has no default for
 * one); `seed` defaults to 42 server-side.
 *
 * The frontend sends only race + lap (+ optional driver/rival/seed/season/
 * event/session) — never telemetry, never an outcome, never anything from a
 * later lap. Causal replay (only using telemetry up to lap N) is the
 * backend's responsibility entirely; this function has no way to influence
 * that either way.
 */
export async function fetchHistoricalLap(
  race, lap, { driver, rival, seed, season, event, session, signal } = {},
) {
  const params = new URLSearchParams()
  if (driver) params.set('driver', driver)
  if (rival) params.set('rival', rival)
  if (seed != null) params.set('seed', String(seed))
  if (season != null) params.set('season', String(season))
  if (event) params.set('event', event)
  if (session) params.set('session', session)
  params.set('full_snapshot', 'true')
  const qs = params.toString()
  return getJson(`/api/v1/replay/historical/${encodeURIComponent(race)}/${lap}${qs ? `?${qs}` : ''}`, { signal })
}

/**
 * GET /api/v1/replay/historical/{race}/{lap}/timeline — the telemetry-tick
 * strategic-rival stream BEHIND one lap's compact pick (§14 detail-on-request
 * endpoint; the default per-lap response never carries this). Confirmed live
 * shape (engine repo, 2026-09-09): `{race, lap, our_driver, focus_rival,
 * tick_cadence_hz, total_ticks_this_lap, returned_ticks, downsample_step,
 * summary: {dominant_driver, dominant_role, dominant_ahead, dominant_gap_s,
 * first_driver, last_driver, n_changes, share_by_driver} | null,
 * change_events: [...], ticks: [{t, session_time_s, driver, role, ahead,
 * gap_s, relevance, switched, raw_leader}], provenance: {REAL, MODELED}}`.
 * `tick_cadence_hz` is whatever FastF1 actually sampled at for this lap
 * (confirmed ~4 Hz on real data) — never assume or display a fixed rate.
 */
export async function fetchHistoricalLapTimeline(
  race, lap, { driver, rival, season, event, session, maxTicks, signal } = {},
) {
  const params = new URLSearchParams()
  if (driver) params.set('driver', driver)
  if (rival) params.set('rival', rival)
  if (season != null) params.set('season', String(season))
  if (event) params.set('event', event)
  if (session) params.set('session', session)
  if (maxTicks != null) params.set('max_ticks', String(maxTicks))
  const qs = params.toString()
  return getJson(
    `/api/v1/replay/historical/${encodeURIComponent(race)}/${lap}/timeline${qs ? `?${qs}` : ''}`,
    { signal },
  )
}

/**
 * GET /api/v1/validation/summary?scenario=&seed=&total_laps= — controlled
 * hidden-state validation metrics, entirely separate from the live decision
 * path (confirmed live on the chronopace-demo-ready branch, 2026-09-12).
 * Response: `{scenario, seed, total_laps, generated_at, ground_truth_available,
 * rival_soc: {mae_mj, rmse_mj, median_ae_mj, p90_ae_mj, sample_count,
 * evaluation_note, honesty_notice, ...}, rival_classification: {accuracy,
 * per_class_f1, confusion_matrix, sample_count, ...}, overtake_calibration,
 * decision_accuracy}`. The last two currently come back as
 * `NotImplementedMetric` (`{implemented:false, ground_truth_available:false,
 * note}`) — the backend's own honest "not yet benchmarked" state, not
 * something this frontend should paper over with an invented number.
 */
export async function fetchValidationSummary({ scenario, seed, totalLaps, signal } = {}) {
  const params = new URLSearchParams()
  if (scenario) params.set('scenario', scenario)
  if (seed != null) params.set('seed', String(seed))
  if (totalLaps != null) params.set('total_laps', String(totalLaps))
  const qs = params.toString()
  return getJson(`/api/v1/validation/summary${qs ? `?${qs}` : ''}`, { signal })
}

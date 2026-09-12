import GlassPanel from './GlassPanel'
import { CompassIcon } from './Icons'
import { MODE_LABELS } from '../data/mockTelemetry'
import { useDashboardData } from '../services/DashboardDataContext'
import styles from './DecisionContext.module.css'

const AERO_LABELS = {
  OVERTAKE_ELIGIBLE: 'OVERTAKE ELIGIBLE',
  STRAIGHT_MODE: 'STRAIGHT MODE',
  CORNER_MODE: 'CORNER MODE',
  UNKNOWN: 'UNKNOWN',
}

function actionLabel(action) {
  if (!action) return '—'
  return MODE_LABELS[action] ?? action.replace(/_/g, ' ')
}

/** Combines three explanation-tier panels the backend's chronopace-demo-ready
 * contract newly exposes — ContextAttributionBlock, CounterfactualBlock, and
 * the reasoning trace — into one compact card. Three distinct sub-sections,
 * one shared GlassPanel shell, because the 1440x900 no-scroll budget doesn't
 * have room for three separate bordered cards at this tier (see context.md
 * §12's layout notes on the fixed support-row height). Nothing here computes
 * anything; every value is a real backend field, reshaped in adaptDecision.js
 * (contextAttribution/counterfactual/trace), never recalculated here. */
export default function DecisionContext() {
  const { contextAttribution: ctx, counterfactual: cf, trace } = useDashboardData()

  return (
    <GlassPanel className={styles.wrap}>
      <div className="panelHeaderRow">
        <CompassIcon width={16} height={16} />
        <h3 className={styles.title}>DECISION CONTEXT</h3>
      </div>

      <div className={styles.columns}>
        {/* ── Context Attribution ── */}
        <div className={styles.col}>
          <span className={styles.colLabel}>EVIDENCE ATTRIBUTION</span>
          {ctx ? (
            <>
              <div className={styles.ctxRow}>
                <span className={styles.aeroBadge}>{AERO_LABELS[ctx.activeAeroMode] ?? ctx.activeAeroMode ?? 'UNKNOWN'}</span>
                {ctx.residualEvidenceConfidence && (
                  <span className={styles.confBadge}>{ctx.residualEvidenceConfidence}</span>
                )}
              </div>
              {/* Real {tyre, energy, traffic_aero, other} proportions from
                  the backend (chronopace-demo-ready) when present — an
                  honest estimated split, never a client-computed one. Falls
                  back to the single tyre-compound/sector-delta line when a
                  snapshot doesn't include cause_attribution yet. */}
              {ctx.causeAttribution ? (
                <div className={styles.attrBars}>
                  {Object.entries(ctx.causeAttribution).map(([key, frac]) => (
                    <div key={key} className={styles.attrRow}>
                      <span className={styles.attrKey}>{key.replace('_', '/').toUpperCase()}</span>
                      <div className={styles.attrTrack}>
                        <div className={styles.attrFill} style={{ width: `${Math.round(frac * 100)}%` }} />
                      </div>
                      <span className={`num ${styles.attrPct}`}>{Math.round(frac * 100)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.ctxLine}>
                  <span className={styles.ctxKey}>Tyre context</span>
                  <span className={`num ${styles.ctxVal}`}>
                    {ctx.rivalTyreCompound ?? 'UNAVAILABLE'}{ctx.compoundBaselineActive === false ? ' (pooled)' : ''}
                  </span>
                </div>
              )}
              <div className={styles.ctxLine}>
                <span className={styles.ctxKey}>Observed sector Δ</span>
                <span className={`num ${styles.ctxVal}`}>
                  {ctx.observedSectorDeltaS != null ? `${ctx.observedSectorDeltaS.toFixed(2)}s` : 'UNAVAILABLE'}
                </span>
              </div>
              {ctx.contextExplainedNote && <div className={styles.ctxNote}>{ctx.contextExplainedNote}</div>}
              <div className={styles.ctxFoot}>ESTIMATED EVIDENCE ATTRIBUTION — RESIDUAL USED AS ENERGY EVIDENCE</div>
            </>
          ) : (
            <div className={styles.unavailable}>UNAVAILABLE</div>
          )}
        </div>

        {/* ── Counterfactual ── */}
        <div className={styles.col}>
          <span className={styles.colLabel}>WHAT IF: RUNNER-UP</span>
          {cf ? (
            <>
              <div className={styles.cfPair}>
                <div className={styles.cfSide}>
                  <span className={styles.cfTag}>CHOSEN</span>
                  <span className={`num ${styles.cfAction}`}>{actionLabel(cf.recommendedAction)}</span>
                  <span className={`num ${styles.cfSub}`}>
                    {cf.recommendedExpectedGainS != null ? `${cf.recommendedExpectedGainS > 0 ? '+' : ''}${cf.recommendedExpectedGainS.toFixed(2)}s` : '—'}
                    {cf.energyCostRecommendedMj != null ? ` · ${cf.energyCostRecommendedMj.toFixed(1)} MJ` : ''}
                  </span>
                </div>
                <div className={styles.cfSide}>
                  <span className={styles.cfTagAlt}>ALTERNATIVE</span>
                  <span className={`num ${styles.cfAction}`}>{actionLabel(cf.counterfactualAction)}</span>
                  <span className={`num ${styles.cfSub}`}>
                    {cf.counterfactualExpectedGainS != null ? `${cf.counterfactualExpectedGainS > 0 ? '+' : ''}${cf.counterfactualExpectedGainS.toFixed(2)}s` : '—'}
                    {cf.energyCostCounterfactualMj != null ? ` · ${cf.energyCostCounterfactualMj.toFixed(1)} MJ` : ''}
                  </span>
                </div>
              </div>
              {cf.summary && <div className={styles.ctxNote}>{cf.summary}</div>}
            </>
          ) : (
            <div className={styles.unavailable}>UNAVAILABLE</div>
          )}
        </div>

        {/* ── Reasoning trace ── */}
        <div className={styles.col}>
          <span className={styles.colLabel}>REASONING TRACE</span>
          {trace && trace.length > 0 ? (
            <div className={styles.traceStrip}>
              {trace.map((t, i) => (
                <span key={i} className={styles.traceChip} title={t.detail}>
                  {t.stage}
                </span>
              ))}
            </div>
          ) : (
            <div className={styles.unavailable}>UNAVAILABLE</div>
          )}
        </div>
      </div>
    </GlassPanel>
  )
}

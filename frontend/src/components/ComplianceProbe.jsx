import GlassPanel from './GlassPanel'
import { ShieldIcon, CheckIcon, WarningIcon } from './Icons'
import { useDashboardData } from '../services/DashboardDataContext'
import styles from './ComplianceProbe.module.css'

// Accepts either the mock shape (value/limit/unit, rendered as
// "X.X/Y.Y UNIT") or the live backend's shape (a preformatted `detail`
// string, e.g. "1.87 / 9.0 MJ") — same row, whichever the data source
// provides. `status` is pass/breach/info live; only an exact 'breach' is
// shown as a failure, so an informational check never reads as a
// regulatory violation it isn't.
function CheckRow({ rule, value, limit, unit, detail, status }) {
  const isBreach = status === 'breach'
  const readout = detail != null ? detail : `${value.toFixed(1)}/${limit.toFixed(1)} ${unit}`
  return (
    <div className={styles.row}>
      <span className={styles.ruleName}>{rule}</span>
      <span className={`${styles.readout} num`}>{readout}</span>
      <span className={isBreach ? styles.tagBreach : styles.tagPass}>
        {isBreach ? <WarningIcon width={11} height={11} /> : <CheckIcon width={11} height={11} />}
        {isBreach ? 'BREACH' : status === 'info' ? 'INFO' : 'PASS'}
      </span>
    </div>
  )
}

/** Compliance Probe — FIA 2026 PU regulations, checked against live
 * telemetry. Article numbers are cited elsewhere (context.md, the full
 * data model) so a rule can be verified without reading logic; dropped
 * from this compact row only to save width, not hidden from the project.
 *
 * @param {boolean} [compact=false]  hide the illustrative breach example
 *   and the banked-bonus footnote — real content, just not essential for
 *   a glanceable bottom-row tile. Nothing here is deleted from the data,
 *   only from what this particular rendering shows.
 */
export default function ComplianceProbe({ className, compact = false }) {
  const { complianceChecks, liveComplianceChecks, overtakeBonus, breachExample } = useDashboardData()
  // Real live checks when connected (richer and differently-shaped than
  // the mock's 3 fixed rows — see adaptDecision.js), the mock list
  // otherwise. Never a silent mix of the two. The live list also includes
  // two overtake-proximity/banking checks that duplicate the dedicated
  // "Overtake Bonus" row rendered below (same real gap/threshold numbers,
  // shown twice) — filtered out here to avoid showing the same fact
  // twice, not to hide data; that's also what keeps this panel's compact
  // row count matching what it was sized for.
  const checksToRender = liveComplianceChecks
    ? liveComplianceChecks.filter((c) => !/overtake/i.test(c.rule))
    : complianceChecks
  return (
    <GlassPanel className={className}>
      <div className="panelHeaderRow">
        <ShieldIcon width={16} height={16} />
        <h3 className={styles.title}>COMPLIANCE PROBE</h3>
        <span className={styles.subtitle}>FIA 2026 PU REGS</span>
      </div>

      <div className={styles.list}>
        {checksToRender.map((c) => (
          <CheckRow key={c.rule} {...c} />
        ))}

        <div className={styles.row}>
          <span className={styles.ruleName}>Overtake Bonus</span>
          <span className={styles.readout}>
            {overtakeBonus.gapS.toFixed(2)}s / {overtakeBonus.thresholdS.toFixed(1)}s
          </span>
          <span className={overtakeBonus.qualified ? styles.tagPass : styles.tagBreach}>
            {overtakeBonus.qualified ? <CheckIcon width={11} height={11} /> : <WarningIcon width={11} height={11} />}
            {overtakeBonus.qualified ? 'QUALIFIED' : 'NOT QUALIFIED'}
          </span>
        </div>
        {!compact && (
          <div className={styles.bankedNote}>
            Banked from Lap {overtakeBonus.bankedFromLap} — usable this lap only
          </div>
        )}
      </div>

      {!compact && (
        <div className={styles.breachExampleWrap}>
          <span className={styles.breachLabel}>Example breach state:</span>
          <CheckRow {...breachExample} />
        </div>
      )}
    </GlassPanel>
  )
}

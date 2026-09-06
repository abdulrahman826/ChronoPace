import GlassPanel from './GlassPanel'
import { ShieldIcon, CheckIcon, WarningIcon } from './Icons'
import { useDashboardData } from '../services/DashboardDataContext'
import styles from './ComplianceProbe.module.css'

function CheckRow({ rule, value, limit, unit, status }) {
  const isPass = status === 'pass'
  return (
    <div className={styles.row}>
      <span className={styles.ruleName}>{rule}</span>
      <span className={`${styles.readout} num`}>
        {value.toFixed(1)}/{limit.toFixed(1)} {unit}
      </span>
      <span className={isPass ? styles.tagPass : styles.tagBreach}>
        {isPass ? <CheckIcon width={11} height={11} /> : <WarningIcon width={11} height={11} />}
        {isPass ? 'PASS' : 'BREACH'}
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
  const { complianceChecks, overtakeBonus, breachExample } = useDashboardData()
  return (
    <GlassPanel className={className}>
      <div className="panelHeaderRow">
        <ShieldIcon width={16} height={16} />
        <h3 className={styles.title}>COMPLIANCE PROBE</h3>
        <span className={styles.subtitle}>FIA 2026 PU REGS</span>
      </div>

      <div className={styles.list}>
        {complianceChecks.map((c) => (
          <CheckRow key={c.rule} {...c} />
        ))}

        <div className={styles.row}>
          <span className={styles.ruleName}>Overtake Bonus</span>
          <span className={styles.readout}>
            {overtakeBonus.gapS.toFixed(2)}s / {overtakeBonus.thresholdS.toFixed(1)}s
          </span>
          <span className={overtakeBonus.qualified ? styles.tagPass : styles.tagBreach}>
            <CheckIcon width={11} height={11} />
            QUALIFIED
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

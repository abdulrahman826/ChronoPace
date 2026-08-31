import GlassPanel from './GlassPanel'
import { ShieldIcon, CheckIcon, WarningIcon } from './Icons'
import { complianceChecks, overtakeBonus, breachExample } from '../data/mockTelemetry'
import styles from './ComplianceProbe.module.css'

function CheckRow({ rule, value, limit, unit, article, status }) {
  const isPass = status === 'pass'
  return (
    <div className={styles.row}>
      <div className={styles.ruleInfo}>
        <span className={styles.ruleName}>{rule}</span>
        <span className={styles.article}>{article}</span>
      </div>
      <div className={styles.ruleValue}>
        <span className={`${styles.readout} num`}>
          {value.toFixed(1)} / {limit.toFixed(1)} {unit}
        </span>
        <span className={isPass ? styles.tagPass : styles.tagBreach}>
          {isPass ? <CheckIcon width={13} height={13} /> : <WarningIcon width={13} height={13} />}
          {isPass ? 'PASS' : 'BREACH'}
        </span>
      </div>
    </div>
  )
}

/** Compliance Probe — FIA 2026 PU regulations, checked against live
 * telemetry. Article numbers are cited so a rule can be verified without
 * reading logic. */
export default function ComplianceProbe() {
  return (
    <GlassPanel>
      <div className="panelHeaderRow">
        <ShieldIcon width={18} height={18} />
        <h3 className={styles.title}>COMPLIANCE PROBE</h3>
      </div>
      <div className={styles.subtitle}>FIA 2026 PU REGS</div>

      <div className={styles.list}>
        {complianceChecks.map((c) => (
          <CheckRow key={c.rule} {...c} />
        ))}

        <div className={styles.row}>
          <div className={styles.ruleInfo}>
            <span className={styles.ruleName}>Overtake Bonus</span>
            <span className={styles.article}>Gap {overtakeBonus.gapS.toFixed(2)}s / {overtakeBonus.thresholdS.toFixed(1)}s threshold</span>
          </div>
          <div className={styles.ruleValue}>
            <span className={overtakeBonus.qualified ? styles.tagPass : styles.tagBreach}>
              <CheckIcon width={13} height={13} />
              QUALIFIED FOR NEXT LAP
            </span>
          </div>
        </div>
        <div className={styles.bankedNote}>
          Banked from Lap {overtakeBonus.bankedFromLap} — usable this lap only
        </div>
      </div>

      <div className={styles.breachExampleWrap}>
        <span className={styles.breachLabel}>Example breach state:</span>
        <CheckRow {...breachExample} />
      </div>
    </GlassPanel>
  )
}

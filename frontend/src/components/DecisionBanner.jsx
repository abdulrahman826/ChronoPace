import { useState } from 'react'
import GlassPanel from './GlassPanel'
import { CheckIcon, WarningIcon } from './Icons'
import { MODE_LABELS } from '../data/mockTelemetry'
import { useDashboardData } from '../services/DashboardDataContext'
import styles from './DecisionBanner.module.css'

const GATE_LABELS = {
  statisticalReliability: 'RELIABILITY',
  practicalSignificance: 'SIGNIFICANCE',
  dcli: 'DRIVER LOAD',
  rivalConfidence: 'RIVAL CONF.',
}

/** Stage 3 Confidence Gate result — the actual decision, kept compact and
 * glanceable on purpose (context.md / the layout brief: this panel shows
 * ONLY the decision, not the reasoning behind it — that's Decision
 * Pipeline's job, and not the full simulation set — that's Monte Carlo's). */
export default function DecisionBanner() {
  const { confidenceGatePass, confidenceGateOverride } = useDashboardData()
  const [scenario, setScenario] = useState('pass')
  const result = scenario === 'pass' ? confidenceGatePass : confidenceGateOverride
  const isPass = !result.overridden

  return (
    <GlassPanel elevated className={styles.banner}>
      <div className={styles.headerRow}>
        <span className={styles.eyebrow}>CHRONOPACE DECISION</span>
        <button
          type="button"
          className={styles.demoToggle}
          onClick={() => setScenario((s) => (s === 'pass' ? 'override' : 'pass'))}
        >
          Demo: toggle
        </button>
      </div>

      <div className={styles.decisionRow}>
        <span className={`${styles.pulseDot} ${isPass ? styles.pulseDotGreen : styles.pulseDotAmber}`} />
        <h2 className={`${styles.decisionText} ${isPass ? styles.textGreen : styles.textAmber}`}>
          {isPass ? MODE_LABELS[result.recommendedMode] : `OVERRIDE → ${MODE_LABELS[result.recommendedMode]}`}
        </h2>
      </div>
      <div className={styles.whyRow}>
        <span className={styles.whyLabel}>WHY</span>
        <span className={styles.whyText}>
          {result.whyText ||
            (isPass
              ? `All ${Object.keys(result.gates).length} gates cleared — CI bound exceeds the ${result.minActionableLaptimeDeltaS.toFixed(2)}s action floor.`
              : result.overrideReason)}
        </span>
      </div>

      <div className={styles.statGrid}>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>CI Lower Bound</span>
          <span className={`num ${styles.statValue}`}>+{result.ciLowerBoundS.toFixed(2)}s</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>DCLI</span>
          <span className={`num ${styles.statValue}`}>{result.dcliScore}/100</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>Rival &sigma;</span>
          <span className={`num ${styles.statValue}`}>{result.rivalStdMj.toFixed(1)} MJ</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>t-statistic</span>
          <span className={`num ${styles.statValue}`}>{result.tStatistic.toFixed(2)}</span>
        </div>
      </div>

      <div className={styles.gateRow}>
        {Object.entries(result.gates).map(([key, passed]) => (
          <span key={key} className={passed ? styles.gatePillPass : styles.gatePillFail}>
            {passed ? <CheckIcon width={11} height={11} /> : <WarningIcon width={11} height={11} />}
            {GATE_LABELS[key]}
          </span>
        ))}
      </div>
    </GlassPanel>
  )
}

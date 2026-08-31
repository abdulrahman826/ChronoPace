import { useState } from 'react'
import GlassPanel from './GlassPanel'
import { CheckIcon, WarningIcon } from './Icons'
import { confidenceGatePass, confidenceGateOverride } from '../data/mockTelemetry'
import styles from './DecisionBanner.module.css'

const GATE_LABELS = {
  statisticalReliability: 'STATISTICAL RELIABILITY',
  practicalSignificance: 'PRACTICAL SIGNIFICANCE',
  dcli: 'DRIVER LOAD',
  rivalConfidence: 'RIVAL CONFIDENCE',
}

/** Stage 3 Statistical Confidence Gate decision banner. */
export default function DecisionBanner() {
  const [scenario, setScenario] = useState('pass')
  const result = scenario === 'pass' ? confidenceGatePass : confidenceGateOverride
  const isPass = !result.overridden

  return (
    <GlassPanel elevated className={styles.banner}>
      <button
        type="button"
        className={styles.demoToggle}
        onClick={() => setScenario((s) => (s === 'pass' ? 'override' : 'pass'))}
      >
        Demo: toggle scenario
      </button>

      <div className={styles.decisionRow}>
        <span className={`${styles.pulseDot} ${isPass ? styles.pulseDotGreen : styles.pulseDotAmber}`} />
        <h2 className={`${styles.decisionText} ${isPass ? styles.textGreen : styles.textAmber}`}>
          {isPass ? `EXECUTE: ${result.recommendedMode}` : `OVERRIDE → ${result.recommendedMode}`}
        </h2>
      </div>
      {!isPass && <div className={styles.overrideReason}>{result.overrideReason}</div>}

      <div className={styles.gateRow}>
        {Object.entries(result.gates).map(([key, passed]) => (
          <span key={key} className={passed ? styles.gatePillPass : styles.gatePillFail}>
            {passed ? <CheckIcon width={13} height={13} /> : <WarningIcon width={13} height={13} />}
            {GATE_LABELS[key]}
          </span>
        ))}
      </div>

      <div className={styles.statsLine}>
        <span>
          95% CI lower bound: <span className="num">+{result.ciLowerBoundS.toFixed(2)}s</span>{' '}
          (min <span className="num">{result.minActionableLaptimeDeltaS.toFixed(2)}s</span>)
        </span>
        <span className="num">
          t = {result.tStatistic.toFixed(2)}, df &asymp; {result.degreesOfFreedom.toLocaleString()}
        </span>
        <span>
          DCLI <span className="num">{result.dcliScore}/100</span>
        </span>
        <span>
          Rival &sigma; <span className="num">{result.rivalStdMj.toFixed(1)} MJ</span> (&le;{' '}
          <span className="num">{result.rivalThresholdMj.toFixed(1)} MJ</span>)
        </span>
      </div>
    </GlassPanel>
  )
}

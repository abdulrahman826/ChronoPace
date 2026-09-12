import { Fragment, useEffect } from 'react'
import GlassPanel from './GlassPanel'
import { CheckIcon, WarningIcon, FlaskIcon } from './Icons'
import { useDashboardData } from '../services/DashboardDataContext'
import styles from './ValidationLab.module.css'

// Every metric here is validation-only data (GET /api/v1/validation/summary)
// — a controlled hidden-state comparison against a synthetic ground truth,
// never mixed with the live-decision numbers shown on the main dashboard.
// Nothing on this page is computed here; every value is either a real
// backend field or (precision/recall) a plain arithmetic derivation from a
// real confusion matrix the backend already returned.

function GroundTruthTag({ available }) {
  return (
    <span className={available ? styles.gtAvailable : styles.gtUnavailable}>
      {available ? <CheckIcon width={10} height={10} /> : <WarningIcon width={10} height={10} />}
      GROUND TRUTH {available ? 'AVAILABLE (SYNTHETIC)' : 'UNAVAILABLE'}
    </span>
  )
}

function MetricTile({ label, value, unit }) {
  return (
    <div className={styles.metricTile}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={`num ${styles.metricValue}`}>{value}{unit ? <span className={styles.metricUnit}> {unit}</span> : null}</span>
    </div>
  )
}

// Derives per-class precision/recall from a real confusion matrix — a
// deterministic arithmetic reshape of numbers the backend already computed,
// not a new estimate. rows/cols are both predicted-vs-actual in the same
// class order as `classes`.
function precisionRecall(matrix, classIndex) {
  if (!Array.isArray(matrix) || !matrix[classIndex]) return null
  const n = matrix.length
  let tp = matrix[classIndex][classIndex] ?? 0
  let predictedTotal = 0
  let actualTotal = 0
  for (let i = 0; i < n; i++) {
    predictedTotal += matrix[i]?.[classIndex] ?? 0 // column sum = predicted as this class
    actualTotal += matrix[classIndex]?.[i] ?? 0 // row sum = actually this class
  }
  return {
    precision: predictedTotal > 0 ? tp / predictedTotal : null,
    recall: actualTotal > 0 ? tp / actualTotal : null,
  }
}

function RivalSocSection({ block }) {
  if (!block) return null
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h4>RIVAL ENERGY</h4>
        <GroundTruthTag available={block.ground_truth_available} />
      </div>
      <div className={styles.metricRow}>
        <MetricTile label="MAE" value={block.mae_mj?.toFixed(2) ?? '—'} unit="MJ" />
        <MetricTile label="RMSE" value={block.rmse_mj?.toFixed(2) ?? '—'} unit="MJ" />
        <MetricTile label="MEDIAN AE" value={block.median_ae_mj?.toFixed(2) ?? '—'} unit="MJ" />
        <MetricTile label="P90 AE" value={block.p90_ae_mj?.toFixed(2) ?? '—'} unit="MJ" />
        <MetricTile label="N" value={block.sample_count ?? '—'} />
      </div>
      <div className={styles.note}>{block.evaluation_note}</div>
      <div className={styles.honesty}>{block.honesty_notice}</div>
    </div>
  )
}

function RivalClassificationSection({ block }) {
  if (!block) return null
  const classes = Object.keys(block.per_class_f1 || {})
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h4>RIVAL STATE CLASSIFICATION</h4>
        <GroundTruthTag available={block.ground_truth_available} />
      </div>
      <div className={styles.metricRow}>
        <MetricTile label="ACCURACY" value={block.accuracy != null ? Math.round(block.accuracy * 100) : '—'} unit="%" />
        <MetricTile label="N" value={block.sample_count ?? '—'} />
      </div>
      <div className={styles.classTable}>
        <div className={styles.classHeaderRow}>
          <span>CLASS</span><span>F1</span><span>PRECISION</span><span>RECALL</span>
        </div>
        {classes.map((cls, i) => {
          const pr = precisionRecall(block.confusion_matrix, i)
          return (
            <div key={cls} className={styles.classRow}>
              <span>{cls}</span>
              <span className="num">{block.per_class_f1[cls] != null ? block.per_class_f1[cls].toFixed(2) : '—'}</span>
              <span className="num">{pr?.precision != null ? `${Math.round(pr.precision * 100)}%` : '—'}</span>
              <span className="num">{pr?.recall != null ? `${Math.round(pr.recall * 100)}%` : '—'}</span>
            </div>
          )
        })}
      </div>
      {Array.isArray(block.confusion_matrix) && (
        <div className={styles.confusionWrap}>
          <span className={styles.confusionLabel}>CONFUSION MATRIX (rows = actual, cols = predicted)</span>
          <div className={styles.confusionGrid} style={{ gridTemplateColumns: `auto repeat(${classes.length}, 1fr)` }}>
            <span />
            {classes.map((c) => <span key={c} className={styles.confusionHead}>{c}</span>)}
            {block.confusion_matrix.map((row, r) => (
              <Fragment key={r}>
                <span className={styles.confusionHead}>{classes[r]}</span>
                {row.map((v, c) => (
                  <span key={`${r}-${c}`} className={`num ${styles.confusionCell} ${r === c ? styles.confusionDiag : ''}`}>{v}</span>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      )}
      <div className={styles.note}>{block.evaluation_note}</div>
    </div>
  )
}

function NotImplementedSection({ title, block }) {
  if (!block) return null
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h4>{title}</h4>
        <span className={styles.notImplemented}>NOT YET IMPLEMENTED</span>
      </div>
      <div className={styles.note}>{block.note}</div>
    </div>
  )
}

export default function ValidationLab() {
  const { validation, loadValidation, closeValidationLab } = useDashboardData()
  const { data, loading, error } = validation

  useEffect(() => {
    if (!validation.loaded && !validation.loading) loadValidation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h2><FlaskIcon width={16} height={16} className={styles.titleIcon} /> CHRONOPACE VALIDATION LAB</h2>
          <div className={styles.pageSubtitle}>
            Controlled hidden-state evaluation — entirely separate from the live decision path
          </div>
        </div>
        <button type="button" className={styles.closeBtn} onClick={closeValidationLab}>
          ← BACK TO DASHBOARD
        </button>
      </div>

      {loading && <GlassPanel className={styles.statusPanel}>Loading validation summary…</GlassPanel>}
      {error && (
        <GlassPanel className={styles.statusPanel}>
          <span className={styles.errorText}>VALIDATION UNAVAILABLE — {error}</span>
        </GlassPanel>
      )}

      {data && (
        <>
          <GlassPanel className={styles.metaPanel}>
            <span className={styles.metaItem}>SCENARIO <span className="num">{data.scenario}</span></span>
            <span className={styles.metaItem}>SEED <span className="num">{data.seed}</span></span>
            <span className={styles.metaItem}>TOTAL LAPS <span className="num">{data.total_laps}</span></span>
            <span className={styles.metaItem}>GENERATED <span className="num">{data.generated_at}</span></span>
          </GlassPanel>

          <div className={styles.grid}>
            <GlassPanel><RivalSocSection block={data.rival_soc} /></GlassPanel>
            <GlassPanel><RivalClassificationSection block={data.rival_classification} /></GlassPanel>
            <GlassPanel><NotImplementedSection title="OVERTAKE CALIBRATION" block={data.overtake_calibration} /></GlassPanel>
            <GlassPanel><NotImplementedSection title="FINAL DECISION ACCURACY" block={data.decision_accuracy} /></GlassPanel>
          </div>
        </>
      )}
    </div>
  )
}

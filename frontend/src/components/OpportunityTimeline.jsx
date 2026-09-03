import GlassPanel from './GlassPanel'
import { TimelineIcon, BoltIcon } from './Icons'
import { telemetry, overtakeBonus, modeProjections, MODE_LABELS, confidenceGatePass } from '../data/mockTelemetry'
import styles from './OpportunityTimeline.module.css'

/** Right column, lower slot. Real Opportunity Horizon output (lap-by-lap
 * strategy windows) doesn't exist yet, so rather than an empty "coming
 * soon" box, this visualizes the one genuinely sequential mechanic the
 * app already computes: the overtake bonus is banked on the lap a car
 * qualifies (gap <= threshold) and can only be spent the following lap.
 * Every value below (lap numbers, gap, mode labels, projected deltas)
 * is a real field from mockTelemetry.js — no invented track position,
 * sector, or turn data. */
export default function OpportunityTimeline() {
  const { lap } = telemetry
  const top = modeProjections[0]
  const runnerUp = modeProjections[1]
  const usingBonus = confidenceGatePass.recommendedMode === 'USE_OVERTAKE_BONUS_MODE'

  const nodes = [
    {
      lap: overtakeBonus.bankedFromLap,
      tag: 'QUALIFIED',
      title: 'Bonus banked',
      detail: `Gap ${overtakeBonus.gapS.toFixed(2)}s ≤ ${overtakeBonus.thresholdS.toFixed(1)}s threshold`,
    },
    {
      lap,
      tag: 'NOW',
      current: true,
      title: MODE_LABELS[confidenceGatePass.recommendedMode],
      detail: `${top.laptimeDeltaS > 0 ? '+' : ''}${top.laptimeDeltaS.toFixed(2)}s vs. baseline`,
    },
    {
      lap: lap + 1,
      tag: usingBonus ? 'WINDOW CLOSES' : 'NEXT BEST',
      title: usingBonus ? 'Bonus expires unless spent' : MODE_LABELS[runnerUp.mode],
      detail: usingBonus
        ? 'Use-it-or-lose-it — not banked past this lap'
        : `${runnerUp.laptimeDeltaS > 0 ? '+' : ''}${runnerUp.laptimeDeltaS.toFixed(2)}s vs. baseline`,
    },
  ]

  return (
    <GlassPanel className={styles.wrap}>
      <div className="panelHeaderRow">
        <TimelineIcon width={18} height={18} />
        <h3>OPPORTUNITY TIMELINE</h3>
      </div>
      <div className={styles.subtitle}>OVERTAKE BONUS WINDOW</div>

      <div className={styles.track}>
        <div className={styles.axisLine} />
        {nodes.map((n, i) => (
          <div key={i} className={styles.node}>
            <span className={`${styles.dot} ${n.current ? styles.dotCurrent : ''}`}>
              {n.current && <BoltIcon width={10} height={10} />}
            </span>
            <span className={styles.lapLabel}>LAP {n.lap}</span>
            <span className={`${styles.tag} ${n.current ? styles.tagCurrent : ''}`}>{n.tag}</span>
            <span className={styles.nodeTitle}>{n.title}</span>
            <span className={styles.nodeDetail}>{n.detail}</span>
          </div>
        ))}
      </div>
    </GlassPanel>
  )
}

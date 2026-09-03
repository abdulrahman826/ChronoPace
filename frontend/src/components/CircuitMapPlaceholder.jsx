import GlassPanel from './GlassPanel'
import { MapIcon } from './Icons'
import styles from './CircuitMapPlaceholder.module.css'

/** Right column. Honest placeholder — no track outline, no position
 * markers, no legend. Those all imply real circuit/position data that
 * doesn't exist yet. Sized/positioned so the real Circuit Map (a later,
 * separate pass) can drop in here without restructuring the page. */
export default function CircuitMapPlaceholder() {
  return (
    <GlassPanel className={styles.wrap}>
      <div className="panelHeaderRow">
        <MapIcon width={18} height={18} />
        <h3>CIRCUIT MAP</h3>
      </div>
      <div className={styles.subtitle}>TRACK OVERVIEW</div>

      <div className={styles.empty}>
        <div className={styles.scanline} aria-hidden="true" />
        <MapIcon width={28} height={28} />
        <span>Circuit Map not yet implemented</span>
      </div>
    </GlassPanel>
  )
}

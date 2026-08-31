import styles from './GlassPanel.module.css'

/** Shared card shell — a quiet background shift and a hairline border,
 * matching the current restrained token system (no blur/glow). */
export default function GlassPanel({ children, className = '', elevated = false, style }) {
  const cls = [styles.panel, elevated ? styles.elevated : '', className].filter(Boolean).join(' ')
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  )
}

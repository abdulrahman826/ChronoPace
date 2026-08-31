/**
 * Small bell-curve sparkline standing in for a mode's simulated laptime-delta
 * distribution. Purely a visual shape cue (wider std -> flatter curve) — not
 * a literal plot of the 10,000-sample array, which the real UI would fetch
 * from PlannerResult once Stage 2 exists.
 */
export default function DistributionSparkline({ std, color, width = 72, height = 28 }) {
  const sigma = Math.max(0.12, Math.min(0.45, std * 2.2))
  const points = []
  const steps = 24
  for (let i = 0; i <= steps; i++) {
    const x = i / steps
    const y = Math.exp(-((x - 0.5) ** 2) / (2 * sigma * sigma))
    points.push([x * width, height - y * (height - 4) - 2])
  }
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const areaPath = `${path} L${width},${height} L0,${height} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={areaPath} fill={color} opacity="0.15" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

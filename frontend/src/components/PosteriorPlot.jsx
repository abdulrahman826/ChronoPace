/**
 * Density-curve visualization of the rival SoC posterior (mean +/- std over a
 * fixed 0..socMax axis). Deliberately drawn as a spread, not a point marker —
 * see context.md §6 on why this must never read as a single asserted value.
 */
export default function PosteriorPlot({ mean, std, socMax, width = 260, height = 84 }) {
  const toX = (mj) => (mj / socMax) * width
  const sigmaPx = (std / socMax) * width

  const steps = 60
  const points = []
  for (let i = 0; i <= steps; i++) {
    const mj = (i / steps) * socMax
    const x = toX(mj)
    const y = Math.exp(-((x - toX(mean)) ** 2) / (2 * sigmaPx * sigmaPx))
    points.push([x, height - 14 - y * (height - 26)])
  }
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${width},${height - 14} L0,${height - 14} Z`

  const bandX0 = toX(Math.max(0, mean - std))
  const bandX1 = toX(Math.min(socMax, mean + std))

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Rival SoC posterior distribution">
      <line x1="0" y1={height - 14} x2={width} y2={height - 14} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <rect x={bandX0} y="4" width={bandX1 - bandX0} height={height - 18} fill="var(--color-accent)" opacity="0.08" />
      <path d={areaPath} fill="var(--color-accent)" opacity="0.15" />
      <path d={linePath} fill="none" stroke="var(--color-accent)" strokeWidth="1.8" />
      <line x1={toX(mean)} y1="4" x2={toX(mean)} y2={height - 14} stroke="var(--color-accent)" strokeWidth="1.2" strokeDasharray="3 3" />
      <text x="0" y={height} fontSize="9.5" fill="var(--color-text-muted)" fontFamily="var(--font-mono)">0 MJ</text>
      <text x={width} y={height} fontSize="9.5" fill="var(--color-text-muted)" fontFamily="var(--font-mono)" textAnchor="end">
        {socMax.toFixed(1)} MJ
      </text>
    </svg>
  )
}

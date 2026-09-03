// Inline stroke-based SVG icons, 20px grid, single consistent style.
// No emoji/dingbats anywhere in this app.

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function ShieldIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

export function RadarIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <path d="M12 3v3M21 12h-3M12 21v-3M3 12h3" />
    </svg>
  )
}

export function CheckIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  )
}

export function WarningIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function GaugeIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 15a8 8 0 1 1 16 0" />
      <path d="M12 15l4-5" />
      <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function BoltIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  )
}

export function ClockIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}

export function MapIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" />
      <path d="M9 4v13M15 6.5v13" />
    </svg>
  )
}

export function TimelineIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 17l4-6 4 3 4-8 6 9" />
      <circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function PipelineIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="5" cy="6" r="2.2" />
      <circle cx="19" cy="12" r="2.2" />
      <circle cx="5" cy="18" r="2.2" />
      <path d="M7.2 6h4.8a3 3 0 0 1 3 3v0" />
      <path d="M7.2 18h4.8a3 3 0 0 0 3-3v0" />
    </svg>
  )
}

export function FlagIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 3v18" />
      <path d="M5 4h13l-3 4 3 4H5" />
    </svg>
  )
}

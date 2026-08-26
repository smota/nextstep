const PRIORITY_TONES = {
  very_high: ['danger', '!!'],
  high: ['danger', '!'],
  medium: ['warning', '▲'],
  low: ['neutral', '•'],
}

export default function PriorityBadge({ priority }) {
  if (!priority) return <span className="badge badge--neutral"><span aria-hidden="true">—</span> Not set</span>
  const [tone, icon] = PRIORITY_TONES[priority] || ['neutral', '•']
  const labels={very_high:'Very high',high:'High',medium:'Medium',low:'Low'}
  return <span className={`badge badge--${tone}`}><span aria-hidden="true">{icon}</span>{labels[priority]||priority}</span>
}

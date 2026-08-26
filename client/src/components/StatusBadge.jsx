const STATUS_TONES = {
  identified: ['neutral', '○'],
  to_apply: ['info', '→'],
  applied: ['info', '✓'],
  recruiter_screen: ['info', '◉'],
  interview: ['warning', '◆'],
  offer: ['success', '✓'],
  rejected: ['danger', '×'],
  withdrawn: ['neutral', '—'],
  archived: ['neutral', '□'],
}

export default function StatusBadge({ status }) {
  const [tone, icon] = STATUS_TONES[status] || ['neutral', '?']
  return <span className={`badge badge--${tone}`}><span aria-hidden="true">{icon}</span>{(status || 'unknown').replace(/_/g, ' ')}</span>
}

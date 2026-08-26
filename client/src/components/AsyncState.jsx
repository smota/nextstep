export function LoadingState({ label = 'Loading your career workspace…' }) {
  return <div className="state-card" role="status"><span className="spinner" aria-hidden="true" /><p>{label}</p></div>
}

export function EmptyState({ title = 'Nothing here yet', message, action }) {
  return <div className="state-card"><span className="state-symbol" aria-hidden="true">✦</span><h2>{title}</h2>{message && <p>{message}</p>}{action}</div>
}

export function ErrorState({ title = 'Something went off course', message, onRetry }) {
  return <div className="state-card state-card--error" role="alert"><span className="state-symbol" aria-hidden="true">!</span><h2>{title}</h2><p>{message}</p>{onRetry && <button className="button button--primary" onClick={onRetry}>Try again</button>}</div>
}

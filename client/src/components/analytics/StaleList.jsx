import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'

export default function StaleList() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getStale().then(setData).catch((e) => setError(e.message))
  }, [])

  if (error)
    return (
      <div className="card">
        <h3>Stale Applications</h3>
        <p className="error">{error}</p>
      </div>
    )
  if (!data)
    return (
      <div className="card">
        <h3>Stale Applications</h3>
        <p>Loading…</p>
      </div>
    )

  return (
    <div className="card">
      <h3>Stale Applications (no update in {data.thresholdDays}+ days)</h3>
      {data.applications.length === 0 ? (
        <p>Nothing stale — everything active has moved recently.</p>
      ) : (
        <ul className="stat-list">
          {data.applications.map((app) => (
            <li key={app.slug}>
              {app.company || app.slug} — {app.role || 'unknown role'} (
              {app.daysSinceUpdate === null ? 'no update date' : `${app.daysSinceUpdate} days`})
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

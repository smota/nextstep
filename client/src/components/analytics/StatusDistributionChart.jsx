import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'

export default function StatusDistributionChart() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getStatusDistribution().then(setData).catch((e) => setError(e.message))
  }, [])

  if (error)
    return (
      <div className="card">
        <h3>Status Distribution</h3>
        <p className="error">{error}</p>
      </div>
    )
  if (!data)
    return (
      <div className="card">
        <h3>Status Distribution</h3>
        <p>Loading…</p>
      </div>
    )

  const entries = Object.entries(data.counts)
  const max = Math.max(...entries.map(([, c]) => c), 1)

  return (
    <div className="card">
      <h3>Status Distribution ({data.total} active)</h3>
      <div className="bar-chart">
        {entries.map(([status, count]) => (
          <div className="bar-row" key={status}>
            <span className="bar-label">{status}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className="bar-count">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

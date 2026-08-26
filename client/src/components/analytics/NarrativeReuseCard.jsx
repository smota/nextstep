import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'

export default function NarrativeReuseCard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getTagReuse().then(setData).catch((e) => setError(e.message))
  }, [])

  if (error)
    return (
      <div className="card">
        <h3>Narrative / Theme Reuse</h3>
        <p className="error">{error}</p>
      </div>
    )
  if (!data)
    return (
      <div className="card">
        <h3>Narrative / Theme Reuse</h3>
        <p>Loading…</p>
      </div>
    )

  return (
    <div className="card">
      <h3>
        Narrative / Theme Reuse <span className="badge badge--muted">heuristic, tag-based</span>
      </h3>
      <p className="hint">
        No structured field records the chosen dominant narrative per application — this infers
        overlap from shared tags only, not an authoritative join.
      </p>
      {data.reused.length === 0 ? (
        <p>No shared tags across active applications yet.</p>
      ) : (
        <ul className="stat-list">
          {data.reused.map(({ tag, applications }) => (
            <li key={tag}>
              {tag}: {applications.join(', ')}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

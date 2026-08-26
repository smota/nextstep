import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'

export default function RiskRollupCard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getRiskRollup().then(setData).catch((e) => setError(e.message))
  }, [])

  if (error)
    return (
      <div className="card">
        <h3>Risk Roll-up</h3>
        <p className="error">{error}</p>
      </div>
    )
  if (!data)
    return (
      <div className="card">
        <h3>Risk Roll-up</h3>
        <p>Loading…</p>
      </div>
    )

  return (
    <div className="card">
      <h3>Risk Roll-up ({data.totalActive} active, open)</h3>
      <ul className="stat-list">
        <li>
          {data.languageRiskCount} of {data.totalActive} have a language risk flagged
        </li>
        <li>
          {data.compensationRiskCount} of {data.totalActive} have a compensation risk flagged
        </li>
        <li>
          {data.mainRiskFlaggedCount} of {data.totalActive} have a main risk noted in body text
        </li>
      </ul>
      {data.countries.length > 0 && (
        <>
          <h4>By Country</h4>
          <ul className="stat-list">
            {data.countries.map(({ country, count }) => (
              <li key={country}>
                {country}: {count}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

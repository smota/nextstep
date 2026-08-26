import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import CompanyDetail from './CompanyDetail.jsx'

export default function CompanyList() {
  const [companies, setCompanies] = useState([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getCompanies().then(setCompanies).catch((e) => setError(e.message))
  }, [])

  if (error) return <p className="error">{error}</p>

  const filtered = companies.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="browser-column">
      <h3>Companies ({companies.length})</h3>
      <input
        className="search-input"
        placeholder="Search companies…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="browser-list">
        {filtered.map((c) => (
          <li key={c.slug}>
            <button className="browser-list-item" onClick={() => setSelected(c)}>
              {c.name}
              {c.referencedByApplications.length > 0 && (
                <span className="ref-count"> · {c.referencedByApplications.length} application(s)</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {selected && <CompanyDetail company={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

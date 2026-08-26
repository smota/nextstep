import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import PersonDetail from './PersonDetail.jsx'

export default function PeopleList() {
  const [people, setPeople] = useState([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getPeople().then(setPeople).catch((e) => setError(e.message))
  }, [])

  if (error) return <p className="error">{error}</p>

  const filtered = people.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="browser-column">
      <h3>People ({people.length})</h3>
      <input
        className="search-input"
        placeholder="Search people…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="browser-list">
        {filtered.map((p) => (
          <li key={p.slug}>
            <button className="browser-list-item" onClick={() => setSelected(p)}>
              {p.name}
              {p.company ? ` — ${p.company}` : ''}
              {p.referencedByApplications.length > 0 && (
                <span className="ref-count"> · {p.referencedByApplications.length} application(s)</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {selected && <PersonDetail person={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

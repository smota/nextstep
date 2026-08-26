import { Link } from 'react-router-dom'

export default function PersonDetail({ person, onClose }) {
  return (
    <div className="detail-panel">
      <div className="detail-panel-header">
        <h4>{person.name}</h4>
        <button onClick={onClose}>✕</button>
      </div>
      <p>
        <strong>Role:</strong> {person.role || '—'}
        {person.company ? ` at ${person.company}` : ''}
      </p>
      <p>
        <strong>Referenced by:</strong>{' '}
        {person.referencedByApplications.length > 0
          ? person.referencedByApplications.map((ref,index)=><span key={`${ref.slug}-${ref.scope}`}>{index>0?', ':''}{ref.href?<Link to={ref.href}>{ref.label}</Link>:ref.label}{ref.scope==='archive'?' (archived)':''}</span>)
          : 'no active/archived application currently links here'}
      </p>
      <h5>Likely Priorities</h5>
      <p>{person.likelyPriorities || 'No data available.'}</p>
      <h5>Communication Angle</h5>
      <p>{person.communicationAngle || 'No data available.'}</p>
    </div>
  )
}

import { Link, useLocation } from 'react-router-dom'

export default function CompanyDetail({ company, onClose }) {
  const location=useLocation(),from=`${location.pathname}${location.search}`
  const opportunityHref=href=>{if(!href)return href;const [pathname,query='']=href.split('?'),params=new URLSearchParams(query);params.set('from',from);return `${pathname}?${params}`}
  return (
    <div className="detail-panel">
      <div className="detail-panel-header">
        <h4>{company.name}</h4>
        <button onClick={onClose}>✕</button>
      </div>
      {!company.hasFrontmatter && (
        <p className="hint">
          No structured frontmatter on this profile — name/sections are best-effort extracted.
        </p>
      )}
      <p>
        <strong>Referenced by:</strong>{' '}
        {company.referencedByApplications.length > 0
          ? company.referencedByApplications.map((ref,index)=><span key={`${ref.slug}-${ref.scope}`}>{index>0?', ':''}{ref.href?<Link to={opportunityHref(ref.href)}>{ref.label}</Link>:ref.label}{ref.scope==='archive'?' (archived)':''}</span>)
          : 'no active/archived application currently links here'}
      </p>
      <h5>Risks / Red Flags</h5>
      <p>{company.risksRedFlags || 'No data available.'}</p>
      <h5>Talking Points</h5>
      <p>{company.talkingPoints || 'No data available.'}</p>
    </div>
  )
}

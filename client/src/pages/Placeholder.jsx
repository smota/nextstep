import { Link } from 'react-router-dom'

export default function Placeholder({ eyebrow, title, description, next }) {
  return <div className="page-stack"><header className="page-header"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></header><section className="empty-feature"><span aria-hidden="true">✦</span><h2>This space is taking shape</h2><p>Your existing career information is safe. This destination is ready for its next connected workflow.</p>{next && <Link className="button button--primary" to={next.to}>{next.label}</Link>}</section></div>
}

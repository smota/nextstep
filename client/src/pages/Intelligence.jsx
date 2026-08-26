import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState.jsx'
import CountryMap from './CountryMap.jsx'

const sections = ['overview','funnel','geography','risks','narratives','quality']
function Apps({ title, apps }) {
  if (!apps) return null
  return <aside className="insights-drill" aria-live="polite"><h3>{title}</h3>{apps.length ? <ul>{apps.map((a) => <li key={`${a.slug}-${a.href}`}><Link to={a.href}>{a.company || a.slug} — {a.role || 'Role not recorded'}</Link><span>{a.status}</span></li>)}</ul> : <p className="muted">No matching opportunities.</p>}</aside>
}
function BarTable({ rows, labelKey, onPick, extras }) {
  const max = Math.max(1,...rows.map((r) => r.count))
  return <><div className="insight-bars" aria-label={`${labelKey} chart`}>{rows.map((r) => <button className="chart-row" key={r[labelKey]} onClick={() => onPick(r[labelKey],r.applications)} aria-label={`${r[labelKey]}: ${r.count}. Show matching opportunities`}><span>{r[labelKey]}</span><i aria-hidden="true" style={{width:`${r.count/max*100}%`}} /> <b>{r.count}</b></button>)}</div><div className="semantic-table"><table><thead><tr><th>{labelKey}</th><th>Count</th>{extras}</tr></thead><tbody>{rows.map((r) => <tr key={r[labelKey]}><th><button className="table-filter" onClick={() => onPick(r[labelKey],r.applications)}>{r[labelKey]}</button></th><td>{r.count}</td>{extras && <><td>{r.active}</td><td>{r.closed}</td><td>{r.languageRisk}</td></>}</tr>)}</tbody></table></div></>
}
export default function Intelligence() {
  const [scope,setScope]=useState('active'), [data,setData]=useState(null), [error,setError]=useState(''), [retry,setRetry]=useState(0), [pick,setPick]=useState(null)
  useEffect(()=>{ let live=true; setData(null); setError(''); setPick(null); api.getInsights(scope).then((x)=>live&&setData(x)).catch((e)=>live&&setError(e.message)); return()=>{live=false} },[scope,retry])
  const choose=(label,apps)=>setPick({label,apps})
  const allApps=useMemo(()=>data?.funnel.stages.flatMap((x)=>x.applications)||[],[data])
  return <div className="page-stack insights-page"><header className="page-header"><p className="eyebrow">Decision analytics</p><h1>Insights</h1><p>Move from pipeline signals to the opportunities that need attention.</p></header>
    <div className="insights-controls"><nav aria-label="Insights sections">{sections.map((s)=><a key={s} href={`#${s}`}>{s}</a>)}</nav><label>Opportunity set<select value={scope} onChange={(e)=>setScope(e.target.value)}><option value="active">Active</option><option value="all">All</option><option value="archive">Archive</option></select></label></div>
    {error ? <ErrorState message={error} onRetry={()=>setRetry((x)=>x+1)} /> : !data ? <LoadingState label="Building analytics…" /> : data.overview.total===0 ? <EmptyState title="No opportunities in this view" message="Choose another opportunity set to continue." /> : <>
      <section id="overview" className="insight-section"><div><p className="eyebrow">Overview</p><h2>Portfolio at a glance</h2></div><div className="metric-grid"><article><strong>{data.overview.total}</strong><span>Total</span></article><article><strong>{data.overview.active}</strong><span>Active</span></article><article><strong>{data.overview.ready}</strong><span>Ready</span></article><article><strong>{data.overview.needsAttention}</strong><span>Needs preparation</span></article></div><button className="button" onClick={()=>choose('All in this view',allApps)}>Review opportunities</button></section>
      <section id="funnel" className="insight-section"><div><p className="eyebrow">Funnel</p><h2>Lifecycle distribution</h2><p className="muted">Lifecycle stage and preparation are separate projections.</p></div><BarTable rows={data.funnel.stages} labelKey="status" onPick={choose}/><div className="support-cards"><article><strong>{data.overview.ready}</strong> ready for next step</article><article><strong>{data.overview.needsAttention}</strong> need preparation</article></div></section>
      <section id="geography" className="insight-section"><div><p className="eyebrow">Geography</p><h2>Country concentration</h2><p className="muted">Select a map marker to review opportunities. Language-risk detail remains in the table.</p></div>{data.geography.countries.length?<><CountryMap rows={data.geography.countries} onPick={choose} selected={pick?.label}/><BarTable rows={data.geography.countries} labelKey="country" onPick={choose} extras={<><th>Active</th><th>Closed</th><th>Language risk</th></>}/></>:<p className="muted">No country data recorded.</p>}</section>
      <section id="risks" className="insight-section"><div><p className="eyebrow">Risks</p><h2>Recorded risk categories</h2></div><BarTable rows={data.risks.categories} labelKey="label" onPick={choose}/></section>
      <section id="narratives" className="insight-section"><div><p className="eyebrow">Narratives · heuristic</p><h2>Tag reuse signals</h2><p className="muted">{data.narratives.limitation}</p></div>{data.narratives.tags.length?<BarTable rows={data.narratives.tags.slice(0,12)} labelKey="tag" onPick={choose}/>:<p className="muted">No reusable tags in this view.</p>}</section>
      <section id="quality" className="insight-section"><div><p className="eyebrow">Data quality</p><h2>Staleness and gaps</h2></div><div className="support-cards"><article><strong>{data.quality.stale.length}</strong> stale over {data.quality.staleThresholdDays} days <button className="button button--secondary" onClick={()=>choose('Stale opportunities',data.quality.stale)}>Review</button></article><article><strong>{data.quality.unknownLifecycle.length}</strong> unknown lifecycle <button className="button button--secondary" onClick={()=>choose('Unknown lifecycle',data.quality.unknownLifecycle)}>Review</button></article></div><table><thead><tr><th>Opportunity</th><th>Days since update</th></tr></thead><tbody>{data.quality.stale.map((a)=><tr key={a.slug}><th><Link to={a.href}>{a.company||a.slug}</Link></th><td>{a.daysSinceUpdate??'Unknown'}</td></tr>)}</tbody></table></section>
      <Apps title={pick?.label} apps={pick?.apps}/>
    </>}
  </div>
}

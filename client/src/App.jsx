import { useCallback, useEffect, useRef, useState } from 'react'
import { Routes, Route, NavLink, Link, useNavigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import Intelligence from './pages/Intelligence.jsx'
import Today from './pages/Today.jsx'
import Placeholder from './pages/Placeholder.jsx'
import ApplicationDetail from './pages/ApplicationDetail.jsx'
import Network from './pages/Network.jsx'
import Settings from './pages/Settings.jsx'
import Actions from './pages/Actions.jsx'
import Create from './pages/Create.jsx'
import PrintableDocument from './pages/PrintableDocument.jsx'
import Profile from './pages/Profile.jsx'
import Companies from './pages/Companies.jsx'
import Logo from './components/Logo.jsx'

const nav = [
  ['/', 'Today', '✦'], ['/opportunities', 'Opportunities', '◫'], ['/companies', 'Companies', '▦'], ['/network', 'Network', '◎'],
  ['/insights', 'Insights', '↗'], ['/profile', 'Profile', '◇'], ['/create', 'Create', '＋'], ['/settings', 'Settings', '⚙'],
]

function Command({ open, onClose, restoreFocusRef }) {
  const navigate = useNavigate()
  const input = useRef(null), panel = useRef(null)
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (!open) return
    setQuery(''); setTimeout(() => input.current?.focus(), 0)
    const key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key !== 'Tab') return
      const focusable = [...panel.current.querySelectorAll('input,button,[href],[tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled)
      if (!focusable.length) return
      const first=focusable[0],last=focusable.at(-1)
      if (e.shiftKey && document.activeElement===first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement===last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); restoreFocusRef.current?.focus() }
  }, [open, onClose, restoreFocusRef])
  if (!open) return null
  const matches = nav.filter(([, label]) => label.toLowerCase().includes(query.toLowerCase()))
  const go = (path) => { navigate(path); onClose() }
  return <div className="command-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section ref={panel} className="command-panel" role="dialog" aria-modal="true" aria-label="Search Nextstep">
      <label className="command-input"><span aria-hidden="true">⌕</span><input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Where do you want to go?" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && matches[0]) go(matches[0][0]) }} /></label>
      <div className="command-results"><p className="eyebrow">Destinations</p>{matches.map(([path, label, icon]) => <button key={path} onClick={() => go(path)}><span>{icon}</span>{label}<kbd>↵</kbd></button>)}</div>
    </section>
  </div>
}

export default function App() {
  const [commandOpen, setCommandOpen] = useState(false)
  const commandTrigger = useRef(null)
  const closeCommand = useCallback(() => setCommandOpen(false), [])
  useEffect(() => { const key = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCommandOpen(true) } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key) }, [])
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar"><Link to="/" className="logo-link"><Logo /></Link><nav aria-label="Primary navigation">{nav.map(([path, label, icon]) => <NavLink key={path} to={path} end={path === '/'} className={({isActive}) => `nav-link${isActive ? ' nav-link--active' : ''}`}><span aria-hidden="true">{icon}</span>{label}</NavLink>)}</nav><div className="sidebar-meta"><div className="sidebar-user"><span className="avatar">SM</span><span><strong>Samuel Mota</strong><small>Career workspace</small></span></div><a className="affiliation affiliation--sidebar" href="https://www.movetheneedle.info" target="_blank" rel="noreferrer"><span>Sponsored by Move the Needle</span><img src="/brand/move-the-needle-logo-white.png" alt="Move the Needle" /></a></div></aside>
    <div className="content-shell"><header className="topbar"><div className="mobile-brand"><Logo /></div><button ref={commandTrigger} className="command-trigger" onClick={() => setCommandOpen(true)}><span aria-hidden="true">⌕</span><span>Search or jump to…</span><kbd>⌘ K</kbd></button><div className="topbar-actions"><Link className="icon-button" aria-label="Activity" title="Open recent activity" to="/actions">○</Link><span className="avatar">SM</span></div></header><main id="main-content" className="app-main"><Routes>
      <Route path="/" element={<Today />} /><Route path="/opportunities" element={<Dashboard />} />
      <Route path="/opportunities/:slug" element={<ApplicationDetail />} /><Route path="/companies" element={<Companies />} /><Route path="/companies/:slug" element={<Companies />} /><Route path="/opportunities/:slug/documents/:artifact/print" element={<PrintableDocument />} /><Route path="/network" element={<Network />} /><Route path="/insights" element={<Intelligence initialTab="analytics" />} />
      <Route path="/intelligence" element={<Intelligence />} /><Route path="/dashboard" element={<Dashboard />} />
      <Route path="/actions" element={<Actions />} />
      <Route path="/create" element={<Create />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/settings" element={<Settings />} />
    </Routes></main><footer className="product-footer"><span>Nextstep</span><a className="affiliation affiliation--footer" href="https://www.movetheneedle.info" target="_blank" rel="noreferrer"><span>Sponsored by Move the Needle</span><img className="affiliation-logo affiliation-logo--light" src="/brand/move-the-needle-logo.png" alt="Move the Needle" /><img className="affiliation-logo affiliation-logo--dark" src="/brand/move-the-needle-logo-white.png" alt="" aria-hidden="true" /></a></footer></div>
    <nav className="bottom-nav" aria-label="Mobile navigation">{nav.filter(([path])=>['/','/opportunities','/companies','/network','/create'].includes(path)).map(([path,label,icon]) => <NavLink key={path} to={path} end={path === '/'} className={({isActive}) => isActive ? 'active' : ''}><span aria-hidden="true">{icon}</span><small>{label}</small></NavLink>)}</nav><Command open={commandOpen} onClose={closeCommand} restoreFocusRef={commandTrigger} />
  </div>
}

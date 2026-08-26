const BASE = '/api'

async function request(path, options) {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const error = new Error(body.error || `Request failed: ${res.status}`)
    error.status = res.status; error.code = body.code; error.fields = body.fields; error.details = body.details; error.remediation = body.remediation
    throw error
  }
  return res.json()
}

export const api = {
  getApplications: () => request('/applications'),
  getOverview: () => request('/vault/overview'),
  getVaultHealth: () => request('/vault/health'),
  getDocument: (scope, slug, artifact, version) => request(`/vault/documents/${encodeURIComponent(scope)}/${encodeURIComponent(slug)}/${encodeURIComponent(artifact)}${version ? `?version=${encodeURIComponent(version)}` : ''}`),
  getDocumentVersions: (scope, slug, artifact) => request(`/vault/documents/${encodeURIComponent(scope)}/${encodeURIComponent(slug)}/${encodeURIComponent(artifact)}/versions`),
  saveDocument: (scope, slug, artifact, content, revision, mode, version) => request(`/vault/documents/${encodeURIComponent(scope)}/${encodeURIComponent(slug)}/${encodeURIComponent(artifact)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, revision, mode, version }) }),
  commandApplication: (slug, scope, command) => request(`/applications/${encodeURIComponent(slug)}/commands?scope=${encodeURIComponent(scope)}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(command) }),
  getApplication: (slug, scope) => request(`/applications/${encodeURIComponent(slug)}${scope ? `?scope=${encodeURIComponent(scope)}` : ''}`),
  getCompanies: () => request('/companies'),
  getCompany: (slug) => request(`/companies/${slug}`),
  getPeople: () => request('/people'),
  getNetworkGraph: (scope = 'active') => request(`/network/graph?scope=${encodeURIComponent(scope)}`),
  getPerson: (slug) => request(`/people/${slug}`),
  getSkills: () => request('/skills'),
  getCoordination: () => request('/coordination'),
  getStale: (days) => request(`/analytics/stale${days ? `?days=${days}` : ''}`),
  getStatusDistribution: () => request('/analytics/status-distribution'),
  getRiskRollup: () => request('/analytics/risk-rollup'),
  getTagReuse: () => request('/analytics/tag-reuse'),
  getInsights: (scope = 'active') => request(`/analytics/insights?scope=${encodeURIComponent(scope)}`),
  refreshVault: () => request('/vault/refresh', { method: 'POST' }),
  getActionCapabilities: () => request('/actions/capabilities'),
  createIntake: (payload) => request('/create/intakes', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) }),
  getIntake: (id) => request(`/create/intakes/${encodeURIComponent(id)}`),
  validateCreate: (payload) => request('/create/validate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) }),
  startCreate: (payload) => request('/create/runs', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) }),
  getRun: (id) => request(`/actions/runs/${encodeURIComponent(id)}`),
  getRecentRuns: () => request('/actions/runs'),
  getApplicationRuns: (slug) => request(`/actions/applications/${encodeURIComponent(slug)}/runs`),
  applyRun: (id,payload) => request(`/actions/runs/${encodeURIComponent(id)}/apply`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),
  retryRun: (id) => request(`/actions/runs/${encodeURIComponent(id)}/retry`,{method:'POST'}),
  discardRun: (id) => request(`/actions/runs/${encodeURIComponent(id)}/discard`,{method:'POST'}),
  getHarnesses: () => request('/runtime/harnesses'),
  getRuntimeSettings: () => request('/settings/runtime'),
  getProfileHealth: () => request('/profile/health'),
  getProfileContext: () => request('/profile/context'),
  searchProfile: (query) => request(`/profile/search?q=${encodeURIComponent(query)}`),
  getProposals: () => request('/profile/proposals'),
  getProposal: (id) => request(`/profile/proposals/${encodeURIComponent(id)}`),
  createProposal: (claim) => request('/profile/proposals', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({claim}) }),
  reviewProposal: (id, action, confirmation) => request(`/profile/proposals/${encodeURIComponent(id)}/${encodeURIComponent(action)}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({confirmation}) }),
  saveRuntimeSettings: (selectedHarness) => request('/settings/runtime', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({selectedHarness}) }),
  startAction: (actionId, slug, harnessId) => request('/actions/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionId, slug, harnessId }) }),
  cancelAction: (id) => request(`/actions/runs/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  transitionApplication: (slug, target, options = {}) => request(`/actions/applications/${encodeURIComponent(slug)}/transition`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target, ...options }) }),
  updateApplicationStatus: (slug, status) => request(`/actions/applications/${encodeURIComponent(slug)}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }),
}

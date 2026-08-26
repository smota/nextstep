import { LIFECYCLE_STATUSES, TERMINAL_STATUSES } from './lifecycle.js'

const DAY = 86400000
const RISK_LABELS = { language: 'Language', compensation: 'Compensation', main: 'Other stated risk' }

function archived(app) { return Boolean(app.archived) || app.lifecycle?.logicallyArchived || app.status === 'archived' }
function closed(app) { return archived(app) || TERMINAL_STATUSES.has(app.status) }
export function filterAnalyticsApplications(applications, scope = 'active') {
  if (scope === 'archive') return applications.filter(archived)
  if (scope === 'all') return [...applications]
  return applications.filter((app) => !closed(app))
}
function link(app) { const scope=archived(app)?'archive':'active';return { slug: app.slug, scope, company: app.company, role: app.role, status: app.status || 'unknown', archived: archived(app), href: `/opportunities/${encodeURIComponent(app.slug)}?scope=${scope}` } }
function group(apps, keyFn) {
  const map = new Map()
  for (const app of apps) { const key = keyFn(app); if (!map.has(key)) map.set(key, []); map.get(key).push(app) }
  return map
}
function rows(map, labelKey) { return [...map].map(([label, apps]) => ({ [labelKey]: label, count: apps.length, applications: apps.map(link) })).sort((a,b) => b.count-a.count || String(a[labelKey]).localeCompare(String(b[labelKey]))) }

export function buildAnalytics(applications, { scope = 'active', now = Date.now(), staleDays = 30 } = {}) {
  const selected = filterAnalyticsApplications(applications, scope)
  const lifecycle = LIFECYCLE_STATUSES.map((status) => ({ status, count: selected.filter((a) => a.status === status).length, applications: selected.filter((a) => a.status === status).map(link) })).filter((x) => x.count)
  const countries = rows(group(selected.filter((a) => a.country), (a) => a.country), 'country').map((row) => {
    const originals = selected.filter((a) => a.country === row.country)
    return { ...row, active: originals.filter((a) => !closed(a)).length, closed: originals.filter(closed).length, languageRisk: originals.filter((a) => Boolean(a.languageRisk)).length }
  })
  const risks = [
    ['language', (a) => a.languageRisk], ['compensation', (a) => a.compensationRisk], ['main', (a) => a.mainRiskFromBody],
  ].map(([category, test]) => ({ category, label: RISK_LABELS[category], applications: selected.filter(test).map(link) })).map((x) => ({ ...x, count: x.applications.length }))
  const tags = rows(group(selected.flatMap((app) => (app.tags || []).filter((t) => t !== 'application').map((tag) => ({ ...app, _tag: tag }))), (a) => a._tag), 'tag')
  const stale = selected.map((a) => ({ app: a, days: a.updated && !Number.isNaN(new Date(a.updated).getTime()) ? Math.floor((now-new Date(a.updated).getTime())/DAY) : null })).filter((x) => x.days === null || x.days > staleDays).sort((a,b) => (b.days ?? Infinity)-(a.days ?? Infinity) || a.app.slug.localeCompare(b.app.slug))
  const preparation = Object.fromEntries(['not_started','in_progress','needs_input','ready_for_next_step','complete'].map((state) => [state, selected.filter((a) => a.preparation?.state === state).length]))
  const ready = preparation.ready_for_next_step + preparation.complete
  const needsAttention = selected.length - ready
  return {
    schemaVersion: 2, scope, generatedAt: new Date(now).toISOString(),
    overview: { total: selected.length, active: selected.filter((a) => !closed(a)).length, closed: selected.filter(closed).length, ready, needsAttention, blocked: needsAttention },
    funnel: { stages: lifecycle, preparation, readiness: { ready, blocked: needsAttention } }, geography: { countries }, risks: { categories: risks },
    narratives: { heuristic: true, limitation: 'Tags are a proxy for narrative reuse; no structured application-to-narrative relationship is recorded.', tags },
    quality: { staleThresholdDays: staleDays, stale: stale.map((x) => ({ ...link(x.app), daysSinceUpdate: x.days })), missingMetadata: selected.filter((a) => !a.metadataExists).map(link), unknownLifecycle: selected.filter((a) => !a.lifecycle?.valid).map(link) },
  }
}

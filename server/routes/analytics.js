import { Router } from 'express'
import { buildVaultModel } from '../vault/index.js'
import { loadSettings } from '../config/settings.js'
import { buildAnalytics } from '../vault/analytics.js'

export const analyticsRouter = Router()

const TERMINAL_STATUSES = new Set(['rejected', 'withdrawn', 'archived'])

// Additive decision-oriented projection. Legacy analytics routes below remain stable.
analyticsRouter.get('/insights', (req, res) => {
  const scope = ['active', 'all', 'archive'].includes(req.query.scope) ? req.query.scope : 'active'
  const settings = loadSettings()
  const staleDays = Number(req.query.staleDays) || settings.staleDays
  res.json(buildAnalytics(buildVaultModel().applications, { scope, staleDays }))
})

function daysSince(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
}

function activeOpenApplications(applications) {
  return applications.filter(
    (a) => !a.archived && a.status && !TERMINAL_STATUSES.has(a.status)
  )
}

analyticsRouter.get('/stale', (req, res) => {
  const { applications } = buildVaultModel()
  const settings = loadSettings()
  const days = Number(req.query.days) || settings.staleDays

  const stale = activeOpenApplications(applications)
    .map((a) => ({ ...a, daysSinceUpdate: daysSince(a.updated) }))
    .filter((a) => a.daysSinceUpdate === null || a.daysSinceUpdate > days)
    .sort((a, b) => (b.daysSinceUpdate ?? Infinity) - (a.daysSinceUpdate ?? Infinity))

  res.json({ thresholdDays: days, applications: stale })
})

analyticsRouter.get('/status-distribution', (req, res) => {
  const { applications } = buildVaultModel()
  const active = applications.filter((a) => !a.archived)

  const counts = {}
  for (const app of active) {
    const key = app.status || 'unknown'
    counts[key] = (counts[key] || 0) + 1
  }

  res.json({
    total: active.length,
    counts,
  })
})

analyticsRouter.get('/risk-rollup', (req, res) => {
  const { applications } = buildVaultModel()
  const active = activeOpenApplications(applications)

  const countryCounts = {}
  for (const app of active) {
    if (!app.country) continue
    countryCounts[app.country] = (countryCounts[app.country] || 0) + 1
  }

  res.json({
    totalActive: active.length,
    languageRiskCount: active.filter((a) => a.languageRisk).length,
    compensationRiskCount: active.filter((a) => a.compensationRisk).length,
    mainRiskFlaggedCount: active.filter((a) => a.mainRiskFromBody).length,
    countries: Object.entries(countryCounts).map(([country, count]) => ({ country, count })),
  })
})

// No structured field records which of AGENTS.md's 7 narrative categories was
// used per application, so this is an explicit best-effort heuristic based on
// tag overlap — surfaced in the UI as such, never as an authoritative join.
analyticsRouter.get('/tag-reuse', (req, res) => {
  const { applications } = buildVaultModel()
  const active = applications.filter((a) => !a.archived)
  const IGNORED_TAGS = new Set(['application'])

  const tagMap = new Map()
  for (const app of active) {
    for (const tag of app.tags) {
      if (IGNORED_TAGS.has(tag)) continue
      if (!tagMap.has(tag)) tagMap.set(tag, [])
      tagMap.get(tag).push(app.slug)
    }
  }

  const reused = [...tagMap.entries()]
    .filter(([, slugs]) => slugs.length > 1)
    .map(([tag, slugs]) => ({ tag, applications: slugs }))
    .sort((a, b) => b.applications.length - a.applications.length)

  res.json({ heuristic: true, reused })
})

import { Router } from 'express'
import { buildVaultModel } from '../vault/index.js'
import { buildAnalytics } from '../vault/analytics.js'

export const analyticsRouter = Router()
const DEFAULT_STALE_DAYS = Number(process.env.STALE_DAYS_DEFAULT) || 14

analyticsRouter.get('/insights', (req, res) => {
  const scope = ['active', 'all', 'archive'].includes(req.query.scope) ? req.query.scope : 'active'
  const staleDays = Number(req.query.staleDays) || DEFAULT_STALE_DAYS
  res.json(buildAnalytics(buildVaultModel().applications, { scope, staleDays }))
})

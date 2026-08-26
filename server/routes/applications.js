import { Router } from 'express'
import { buildVaultModel, invalidateVaultCache } from '../vault/index.js'
import { PATHS } from '../config/paths.js'
import { executeApplicationCommand } from '../vault/commands.js'

export const applicationsRouter = Router()

export function findApplication(applications, slug, scope) {
  const archived = scope === 'archive' ? true : scope === 'active' ? false : null
  return applications.find((application) => application.slug === slug && (archived === null || Boolean(application.archived) === archived))
}

applicationsRouter.get('/', (req, res) => {
  const { applications } = buildVaultModel()
  res.json(applications)
})

applicationsRouter.post('/:slug/commands', (req, res) => {
  try {
    const result = executeApplicationCommand({ paths: PATHS, slug: req.params.slug, scope: req.query.scope, command: req.body, invalidate: invalidateVaultCache })
    res.json(result)
  } catch (error) {
    const status = error.statusCode || 500
    const codes = { 404: 'APPLICATION_NOT_FOUND', 409: 'APPLICATION_CONFLICT', 412: 'STALE_REVISION', 422: 'VALIDATION_ERROR' }
    res.status(status).json({ error: status >= 500 ? 'Application command failed' : error.message, code: codes[status] || 'INTERNAL_ERROR' })
  }
})

applicationsRouter.get('/:slug', (req, res) => {
  const { applications } = buildVaultModel()
  const application = findApplication(applications, req.params.slug, req.query.scope)
  if (!application) {
    res.status(404).json({ error: 'Application not found' })
    return
  }
  res.json(application)
})

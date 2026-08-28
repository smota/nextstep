import express from 'express'
import { applicationsRouter } from './routes/applications.js'
import { companiesRouter } from './routes/companies.js'
import { peopleRouter } from './routes/people.js'
import { analyticsRouter } from './routes/analytics.js'
import { skillsRouter } from './routes/skills.js'
import { coordinationRouter } from './routes/coordination.js'
import { vaultRouter } from './routes/vault.js'
import { actionsRouter } from './routes/actions.js'
import { networkRouter } from './routes/network.js'
import { runtimeRouter } from './routes/runtime.js'
import { createRouter } from './routes/create.js'
import { profileRouter } from './routes/profile.js'
import { apiErrorHandler } from './routes/public.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '7mb' }))

  app.use('/api/applications', applicationsRouter)
  app.use('/api/companies', companiesRouter)
  app.use('/api/people', peopleRouter)
  app.use('/api/analytics', analyticsRouter)
  app.use('/api/skills', skillsRouter)
  app.use('/api/coordination', coordinationRouter)
  app.use('/api/vault', vaultRouter)
  app.use('/api/actions', actionsRouter)
  app.use('/api/create', createRouter)
  app.use('/api/network', networkRouter)
  app.use('/api/profile', profileRouter)
  app.use('/api', runtimeRouter)

  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }))
  app.use(apiErrorHandler)
  return app
}

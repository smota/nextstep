import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { PATHS, validateConfiguredPaths } from './config/paths.js'
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
import { createRouter, intakeStore } from './routes/create.js'
import { profileRouter } from './routes/profile.js'
import { apiErrorHandler } from './routes/public.js'
import { initializeRuntime } from './runtime-state.js'
import { runStartupRecovery } from './startup-recovery.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 5175

validateConfiguredPaths(PATHS)
await runStartupRecovery({paths:PATHS,initializeRuntime,cleanupIntakes:()=>intakeStore.cleanup()})
const app = express()
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
app.use('/api', apiErrorHandler)

const clientDist = path.join(__dirname, '..', 'client', 'dist')
app.use(express.static(clientDist))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    next()
    return
  }
  res.sendFile(path.join(clientDist, 'index.html'))
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Nextstep running at http://127.0.0.1:${PORT}`)
  console.log('Private data root configured')
})

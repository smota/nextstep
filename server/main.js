import { PATHS } from './config/paths.js'
import { createApp } from './app.js'
import { intakeStore } from './routes/create.js'
import { initializeRuntime } from './runtime-state.js'
import { runStartupRecovery } from './startup-recovery.js'

const PORT = process.env.PORT || 5175

await runStartupRecovery({paths:PATHS,initializeRuntime,cleanupIntakes:()=>intakeStore.cleanup()})
const app = createApp()

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Nextstep API running at http://127.0.0.1:${PORT}`)
  console.log('Private data root configured')
})

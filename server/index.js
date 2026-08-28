import { loadLocalEnv } from './config/local-env.js'

loadLocalEnv()
const { PATHS, validateConfiguredPaths } = await import('./config/paths.js')
validateConfiguredPaths(PATHS)
await import('./main.js')

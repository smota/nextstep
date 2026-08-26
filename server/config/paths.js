import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const APP_ROOT = path.resolve(__dirname, '../..')

const configuredDataRoot = process.env.NEXTSTEP_DATA_ROOT || process.env.VAULT_ROOT
const VAULT_ROOT = path.resolve(configuredDataRoot || path.join(APP_ROOT, 'data'))
const STATE_ROOT = path.resolve(process.env.NEXTSTEP_STATE_ROOT || path.join(VAULT_ROOT, '.nextstep'))

const CANDIDATURES_DIR = path.join(VAULT_ROOT, 'Candidatures')
const COORDINATION_DIR = path.join(VAULT_ROOT, '.coordination')

export const PATHS = {
  appRoot: APP_ROOT,
  configuredDataRoot: Boolean(configuredDataRoot),
  vaultRoot: VAULT_ROOT,
  stateRoot: STATE_ROOT,
  candidaturesDir: CANDIDATURES_DIR,
  applicationsDir: path.join(CANDIDATURES_DIR, 'applications'),
  archiveApplicationsDir: path.join(CANDIDATURES_DIR, 'archive', 'applications'),
  companiesDir: path.join(CANDIDATURES_DIR, 'companies'),
  peopleDir: path.join(CANDIDATURES_DIR, 'people'),
  coordinationDir: COORDINATION_DIR,
  workQueuePath: path.join(COORDINATION_DIR, 'work-queue.md'),
  auditLogPath: path.join(COORDINATION_DIR, 'audit-log.md'),
  decisionsPath: path.join(COORDINATION_DIR, 'decisions.md'),
  locksDir: path.join(COORDINATION_DIR, 'locks'),
  handoffsDir: path.join(COORDINATION_DIR, 'handoffs'),
  cacheDir: path.join(STATE_ROOT, 'cache'),
  settingsPath: path.join(STATE_ROOT, 'settings', 'ui.json'),
  runtimeSettingsPath: path.join(STATE_ROOT, 'settings', 'runtime.json'),
  runsDir: path.join(STATE_ROOT, 'runs'),
  intakesDir: path.join(STATE_ROOT, 'intakes'),
  skillsDir: path.join(APP_ROOT, '.agents', 'skills'),
  agentsMdPath: path.join(VAULT_ROOT, 'AGENTS.md'),
}

export function validateConfiguredPaths(paths = PATHS, env = process.env) {
  const configured = env.NEXTSTEP_DATA_ROOT || env.VAULT_ROOT || ''
  if (!paths.configuredDataRoot || !path.isAbsolute(configured)) throw new Error('NEXTSTEP_DATA_ROOT must be configured with an absolute path')
  const appRelative = path.relative(paths.appRoot, paths.vaultRoot)
  if (appRelative === '' || (!appRelative.startsWith('..') && !path.isAbsolute(appRelative))) throw new Error('NEXTSTEP_DATA_ROOT must be outside the application repository')
  const stateRelative = path.relative(paths.appRoot, paths.stateRoot)
  if (stateRelative === '' || (!stateRelative.startsWith('..') && !path.isAbsolute(stateRelative))) throw new Error('NEXTSTEP_STATE_ROOT must be outside the application repository')
  const dataRelative = path.relative(paths.vaultRoot, paths.stateRoot)
  if (dataRelative === '' || dataRelative.startsWith('..') || path.isAbsolute(dataRelative)) throw new Error('NEXTSTEP_STATE_ROOT must be contained by NEXTSTEP_DATA_ROOT')
  for (const required of ['Candidatures', 'Master', '.coordination']) {
    if (!fs.existsSync(path.join(paths.vaultRoot, required))) throw new Error(`NEXTSTEP_DATA_ROOT is missing required directory: ${required}`)
  }
  return paths
}

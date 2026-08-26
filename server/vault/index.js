import path from 'node:path'
import { PATHS } from '../config/paths.js'
import { loadApplications } from './applications.js'
import { loadCompanies } from './companies.js'
import { loadPeople } from './people.js'
import { loadCoordinationState } from './coordination.js'
import { buildCrossLinks } from './crossLink.js'
import { createDisposableIndex, INDEX_VERSION } from './disposableIndex.js'
import { addWorkflowProjections } from './workflow.js'

function buildFromVault() {
  let applications = [
    ...loadApplications(PATHS.applicationsDir, { archived: false }),
    ...loadApplications(PATHS.archiveApplicationsDir, { archived: true }),
  ]
  const companies = loadCompanies(PATHS.companiesDir)
  const people = loadPeople(PATHS.peopleDir)
  buildCrossLinks({ applications, companies, people })
  applications = addWorkflowProjections(applications)
  return { applications, companies, people, coordination: loadCoordinationState(PATHS), builtAt: new Date().toISOString() }
}

const index = createDisposableIndex({
  vaultRoot: PATHS.vaultRoot,
  cacheFile: path.join(PATHS.cacheDir, 'vault-index.v1.json'),
  sourceRoots: [PATHS.applicationsDir, PATHS.archiveApplicationsDir, PATHS.companiesDir, PATHS.peopleDir, PATHS.coordinationDir],
  buildModel: buildFromVault,
})
let lastIndexState = { state: 'not_loaded', indexedAt: null, manifestEntries: 0 }

export function buildVaultModel({ force = false } = {}) {
  const result = index.load({ force })
  lastIndexState = { state: result.state, indexedAt: result.indexedAt, manifestEntries: result.manifestEntries }
  return result.model
}

export function publicVaultHealth({available,builtAt=null,indexState=lastIndexState}={}){return{vault:available?{state:'available',builtAt}:{state:'error'},index:{state:indexState.state,indexedAt:indexState.indexedAt||null,manifestEntries:indexState.manifestEntries||0,version:INDEX_VERSION,disposable:true}}}
export function getVaultHealth() {
  try { const model = buildVaultModel(); return publicVaultHealth({available:true,builtAt:model.builtAt}) }
  catch { return publicVaultHealth({available:false}) }
}

export function invalidateVaultCache() {
  const result=index.remove()
  lastIndexState = { state: result.state, indexedAt: null, manifestEntries: 0 }
  return result
}

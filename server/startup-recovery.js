import { recoverVaultTransactions } from './vault/transactionJournal.js'
import { recoverApplicationTransactions } from './actions/artifacts.js'
import { recoverCommandTransactions } from './vault/commands.js'
import { recoverNormalization } from './migrations/normalize-records.js'
import { recoverLifecycleMoves } from './vault/lifecycleMove.js'

export async function runStartupRecovery({ paths, initializeRuntime, cleanupIntakes, deps = {}, operations = {} }) {
  const recoverTransactions=operations.recoverTransactions||recoverVaultTransactions,recoverApplications=operations.recoverApplications||recoverApplicationTransactions,recoverCommands=operations.recoverCommands||recoverCommandTransactions,recoverMigration=operations.recoverMigration||recoverNormalization,recoverMoves=operations.recoverMoves||recoverLifecycleMoves
  recoverMoves({ paths, deps: deps.moves || {} })
  recoverTransactions({ paths, deps: deps.transactions || {} })
  recoverApplications({ paths, deps: deps.applications || {} })
  recoverCommands({ paths, deps: deps.commands || {}, includeShared: false })
  recoverMigration({ vaultRoot: paths.vaultRoot, deps: deps.migration || {} })
  const runtime = await initializeRuntime()
  await cleanupIntakes()
  return runtime
}

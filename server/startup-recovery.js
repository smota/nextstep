import { recoverVaultTransactions } from './vault/transactionJournal.js'
import { recoverApplicationTransactions } from './actions/artifacts.js'
import { recoverLifecycleMoves } from './vault/lifecycleMove.js'

export async function runStartupRecovery({ paths, initializeRuntime, cleanupIntakes, deps = {}, operations = {} }) {
  const recoverTransactions=operations.recoverTransactions||recoverVaultTransactions,recoverApplications=operations.recoverApplications||recoverApplicationTransactions,recoverMoves=operations.recoverMoves||recoverLifecycleMoves
  recoverMoves({ paths, deps: deps.moves || {} })
  recoverTransactions({ paths, deps: deps.transactions || {} })
  recoverApplications({ paths, deps: deps.applications || {} })
  const runtime = await initializeRuntime()
  await cleanupIntakes()
  return runtime
}

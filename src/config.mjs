import fs from 'node:fs'
import path from 'node:path'

function isVault(root) {
  return fs.existsSync(path.join(root, 'Candidatures', 'records', 'manifest.json')) && fs.existsSync(path.join(root, 'Master'))
}

function discoverFrom(start) {
  let current = path.resolve(start)
  while (true) {
    if (isVault(current)) return current
    const parent = path.dirname(current)
    if (parent === current) return null
    current = parent
  }
}

function existingAncestor(candidate) {
  let current = path.resolve(candidate)
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current)
    if (parent === current) return null
    current = parent
  }
  return current
}

export function assertContained(root, candidate, label = 'Path') {
  const rootReal = fs.realpathSync.native(path.resolve(root))
  const absolute = path.resolve(candidate)
  const lexical = path.relative(rootReal, absolute)
  if (!lexical || lexical.startsWith('..') || path.isAbsolute(lexical)) throw Object.assign(new Error(`${label} must be contained by ${rootReal}`), { code: 'UNSAFE_PATH' })
  const ancestor = existingAncestor(absolute)
  if (!ancestor) throw Object.assign(new Error(`${label} has no resolvable ancestor`), { code: 'UNSAFE_PATH' })
  const resolved = path.resolve(fs.realpathSync.native(ancestor), path.relative(ancestor, absolute))
  const physical = path.relative(rootReal, resolved)
  if (!physical || physical.startsWith('..') || path.isAbsolute(physical)) throw Object.assign(new Error(`${label} escapes through a symlink or junction`), { code: 'UNSAFE_PATH' })
  return absolute
}

export function resolvePaths({ dataRoot, stateRoot, cwd = process.cwd(), env = process.env } = {}) {
  const selected = dataRoot || env.NEXTSTEP_DATA_ROOT || discoverFrom(cwd)
  if (!selected || !path.isAbsolute(selected)) throw Object.assign(new Error('Nextstep data root was not found; use --data-root or NEXTSTEP_DATA_ROOT'), { code: 'DATA_ROOT_REQUIRED' })
  const vaultRoot = fs.realpathSync.native(path.resolve(selected))
  if (!isVault(vaultRoot)) throw Object.assign(new Error('Data root must contain Master/ and Candidatures/records/manifest.json'), { code: 'INVALID_DATA_ROOT' })
  assertContained(vaultRoot, path.join(vaultRoot, 'Master'), 'Master root')
  assertContained(vaultRoot, path.join(vaultRoot, 'Candidatures'), 'Candidatures root')
  const resolvedState = path.resolve(stateRoot || env.NEXTSTEP_STATE_ROOT || path.join(vaultRoot, '.nextstep'))
  try { assertContained(vaultRoot, resolvedState, 'State root') } catch (error) { throw Object.assign(new Error(error.message), { code: 'INVALID_STATE_ROOT' }) }
  return {
    vaultRoot,
    stateRoot: resolvedState,
    candidaturesDir: path.join(vaultRoot, 'Candidatures'),
    recordsDir: path.join(vaultRoot, 'Candidatures', 'records'),
    artifactsDir: path.join(vaultRoot, 'Candidatures', 'artifacts'),
    indexesDir: path.join(vaultRoot, 'Candidatures', 'indexes'),
    reportsDir: path.join(vaultRoot, 'Candidatures', 'reports'),
    auditPath: path.join(vaultRoot, 'Candidatures', 'records', 'audit.jsonl'),
    lockPath: path.join(resolvedState, 'locks', 'commit.lock'),
    journalDir: path.join(resolvedState, 'transactions'),
    ledgerPath: path.join(resolvedState, 'transactions', 'ledger.json')
  }
}

export function within(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

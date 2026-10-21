import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { classifyVault, counts, fail, json, RECORD_FILES, RECORD_TYPES, sha, shaFile } from './model.mjs'
import { applyTransaction, digest, inspectDomainJournals, listDomainJournalFiles, loadLedger, renderIndexes, restoreDomainJournals, withCommitLock } from './storage.mjs'

const CAREER_TYPES = RECORD_TYPES.filter(type => type !== 'actions')
const UNINITIALIZED = 'Cannot use an uninitialized vault; run from a vault directory'

function assertInitialized(paths) {
  if (paths?.vaultState === 'uninitialized') fail(UNINITIALIZED, 'VAULT_NOT_INITIALIZED')
}

function filesUnder(directory) {
  if (!fs.existsSync(directory)) return []
  const found = []
  const visit = current => {
    for (const name of fs.readdirSync(current).sort()) {
      const absolute = path.join(current, name)
      const stat = fs.lstatSync(absolute)
      if (stat.isSymbolicLink()) continue
      if (stat.isDirectory()) visit(absolute)
      else if (stat.isFile()) found.push(absolute)
    }
  }
  visit(directory)
  return found
}

function shaMap(root, directory) {
  const out = {}
  for (const file of filesUnder(directory)) out[path.relative(root, file).split(path.sep).join('/')] = shaFile(file)
  return out
}

function indexModel(classified) {
  return Array.isArray(classified.model.actions) ? classified.model : { ...classified.model, actions: [] }
}

function changedIndexes(paths, model) {
  const projectedIndexSha256 = {}
  const files = new Map()
  for (const [name, content] of renderIndexes(model)) {
    const relative = name.split(path.sep).join('/')
    const file = path.join(paths.indexesDir, ...relative.split('/'))
    const next = Buffer.from(content)
    const current = fs.existsSync(file) ? fs.readFileSync(file) : null
    if (!current || !current.equals(next)) {
      projectedIndexSha256[relative] = sha(content)
      files.set(file, content)
    }
  }
  return { projectedIndexSha256, files }
}

function tokenFrom(paths, classified = classifyVault(paths)) {
  if (classified.kind === 'absent') fail('Vault manifest is missing', 'MODEL_INVALID', { reason: 'schema_version' })
  const version = classified.schemaVersion
  const careerFileSha256 = {}
  for (const type of CAREER_TYPES) {
    const filename = RECORD_FILES[type]
    careerFileSha256[filename] = shaFile(path.join(paths.recordsDir, filename))
  }
  const actionsPath = path.join(paths.recordsDir, RECORD_FILES.actions)
  const actionsPresent = fs.existsSync(actionsPath)
  const writeSet = version === 5
    ? { actionsJson: 'unchanged', manifest: 'unchanged', projectedIndexSha256: {}, ledger: 'none', audit: 'none' }
    : {
      actionsJson: classified.actionsFile === 'absent' ? 'create-empty' : 'unchanged',
      manifest: 'rewrite-v5',
      projectedIndexSha256: changedIndexes(paths, indexModel(classified)).projectedIndexSha256,
      ledger: 'append-or-replace-record',
      audit: 'append-one-line'
    }
  return {
    schemaVersion: 1,
    vaultSchemaVersion: version,
    manifestSha256: shaFile(path.join(paths.recordsDir, 'manifest.json')),
    careerFileSha256,
    actionsSha256: actionsPresent ? shaFile(actionsPath) : null,
    snapshotAndTransmissionSha256: shaMap(paths.vaultRoot, path.join(paths.artifactsDir, '.versions')),
    currentIndexSha256: shaMap(paths.indexesDir, paths.indexesDir),
    auditPrefixSha256: fs.existsSync(paths.auditPath) ? shaFile(paths.auditPath) : sha(''),
    ledgerPreimage: fs.existsSync(paths.ledgerPath) ? { present: true, sha256: shaFile(paths.ledgerPath) } : { present: false, sha256: null },
    writeSet
  }
}

function commandEnvelope(input) {
  if (!input || input.schemaVersion !== 1) fail('schemaVersion must be 1', 'INVALID_ENVELOPE')
  if (!input.requestId || !input.idempotencyKey) fail('Mutations require requestId and idempotencyKey', 'INVALID_ENVELOPE')
  return { ...input, command: 'model.upgradeApply', actor: input.actor || 'user' }
}

function requireToken(input) {
  if (input?.payload == null || typeof input.payload !== 'object' || input.payload.token == null) fail('payload.token is required', 'INVALID_COMMAND')
  if (typeof input.payload.token !== 'object' || Array.isArray(input.payload.token)) fail('payload.token must be an object', 'INVALID_COMMAND')
}

function freshResult(envelope, status, recovery, schemaChanged) {
  return {
    schemaVersion: 1,
    requestId: envelope.requestId,
    status,
    changedEntities: [],
    revision: null,
    warnings: [],
    unresolvedEvidence: [],
    nextActions: [],
    recovery,
    schemaChanged
  }
}

function attachRecovery(error, recovery) {
  error.details = { ...(error.details || {}), recovery }
  return error
}

function v4Values(paths, envelope, ledger) {
  const classified = classifyVault(paths)
  const values = new Map()
  const actionsPath = path.join(paths.recordsDir, RECORD_FILES.actions)
  if (!fs.existsSync(actionsPath)) values.set(actionsPath, json([]))
  const manifestPath = path.join(paths.recordsDir, 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const model = indexModel(classified)
  values.set(manifestPath, json({ ...manifest, schema_version: 5, model: 'nextstep-opportunity-graph', counts: counts(model) }))
  for (const [file, content] of changedIndexes(paths, model).files) values.set(file, content)
  values.set(paths.ledgerPath, json(ledger))
  const oldAudit = fs.existsSync(paths.auditPath) ? fs.readFileSync(paths.auditPath, 'utf8') : ''
  const auditEntry = { schemaVersion: 1, at: new Date().toISOString(), requestId: envelope.requestId, actor: envelope.actor, command: 'model.upgradeApply', changedEntities: [] }
  values.set(paths.auditPath, `${oldAudit}${JSON.stringify(auditEntry)}\n`)
  return values
}

export function upgradePreview(paths) {
  assertInitialized(paths)
  const classified = classifyVault(paths)
  if (listDomainJournalFiles(paths).length) fail('A pending domain journal must be recovered before upgrade preview can issue a token', 'PENDING_JOURNAL', { recoverCommand: 'model upgrade-apply --recover-only' })
  return { schemaVersion: 1, status: 'ok', token: tokenFrom(paths, classified) }
}

function dryRunUpgrade(paths, envelope) {
  const current = tokenFrom(paths)
  if (digest(current) !== digest(envelope.payload.token)) fail('Upgrade token does not match the vault', 'STALE_REVISION')
  return {
    schemaVersion: 1,
    requestId: envelope.requestId,
    status: 'dry_run',
    dryRun: true,
    recovery: { performed: false, journals: 0 },
    schemaChanged: false
  }
}

function applyLocked(paths, envelope, options) {
  const recovery = restoreDomainJournals(paths, inspectDomainJournals(paths))
  let ledger
  try { ledger = loadLedger(paths) } catch (error) { throw attachRecovery(error, recovery) }
  const commandDigest = digest(envelope)
  const existing = ledger.entries?.[envelope.idempotencyKey]
  if (existing) {
    if (existing.digest !== commandDigest) fail('Idempotency key was reused for another command', 'IDEMPOTENCY_CONFLICT', { recovery })
    return { ...existing.result, replayed: true, currentRecovery: recovery }
  }
  let current
  try { current = tokenFrom(paths) } catch (error) { throw attachRecovery(error, recovery) }
  if (digest(current) !== digest(envelope.payload.token)) fail('Upgrade token does not match the vault', 'STALE_REVISION', { recovery })
  if (current.vaultSchemaVersion === 5) return freshResult(envelope, 'applied', recovery, false)
  if (!ledger.entries || typeof ledger.entries !== 'object' || Array.isArray(ledger.entries)) ledger.entries = {}
  const response = freshResult(envelope, 'applied', recovery, true)
  ledger.entries[envelope.idempotencyKey] = { digest: commandDigest, result: response }
  try {
    applyTransaction(paths, v4Values(paths, envelope, ledger), envelope.requestId, { onPhase: options.onPhase })
  } catch (error) {
    if (error.code === 'JOURNAL_CLEANUP_FAILED' && recovery.performed) error.details = { ...error.details, recovery }
    throw error
  }
  return response
}

export function upgradeApply(paths, input, options = {}) {
  assertInitialized(paths)
  const envelope = commandEnvelope(input)
  requireToken(input)
  if (paths.dryRun) return dryRunUpgrade(paths, envelope)
  return withCommitLock(paths, envelope.requestId, () => applyLocked(paths, envelope, options))
}

export function upgradeRecover(paths) {
  if (paths?.dryRun) fail('model upgrade-apply --recover-only cannot be combined with --dry-run', 'USAGE')
  assertInitialized(paths)
  return withCommitLock(paths, `recover-${crypto.randomUUID()}`, () => {
    const recovery = restoreDomainJournals(paths, inspectDomainJournals(paths))
    return { schemaVersion: 1, status: 'ok', recovery, schemaChanged: false }
  })
}

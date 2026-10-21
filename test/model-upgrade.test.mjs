// Explicit v4 to v5 upgrade. Ordinary command tests keep the v5 factories.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { commandDescription, doctor, get, upgradeApply, upgradePreview, upgradeRecover } from '../src/commands.mjs'
import { main, routeNames } from '../src/cli.mjs'
import { resolvePaths } from '../src/config.mjs'
import { json, loadModel, RECORD_FILES, RECORD_TYPES, shaFile } from '../src/model.mjs'
import { SYNTHETIC, syntheticVault } from './fixtures/vault-v4.mjs'

const CAREER = RECORD_TYPES.filter(type => type !== 'actions')

function envelope(token, id) {
  return { schemaVersion: 1, requestId: id, idempotencyKey: id, actor: 'operator', payload: { token } }
}

function fileIn(root, relative) {
  return path.join(root, 'Candidatures', ...relative.split('/'))
}

function fileSha(file) {
  return fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null
}

function preservedHashes(root) {
  const files = [
    ...CAREER.map(type => path.join(root, 'Candidatures', 'records', RECORD_FILES[type])),
    fileIn(root, SYNTHETIC.cvPath),
    fileIn(root, SYNTHETIC.notePath),
    fileIn(root, SYNTHETIC.submissionSnapshot),
    fileIn(root, SYNTHETIC.outreachTransmission)
  ]
  return Object.fromEntries(files.map(file => [path.relative(root, file).split(path.sep).join('/'), fileSha(file)]))
}

function listTree(root) {
  const out = []
  const walk = directory => {
    for (const name of fs.readdirSync(directory).sort()) {
      const absolute = path.join(directory, name)
      const relative = path.relative(root, absolute).split(path.sep).join('/')
      if (fs.lstatSync(absolute).isDirectory()) {
        out.push(`${relative}/`)
        walk(absolute)
      } else out.push(`${relative}:${fileSha(absolute)}`)
    }
  }
  walk(root)
  return out
}

function readManifest(paths) {
  return JSON.parse(fs.readFileSync(path.join(paths.recordsDir, 'manifest.json'), 'utf8'))
}

function writeManifest(paths, manifest) {
  fs.writeFileSync(path.join(paths.recordsDir, 'manifest.json'), json(manifest))
}

function actionsFile(paths) {
  return path.join(paths.recordsDir, RECORD_FILES.actions)
}

function domainJournals(paths) {
  if (!fs.existsSync(paths.journalDir)) return []
  return fs.readdirSync(paths.journalDir).filter(name => name.endsWith('.json') && name !== 'ledger.json').sort().map(name => path.join(paths.journalDir, name))
}

function plantJournal(paths, { name = 'pending.json', state = 'prepared', preimages }) {
  fs.mkdirSync(paths.journalDir, { recursive: true })
  const file = path.join(paths.journalDir, name)
  fs.writeFileSync(file, json({ schemaVersion: 1, id: name, requestId: name, state, preimages }))
  return file
}

function holdLock(paths) {
  fs.mkdirSync(path.dirname(paths.lockPath), { recursive: true })
  const body = json({ schemaVersion: 1, requestId: 'held', pid: 1, acquiredAt: new Date().toISOString() })
  fs.writeFileSync(paths.lockPath, body)
  return body
}

function assertRecovery(recovery, journals) {
  assert.deepEqual(recovery, { performed: journals > 0, journals })
}

function crash(phase) {
  return current => current === phase ? 'crash' : undefined
}

function ioBuffers() {
  const buffers = { out: '', err: '' }
  return { buffers, io: { out: { write: value => { buffers.out += value } }, err: { write: value => { buffers.err += value } } } }
}

function expectCode(fn, code, details = {}) {
  assert.throws(fn, error => {
    assert.equal(error.code, code)
    for (const [key, value] of Object.entries(details)) assert.deepEqual(error.details?.[key], value)
    if (Object.keys(details).length && !Object.hasOwn(details, 'recovery')) assert.equal(error.details?.recovery, undefined)
    assert.equal(error.currentRecovery, undefined)
    return true
  })
}

function markerFile(root) {
  return path.join(root, 'Candidatures', 'marker.txt')
}

function preimage(file, existed, bytes) {
  return { file, existed, data: Buffer.from(bytes).toString('base64') }
}

test('preview writes nothing and binds the upgrade token', t => {
  const { root, paths } = syntheticVault(t, 4)
  const before = listTree(root)
  const historical = fs.readFileSync(paths.auditPath)
  fs.mkdirSync(paths.indexesDir, { recursive: true })
  const extra = path.join(paths.indexesDir, 'stale-extra.md')
  fs.writeFileSync(extra, 'keep\n')
  const treeAfterExtra = listTree(root)
  const first = upgradePreview(paths)
  const second = upgradePreview(paths)
  assert.equal(first.status, 'ok')
  assert.equal(first.schemaVersion, 1)
  assert.deepEqual(second.token, first.token)
  assert.deepEqual(listTree(root), treeAfterExtra)
  assert.equal(fs.existsSync(paths.lockPath), false)
  assert.equal(fs.existsSync(paths.stateRoot) && fs.existsSync(path.join(paths.stateRoot, 'locks')), false)
  const token = first.token
  assert.equal(token.schemaVersion, 1)
  assert.equal(token.vaultSchemaVersion, 4)
  assert.equal(token.manifestSha256, shaFile(path.join(paths.recordsDir, 'manifest.json')))
  assert.deepEqual(Object.keys(token.careerFileSha256).sort(), CAREER.map(type => RECORD_FILES[type]).sort())
  assert.equal(Object.hasOwn(token.careerFileSha256, 'actions.json'), false)
  assert.equal(token.careerFileSha256['companies.json'], shaFile(path.join(paths.recordsDir, 'companies.json')))
  assert.equal(token.actionsSha256, null)
  const submissionKey = `Candidatures/${SYNTHETIC.submissionSnapshot}`
  const outreachKey = `Candidatures/${SYNTHETIC.outreachTransmission}`
  assert.equal(token.snapshotAndTransmissionSha256[submissionKey], shaFile(fileIn(root, SYNTHETIC.submissionSnapshot)))
  assert.equal(token.snapshotAndTransmissionSha256[outreachKey], shaFile(fileIn(root, SYNTHETIC.outreachTransmission)))
  assert.equal(Object.keys(token.snapshotAndTransmissionSha256).length, 2)
  assert.equal(token.currentIndexSha256['stale-extra.md'], shaFile(extra))
  assert.equal(token.auditPrefixSha256, shaFile(paths.auditPath))
  assert.deepEqual(token.ledgerPreimage, { present: false, sha256: null })
  assert.equal(token.writeSet.actionsJson, 'create-empty')
  assert.equal(token.writeSet.manifest, 'rewrite-v5')
  assert.equal(token.writeSet.ledger, 'append-or-replace-record')
  assert.equal(token.writeSet.audit, 'append-one-line')
  assert.equal(Object.hasOwn(token.writeSet, 'delete'), false)
  assert.equal(Object.hasOwn(token.writeSet, 'deletes'), false)
  assert.deepEqual(Object.keys(token.writeSet).sort(), ['actionsJson', 'audit', 'ledger', 'manifest', 'projectedIndexSha256'])
  assert.equal(typeof token.writeSet.projectedIndexSha256['index.md'], 'string')
  assert.equal(Object.hasOwn(token.writeSet.projectedIndexSha256, 'actions.md'), false)
  assert.equal(Object.hasOwn(token.writeSet.projectedIndexSha256, 'stale-extra.md'), false)
  assert.equal(Object.hasOwn(token.writeSet.projectedIndexSha256, submissionKey), false)
  assert.deepEqual(fs.readFileSync(paths.auditPath), historical)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.deepEqual(listTree(root).includes(before[0]), true)
})

test('preview rejects a pending journal, including an unsafe preimage, and issues no token', t => {
  const { root, paths } = syntheticVault(t, 4)
  const marker = markerFile(root)
  fs.writeFileSync(marker, 'live\n')
  const escape = path.join(os.tmpdir(), `nextstep-escape-${crypto.randomUUID()}`)
  const journal = plantJournal(paths, { name: 'z-unsafe.json', preimages: [preimage(escape, true, 'nope')] })
  const before = listTree(root)
  expectCode(() => upgradePreview(paths), 'PENDING_JOURNAL', { recoverCommand: 'model upgrade-apply --recover-only' })
  assert.equal(fs.existsSync(journal), true)
  assert.equal(fs.readFileSync(marker, 'utf8'), 'live\n')
  assert.deepEqual(listTree(root), before)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(readManifest(paths).schema_version, 4)
})

test('preview rejects malformed, unsupported, unreadable, and incomplete vaults', t => {
  const unsupported = syntheticVault(t, 4)
  const manifest = readManifest(unsupported.paths)
  manifest.schema_version = 9
  writeManifest(unsupported.paths, manifest)
  fs.rmSync(path.join(unsupported.paths.recordsDir, RECORD_FILES.companies))
  expectCode(() => upgradePreview(unsupported.paths), 'MODEL_INVALID', { reason: 'schema_version' })
  assert.equal(fs.existsSync(actionsFile(unsupported.paths)), false)

  const typed = syntheticVault(t, 4)
  const textManifest = readManifest(typed.paths)
  textManifest.schema_version = '5'
  writeManifest(typed.paths, textManifest)
  expectCode(() => upgradePreview(typed.paths), 'MODEL_INVALID', { reason: 'schema_version' })

  const broken = syntheticVault(t, 4)
  fs.writeFileSync(path.join(broken.paths.recordsDir, RECORD_FILES.companies), '{')
  expectCode(() => upgradePreview(broken.paths), 'MODEL_INVALID', { reason: 'unreadable' })
  assert.equal(fs.existsSync(actionsFile(broken.paths)), false)

  const incomplete = syntheticVault(t, 4)
  fs.rmSync(path.join(incomplete.paths.recordsDir, RECORD_FILES.people))
  expectCode(() => upgradePreview(incomplete.paths), 'MODEL_INCOMPLETE', { missingCollection: 'people' })

  const missingActions = syntheticVault(t, 5)
  fs.rmSync(actionsFile(missingActions.paths))
  expectCode(() => upgradePreview(missingActions.paths), 'MODEL_INVALID', { reason: 'actions_missing' })
  assert.equal(fs.existsSync(actionsFile(missingActions.paths)), false)
})

test('a v5 preview token has an empty write set', t => {
  const { paths } = syntheticVault(t, 5)
  fs.mkdirSync(paths.indexesDir, { recursive: true })
  const stale = path.join(paths.indexesDir, 'index.md')
  fs.writeFileSync(stale, 'stale\n')
  const token = upgradePreview(paths).token
  assert.equal(token.vaultSchemaVersion, 5)
  assert.equal(token.actionsSha256, shaFile(actionsFile(paths)))
  assert.deepEqual(token.writeSet, { actionsJson: 'unchanged', manifest: 'unchanged', projectedIndexSha256: {}, ledger: 'none', audit: 'none' })
  assert.equal(token.currentIndexSha256['index.md'], shaFile(stale))
  assert.deepEqual(token.ledgerPreimage, { present: false, sha256: null })
})

test('a held lock does not make preview busy', t => {
  const { paths } = syntheticVault(t, 4)
  const body = holdLock(paths)
  const preview = upgradePreview(paths)
  assert.equal(preview.status, 'ok')
  assert.equal(preview.token.vaultSchemaVersion, 4)
  assert.equal(fs.readFileSync(paths.lockPath, 'utf8'), body)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
})

test('preview and apply on an uninitialized root create no vault', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-upgrade-uninit-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const paths = resolvePaths({ cwd: root })
  assert.equal(paths.vaultState, 'uninitialized')
  expectCode(() => upgradePreview(paths), 'VAULT_NOT_INITIALIZED')
  expectCode(() => upgradeApply(paths, envelope({}, 'uninit')), 'VAULT_NOT_INITIALIZED')
  expectCode(() => upgradeRecover(paths), 'VAULT_NOT_INITIALIZED')
  assert.equal(fs.existsSync(path.join(root, 'Candidatures')), false)
  assert.equal(fs.existsSync(path.join(root, 'Master')), false)
})

test('the product tree is not a data root', () => {
  const productDir = path.resolve(import.meta.dirname, '..')
  assert.equal(JSON.parse(fs.readFileSync(path.join(productDir, 'package.json'), 'utf8')).name, 'nextstep')
  assert.throws(() => resolvePaths({ cwd: productDir }), error => error.code === 'PRODUCT_TREE_NOT_DATA')
})

test('a missing token or invalid envelope does not recover', t => {
  const { root, paths } = syntheticVault(t, 4)
  const before = preservedHashes(root)
  const marker = markerFile(root)
  fs.writeFileSync(marker, 'live\n')
  const journal = plantJournal(paths, { preimages: [preimage(marker, true, 'restored\n')] })
  const journalBytes = fs.readFileSync(journal)
  expectCode(() => upgradeApply(paths, { schemaVersion: 1, requestId: 'missing', idempotencyKey: 'missing', payload: {} }), 'INVALID_COMMAND')
  expectCode(() => upgradeApply(paths, { schemaVersion: 1, requestId: 'array', idempotencyKey: 'array', payload: { token: [] } }), 'INVALID_COMMAND')
  expectCode(() => upgradeApply(paths, { schemaVersion: 2, requestId: 'bad', idempotencyKey: 'bad', payload: { token: { schemaVersion: 1 } } }), 'INVALID_ENVELOPE')
  expectCode(() => upgradeApply(paths, { schemaVersion: 1, payload: { token: { schemaVersion: 1 } } }), 'INVALID_ENVELOPE')
  assert.equal(fs.readFileSync(marker, 'utf8'), 'live\n')
  assert.deepEqual(fs.readFileSync(journal), journalBytes)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(fs.existsSync(paths.lockPath), false)
  assert.deepEqual(preservedHashes(root), before)
})

test('apply of a v4 token preserves historical bytes and a later v5 token writes nothing', t => {
  const { root, paths } = syntheticVault(t, 4)
  const before = preservedHashes(root)
  const historical = fs.readFileSync(paths.auditPath)
  const manifestBefore = readManifest(paths)
  fs.mkdirSync(paths.indexesDir, { recursive: true })
  const extra = path.join(paths.indexesDir, 'stale-extra.md')
  fs.writeFileSync(extra, 'keep\n')
  const token = upgradePreview(paths).token
  const input = envelope(token, 'upgrade-v4')
  const applied = upgradeApply(paths, input)
  assert.equal(applied.status, 'applied')
  assert.equal(applied.schemaChanged, true)
  assert.equal(applied.replayed, undefined)
  assert.equal(applied.currentRecovery, undefined)
  assert.equal(applied.dryRun, undefined)
  assertRecovery(applied.recovery, 0)
  assert.equal(Object.hasOwn(applied, 'currentRecovery'), false)
  const manifest = readManifest(paths)
  assert.equal(manifest.schema_version, 5)
  assert.equal(manifest.model, 'nextstep-opportunity-graph')
  assert.equal(manifest.counts.actions, 0)
  assert.deepEqual(Object.keys(manifest.counts), [...RECORD_TYPES])
  for (const type of CAREER) assert.equal(manifest.counts[type], manifestBefore.counts[type])
  assert.equal(fs.readFileSync(actionsFile(paths), 'utf8'), '[]\n')
  assert.deepEqual(preservedHashes(root), before)
  assert.deepEqual(loadModel(paths).actions, [])
  const interactions = JSON.parse(fs.readFileSync(path.join(paths.recordsDir, 'interactions.json'), 'utf8'))
  assert.equal(interactions.find(item => item.id === SYNTHETIC.submissionId).submission_bundle.schema_version, 4)
  const audit = fs.readFileSync(paths.auditPath)
  assert.deepEqual(audit.subarray(0, historical.length), historical)
  const added = audit.subarray(historical.length).toString('utf8').split('\n').filter(line => line.length > 0)
  assert.equal(added.length, 1)
  const entry = JSON.parse(added[0])
  assert.deepEqual(entry.changedEntities, [])
  assert.equal(entry.command, 'model.upgradeApply')
  assert.equal(entry.actor, 'operator')
  assert.equal(entry.requestId, 'upgrade-v4')
  assert.equal(Number.isNaN(Date.parse(entry.at)), false)
  const stored = JSON.parse(fs.readFileSync(paths.ledgerPath, 'utf8')).entries['upgrade-v4']
  assert.equal(stored.result.schemaChanged, true)
  assert.deepEqual(stored.result.recovery, { performed: false, journals: 0 })
  assert.equal(Object.hasOwn(stored.result, 'currentRecovery'), false)
  assert.equal(Object.hasOwn(stored.result, 'replayed'), false)
  assert.deepEqual(stored.result, applied)
  for (const [relative, digest] of Object.entries(token.writeSet.projectedIndexSha256)) {
    const file = path.join(paths.indexesDir, ...relative.split('/'))
    assert.equal(shaFile(file), digest, relative)
  }
  assert.equal(fs.readFileSync(extra, 'utf8'), 'keep\n')
  assert.equal(domainJournals(paths).length, 0)
  assert.equal(fs.existsSync(paths.lockPath), false)

  const ledgerBytes = fs.readFileSync(paths.ledgerPath)
  const auditBytes = fs.readFileSync(paths.auditPath)
  const manifestBytes = fs.readFileSync(path.join(paths.recordsDir, 'manifest.json'))
  const actionBytes = fs.readFileSync(actionsFile(paths))
  const v5 = upgradePreview(paths).token
  assert.equal(v5.vaultSchemaVersion, 5)
  assert.deepEqual(v5.writeSet, { actionsJson: 'unchanged', manifest: 'unchanged', projectedIndexSha256: {}, ledger: 'none', audit: 'none' })
  assert.equal(v5.ledgerPreimage.present, true)
  assert.equal(v5.ledgerPreimage.sha256, shaFile(paths.ledgerPath))
  const repeat = upgradeApply(paths, envelope(v5, 'upgrade-v5'))
  assert.equal(repeat.status, 'applied')
  assert.equal(repeat.schemaChanged, false)
  assert.equal(repeat.replayed, undefined)
  assert.equal(Object.hasOwn(repeat, 'currentRecovery'), false)
  assertRecovery(repeat.recovery, 0)
  const again = upgradeApply(paths, envelope(v5, 'upgrade-v5-repeat'))
  assert.equal(again.schemaChanged, false)
  assert.equal(again.replayed, undefined)
  assert.deepEqual(fs.readFileSync(paths.ledgerPath), ledgerBytes)
  assert.deepEqual(fs.readFileSync(paths.auditPath), auditBytes)
  assert.deepEqual(fs.readFileSync(path.join(paths.recordsDir, 'manifest.json')), manifestBytes)
  assert.deepEqual(fs.readFileSync(actionsFile(paths)), actionBytes)
  assert.deepEqual(preservedHashes(root), before)
  assert.equal(JSON.parse(fs.readFileSync(paths.ledgerPath, 'utf8')).entries['upgrade-v5'], undefined)
  assert.equal(domainJournals(paths).length, 0)
})

test('an already canonical empty actions file is left unchanged', t => {
  const { root, paths } = syntheticVault(t, 4)
  const before = preservedHashes(root)
  fs.writeFileSync(actionsFile(paths), json([]))
  const actionBytes = fs.readFileSync(actionsFile(paths))
  const token = upgradePreview(paths).token
  assert.equal(token.actionsSha256, shaFile(actionsFile(paths)))
  assert.equal(token.writeSet.actionsJson, 'unchanged')
  const applied = upgradeApply(paths, envelope(token, 'empty-actions'))
  assert.equal(applied.schemaChanged, true)
  assert.deepEqual(fs.readFileSync(actionsFile(paths)), actionBytes)
  assert.equal(readManifest(paths).schema_version, 5)
  assert.equal(readManifest(paths).counts.actions, 0)
  assert.deepEqual(preservedHashes(root), before)
})

test('replay returns the stored upgrade before token comparison and reports currentRecovery', t => {
  const { root, paths } = syntheticVault(t, 4)
  const before = preservedHashes(root)
  const input = envelope(upgradePreview(paths).token, 'replay-key')
  const applied = upgradeApply(paths, input)
  assert.equal(applied.schemaChanged, true)
  assert.deepEqual(applied.recovery, { performed: false, journals: 0 })
  const ledgerBytes = fs.readFileSync(paths.ledgerPath)
  const stored = JSON.parse(ledgerBytes.toString('utf8')).entries['replay-key'].result
  fs.appendFileSync(paths.auditPath, '{"schemaVersion":1,"at":"2021-01-01T00:00:00.000Z","command":"fingerprint-only"}\n')
  const tamperedAudit = fs.readFileSync(paths.auditPath)
  const marker = markerFile(root)
  fs.writeFileSync(marker, 'live\n')
  plantJournal(paths, { name: 'other-journal.json', preimages: [preimage(marker, true, 'restored\n')] })
  const replay = upgradeApply(paths, input)
  assert.equal(replay.replayed, true)
  assert.equal(replay.schemaChanged, true)
  assert.equal(replay.recovery.performed, false)
  assert.deepEqual(replay.recovery, stored.recovery)
  assert.deepEqual(replay.currentRecovery, { performed: true, journals: 1 })
  assert.equal(fs.readFileSync(marker, 'utf8'), 'restored\n')
  assert.deepEqual(fs.readFileSync(paths.ledgerPath), ledgerBytes)
  assert.deepEqual(fs.readFileSync(paths.auditPath), tamperedAudit)
  assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(paths.ledgerPath, 'utf8')).entries['replay-key'].result, 'currentRecovery'), false)
  assert.deepEqual(JSON.parse(fs.readFileSync(paths.ledgerPath, 'utf8')).entries['replay-key'].result, stored)
  assert.equal(readManifest(paths).schema_version, 5)
  assert.deepEqual(preservedHashes(root), before)
  assert.equal(domainJournals(paths).length, 0)
  const follow = upgradeRecover(paths)
  assert.equal(follow.status, 'ok')
  assert.equal(follow.schemaChanged, false)
  assert.equal(follow.currentRecovery, undefined)
  assertRecovery(follow.recovery, 0)
  assert.equal(fs.readFileSync(marker, 'utf8'), 'restored\n')
  assert.deepEqual(fs.readFileSync(paths.ledgerPath), ledgerBytes)
})

test('a reused key with a different digest writes nothing', t => {
  const { root, paths } = syntheticVault(t, 4)
  const input = envelope(upgradePreview(paths).token, 'conflict-key')
  assert.equal(upgradeApply(paths, input).schemaChanged, true)
  const frozen = {
    career: preservedHashes(root),
    manifest: fs.readFileSync(path.join(paths.recordsDir, 'manifest.json')),
    actions: fs.readFileSync(actionsFile(paths)),
    audit: fs.readFileSync(paths.auditPath),
    ledger: fs.readFileSync(paths.ledgerPath)
  }
  expectCode(() => upgradeApply(paths, { ...input, requestId: 'conflict-other' }), 'IDEMPOTENCY_CONFLICT', { recovery: { performed: false, journals: 0 } })
  assert.deepEqual(preservedHashes(root), frozen.career)
  assert.deepEqual(fs.readFileSync(path.join(paths.recordsDir, 'manifest.json')), frozen.manifest)
  assert.deepEqual(fs.readFileSync(actionsFile(paths)), frozen.actions)
  assert.deepEqual(fs.readFileSync(paths.auditPath), frozen.audit)
  assert.deepEqual(fs.readFileSync(paths.ledgerPath), frozen.ledger)
  assert.equal(fs.existsSync(paths.lockPath), false)
})

test('a conflicting key after recovery does not write schema', t => {
  const { root, paths } = syntheticVault(t, 4)
  const before = preservedHashes(root)
  const token = upgradePreview(paths).token
  fs.mkdirSync(path.dirname(paths.ledgerPath), { recursive: true })
  fs.writeFileSync(paths.ledgerPath, json({ schemaVersion: 1, entries: { 'planted-key': { digest: 'f'.repeat(64), result: { schemaVersion: 1, status: 'applied', schemaChanged: true, recovery: { performed: false, journals: 0 } } } } }))
  const ledgerBytes = fs.readFileSync(paths.ledgerPath)
  const marker = markerFile(root)
  fs.writeFileSync(marker, 'live\n')
  plantJournal(paths, { preimages: [preimage(marker, true, 'restored\n')] })
  expectCode(() => upgradeApply(paths, envelope(token, 'planted-key')), 'IDEMPOTENCY_CONFLICT', { recovery: { performed: true, journals: 1 } })
  assert.equal(fs.readFileSync(marker, 'utf8'), 'restored\n')
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.deepEqual(fs.readFileSync(paths.ledgerPath), ledgerBytes)
  assert.deepEqual(preservedHashes(root), before)
  assert.equal(domainJournals(paths).length, 0)
})

test('an abrupt stop before the actions rename leaves a prepared journal and retry is a fresh apply', t => {
  const { root, paths } = syntheticVault(t, 4)
  const before = preservedHashes(root)
  const historical = fs.readFileSync(paths.auditPath)
  const input = envelope(upgradePreview(paths).token, 'before-actions')
  expectCode(() => upgradeApply(paths, input, { onPhase: crash('before-actions-rename') }), 'INTERRUPTED', { phase: 'before-actions-rename' })
  assert.equal(domainJournals(paths).length, 1)
  assert.equal(JSON.parse(fs.readFileSync(domainJournals(paths)[0], 'utf8')).state, 'prepared')
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(fs.existsSync(paths.lockPath), false)
  const recovered = upgradeRecover(paths)
  assert.equal(recovered.status, 'ok')
  assert.equal(recovered.schemaChanged, false)
  assert.equal(recovered.currentRecovery, undefined)
  assertRecovery(recovered.recovery, 1)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.deepEqual(fs.readFileSync(paths.auditPath), historical)
  assert.deepEqual(preservedHashes(root), before)
  const retried = upgradeApply(paths, input)
  assert.equal(retried.replayed, undefined)
  assert.equal(retried.schemaChanged, true)
  assertRecovery(retried.recovery, 0)
  assert.equal(readManifest(paths).schema_version, 5)
  assert.equal(fs.readFileSync(actionsFile(paths), 'utf8'), '[]\n')
  assert.deepEqual(preservedHashes(root), before)
})

test('an abrupt stop after the actions rename deletes the new file on recovery', t => {
  const { root, paths } = syntheticVault(t, 4)
  const before = preservedHashes(root)
  const input = envelope(upgradePreview(paths).token, 'after-actions')
  expectCode(() => upgradeApply(paths, input, { onPhase: crash('after-actions-rename') }), 'INTERRUPTED', { phase: 'after-actions-rename' })
  assert.equal(JSON.parse(fs.readFileSync(domainJournals(paths)[0], 'utf8')).state, 'prepared')
  assert.equal(fs.existsSync(actionsFile(paths)), true)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  const recovered = upgradeRecover(paths)
  assertRecovery(recovered.recovery, 1)
  assert.equal(recovered.schemaChanged, false)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.deepEqual(preservedHashes(root), before)
  assert.equal(domainJournals(paths).length, 0)
})

function assertPreparedLedgerCrash(t, phase) {
  const { root, paths } = syntheticVault(t, 4)
  const before = preservedHashes(root)
  const historical = fs.readFileSync(paths.auditPath)
  const input = envelope(upgradePreview(paths).token, `ledger-${phase}`)
  expectCode(() => upgradeApply(paths, input, { onPhase: crash(phase) }), 'INTERRUPTED', { phase })
  assert.equal(domainJournals(paths).length, 1)
  assert.equal(JSON.parse(fs.readFileSync(domainJournals(paths)[0], 'utf8')).state, 'prepared')
  assert.equal(readManifest(paths).schema_version, 5)
  assert.equal(fs.readFileSync(actionsFile(paths), 'utf8'), '[]\n')
  assert.equal(JSON.parse(fs.readFileSync(paths.ledgerPath, 'utf8')).entries[input.idempotencyKey].result.schemaChanged, true)
  assert.equal(fs.existsSync(paths.lockPath), false)
  const recovered = upgradeRecover(paths)
  assert.equal(recovered.status, 'ok')
  assert.equal(recovered.schemaChanged, false)
  assert.notEqual(recovered.replayed, true)
  assert.equal(recovered.currentRecovery, undefined)
  assertRecovery(recovered.recovery, 1)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.deepEqual(fs.readFileSync(paths.auditPath), historical)
  assert.deepEqual(preservedHashes(root), before)
  assert.equal(domainJournals(paths).length, 0)
  const retried = upgradeApply(paths, input)
  assert.equal(retried.replayed, undefined)
  assert.equal(retried.schemaChanged, true)
  assertRecovery(retried.recovery, 0)
  assert.equal(readManifest(paths).schema_version, 5)
  assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(paths.ledgerPath, 'utf8')).entries[input.idempotencyKey].result, 'replayed'), false)
  assert.deepEqual(preservedHashes(root), before)
}

test('an abrupt stop after ledger publication rolls the ledger back and does not report success', t => {
  assertPreparedLedgerCrash(t, 'after-ledger-publication')
})

test('an abrupt stop before the committed marker rolls the ledger back and does not report success', t => {
  assertPreparedLedgerCrash(t, 'before-committed-marker')
})

test('a thrown error before the committed marker rolls back in the same call', t => {
  const { root, paths } = syntheticVault(t, 4)
  const before = preservedHashes(root)
  const historical = fs.readFileSync(paths.auditPath)
  const input = envelope(upgradePreview(paths).token, 'handled-rollback')
  expectCode(() => upgradeApply(paths, input, { onPhase: phase => { if (phase === 'after-ledger-publication') throw Object.assign(new Error('injected rollback'), { code: 'INJECTED' }) } }), 'INJECTED')
  assert.equal(domainJournals(paths).length, 0)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.deepEqual(fs.readFileSync(paths.auditPath), historical)
  assert.deepEqual(preservedHashes(root), before)
  assert.equal(fs.existsSync(paths.lockPath), false)
})

test('an abrupt stop after the committed marker keeps the publication and replays it', t => {
  const { root, paths } = syntheticVault(t, 4)
  const before = preservedHashes(root)
  const historical = fs.readFileSync(paths.auditPath)
  const input = envelope(upgradePreview(paths).token, 'after-commit')
  expectCode(() => upgradeApply(paths, input, { onPhase: crash('after-committed-marker') }), 'INTERRUPTED', { phase: 'after-committed-marker' })
  assert.equal(domainJournals(paths).length, 1)
  assert.equal(JSON.parse(fs.readFileSync(domainJournals(paths)[0], 'utf8')).state, 'committed')
  assert.equal(readManifest(paths).schema_version, 5)
  assert.equal(fs.readFileSync(actionsFile(paths), 'utf8'), '[]\n')
  const ledgerBytes = fs.readFileSync(paths.ledgerPath)
  const auditBytes = fs.readFileSync(paths.auditPath)
  const stored = JSON.parse(ledgerBytes.toString('utf8')).entries['after-commit'].result
  assert.equal(stored.schemaChanged, true)
  assert.deepEqual(stored.recovery, { performed: false, journals: 0 })
  assert.equal(Object.hasOwn(stored, 'currentRecovery'), false)
  assert.deepEqual(auditBytes.subarray(0, historical.length), historical)
  assert.deepEqual(preservedHashes(root), before)
  const replay = upgradeApply(paths, input)
  assert.equal(replay.replayed, true)
  assert.equal(replay.schemaChanged, true)
  assert.deepEqual(replay.recovery, stored.recovery)
  assert.deepEqual(replay.currentRecovery, { performed: true, journals: 1 })
  assert.equal(domainJournals(paths).length, 0)
  assert.deepEqual(fs.readFileSync(paths.ledgerPath), ledgerBytes)
  assert.deepEqual(fs.readFileSync(paths.auditPath), auditBytes)
  assert.equal(readManifest(paths).schema_version, 5)
  assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(paths.ledgerPath, 'utf8')).entries['after-commit'].result, 'currentRecovery'), false)
  assert.deepEqual(preservedHashes(root), before)
})

test('journal deletion failure after the marker preserves publication and replay drops the committed journal', t => {
  const { root, paths } = syntheticVault(t, 4)
  const before = preservedHashes(root)
  const input = envelope(upgradePreview(paths).token, 'cleanup-failed')
  expectCode(() => upgradeApply(paths, input, { onPhase: phase => { if (phase === 'journal-delete') throw Object.assign(new Error('delete failed'), { code: 'INJECTED_CLEANUP' }) } }), 'JOURNAL_CLEANUP_FAILED', { committed: true, publication: 'preserved', journalState: 'committed' })
  assert.equal(domainJournals(paths).length, 1)
  assert.equal(JSON.parse(fs.readFileSync(domainJournals(paths)[0], 'utf8')).state, 'committed')
  assert.equal(readManifest(paths).schema_version, 5)
  assert.equal(fs.readFileSync(actionsFile(paths), 'utf8'), '[]\n')
  const ledgerBytes = fs.readFileSync(paths.ledgerPath)
  assert.equal(JSON.parse(ledgerBytes.toString('utf8')).entries['cleanup-failed'].result.schemaChanged, true)
  assert.deepEqual(preservedHashes(root), before)
  assert.equal(fs.existsSync(paths.lockPath), false)
  const replay = upgradeApply(paths, input)
  assert.equal(replay.replayed, true)
  assert.equal(replay.schemaChanged, true)
  assert.deepEqual(replay.currentRecovery, { performed: true, journals: 1 })
  assert.equal(domainJournals(paths).length, 0)
  assert.deepEqual(fs.readFileSync(paths.ledgerPath), ledgerBytes)
  assert.equal(readManifest(paths).schema_version, 5)
  assert.deepEqual(preservedHashes(root), before)
})

test('cleanup failure after an earlier recovery reports that recovery and still preserves publication', t => {
  const { root, paths } = syntheticVault(t, 4)
  const before = preservedHashes(root)
  const marker = markerFile(root)
  const token = upgradePreview(paths).token
  fs.writeFileSync(marker, 'live\n')
  plantJournal(paths, { name: 'a-prior.json', preimages: [preimage(marker, true, 'restored\n')] })
  const input = envelope(token, 'cleanup-after-recovery')
  let seen
  expectCode(() => upgradeApply(paths, input, { onPhase: phase => { if (phase === 'journal-delete') throw Object.assign(new Error('delete failed'), { code: 'INJECTED_CLEANUP' }) } }), 'JOURNAL_CLEANUP_FAILED', { committed: true, publication: 'preserved', journalState: 'committed', recovery: { performed: true, journals: 1 } })
  seen = JSON.parse(fs.readFileSync(domainJournals(paths)[0], 'utf8'))
  assert.equal(domainJournals(paths).length, 1)
  assert.equal(seen.state, 'committed')
  assert.equal(fs.readFileSync(marker, 'utf8'), 'restored\n')
  assert.equal(readManifest(paths).schema_version, 5)
  assert.equal(fs.existsSync(path.join(paths.journalDir, 'a-prior.json')), false)
  assert.deepEqual(preservedHashes(root), before)
  const replay = upgradeApply(paths, input)
  assert.equal(replay.replayed, true)
  assert.deepEqual(replay.recovery, { performed: true, journals: 1 })
  assert.deepEqual(replay.currentRecovery, { performed: true, journals: 1 })
  assert.equal(readManifest(paths).schema_version, 5)
  assert.equal(fs.readFileSync(marker, 'utf8'), 'restored\n')
  assert.equal(domainJournals(paths).length, 0)
  assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(paths.ledgerPath, 'utf8')).entries['cleanup-after-recovery'].result, 'currentRecovery'), false)
})

test('a stale token writes no schema, and recovery is reported when it already ran', t => {
  const stale = syntheticVault(t, 4)
  const token = upgradePreview(stale.paths).token
  fs.appendFileSync(stale.paths.auditPath, '{"schemaVersion":1,"command":"tamper"}\n')
  expectCode(() => upgradeApply(stale.paths, envelope(token, 'stale')), 'STALE_REVISION', { recovery: { performed: false, journals: 0 } })
  assert.equal(readManifest(stale.paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(stale.paths)), false)
  assert.equal(fs.existsSync(stale.paths.ledgerPath), false)

  const { root, paths } = syntheticVault(t, 4)
  const before = preservedHashes(root)
  const current = upgradePreview(paths).token
  const historical = fs.readFileSync(paths.auditPath)
  plantJournal(paths, { preimages: [preimage(paths.auditPath, true, 'tampered-audit\n')] })
  expectCode(() => upgradeApply(paths, envelope(current, 'stale-after-recovery')), 'STALE_REVISION', { recovery: { performed: true, journals: 1 } })
  assert.equal(fs.readFileSync(paths.auditPath, 'utf8'), 'tampered-audit\n')
  assert.notEqual(fs.readFileSync(paths.auditPath, 'utf8'), historical.toString('utf8'))
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(domainJournals(paths).length, 0)
  assert.deepEqual(preservedHashes(root), before)

  const upgraded = syntheticVault(t, 4)
  const old = upgradePreview(upgraded.paths).token
  assert.equal(upgradeApply(upgraded.paths, envelope(old, 'already')).schemaChanged, true)
  const ledger = fs.readFileSync(upgraded.paths.ledgerPath)
  expectCode(() => upgradeApply(upgraded.paths, envelope(old, 'new-key-old-token')), 'STALE_REVISION', { recovery: { performed: false, journals: 0 } })
  assert.deepEqual(fs.readFileSync(upgraded.paths.ledgerPath), ledger)
  assert.equal(readManifest(upgraded.paths).schema_version, 5)
})

test('dry-run beside a prepared journal writes nothing and does not recover', async t => {
  const { root, paths } = syntheticVault(t, 4)
  const before = preservedHashes(root)
  const token = upgradePreview(paths).token
  const marker = markerFile(root)
  fs.writeFileSync(marker, 'live\n')
  const journal = plantJournal(paths, { preimages: [preimage(marker, true, 'restored\n')] })
  const journalBytes = fs.readFileSync(journal)
  const dry = upgradeApply({ ...paths, dryRun: true }, envelope(token, 'dry-run'))
  assert.equal(dry.status, 'dry_run')
  assert.equal(dry.dryRun, true)
  assert.equal(dry.schemaChanged, false)
  assert.equal(dry.currentRecovery, undefined)
  assertRecovery(dry.recovery, 0)
  assert.equal(fs.readFileSync(marker, 'utf8'), 'live\n')
  assert.deepEqual(fs.readFileSync(journal), journalBytes)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(fs.existsSync(paths.lockPath), false)
  assert.deepEqual(preservedHashes(root), before)
  const body = holdLock(paths)
  const held = upgradeApply({ ...paths, dryRun: true }, envelope(token, 'dry-held'))
  assert.equal(held.status, 'dry_run')
  assert.equal(fs.readFileSync(paths.lockPath, 'utf8'), body)
  const input = path.join(root, 'dry.json')
  fs.writeFileSync(input, JSON.stringify(envelope(token, 'dry-cli')))
  const buffers = ioBuffers()
  assert.equal(await main(['model', 'upgrade-apply', '--data-root', root, '--input', input, '--dry-run', '--json'], { ...buffers.io, cwd: root, env: process.env }), 0)
  assert.equal(JSON.parse(buffers.buffers.out).status, 'dry_run')
  assert.deepEqual(fs.readFileSync(journal), journalBytes)
  fs.rmSync(paths.lockPath)
})

test('apply and recover-only stay busy while the commit lock is held', t => {
  const { paths } = syntheticVault(t, 4)
  const token = upgradePreview(paths).token
  const body = holdLock(paths)
  expectCode(() => upgradeApply(paths, envelope(token, 'busy')), 'COMMIT_BUSY')
  expectCode(() => upgradeRecover(paths), 'COMMIT_BUSY')
  assert.equal(fs.readFileSync(paths.lockPath, 'utf8'), body)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
})

test('recover-only restores a prepared journal, drops a committed journal, and leaves schema v4', t => {
  const { root, paths } = syntheticVault(t, 4)
  const before = preservedHashes(root)
  const historical = fs.readFileSync(paths.auditPath)
  const manifest = fs.readFileSync(path.join(paths.recordsDir, 'manifest.json'))
  const marker = markerFile(root)
  fs.writeFileSync(marker, 'live\n')
  plantJournal(paths, { name: 'prepared.json', preimages: [preimage(marker, true, 'restored\n')] })
  const prepared = upgradeRecover(paths)
  assert.equal(prepared.status, 'ok')
  assert.equal(prepared.schemaChanged, false)
  assert.equal(prepared.currentRecovery, undefined)
  assertRecovery(prepared.recovery, 1)
  assert.equal(fs.readFileSync(marker, 'utf8'), 'restored\n')
  assert.equal(domainJournals(paths).length, 0)
  assert.deepEqual(fs.readFileSync(paths.auditPath), historical)
  assert.deepEqual(fs.readFileSync(path.join(paths.recordsDir, 'manifest.json')), manifest)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.deepEqual(preservedHashes(root), before)
  const repeat = upgradeRecover(paths)
  assertRecovery(repeat.recovery, 0)
  assert.equal(repeat.schemaChanged, false)

  fs.writeFileSync(marker, 'current\n')
  plantJournal(paths, { name: 'committed.json', state: 'committed', preimages: [preimage(marker, true, 'old\n')] })
  const dropped = upgradeRecover(paths)
  assertRecovery(dropped.recovery, 1)
  assert.equal(dropped.schemaChanged, false)
  assert.equal(fs.readFileSync(marker, 'utf8'), 'current\n')
  assert.equal(domainJournals(paths).length, 0)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.deepEqual(fs.readFileSync(paths.auditPath), historical)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
})

test('recover-only does not treat a ledger row from a prepared journal as success', t => {
  const { paths } = syntheticVault(t, 4)
  fs.mkdirSync(paths.journalDir, { recursive: true })
  fs.writeFileSync(paths.ledgerPath, json({ schemaVersion: 1, entries: { ghost: { digest: 'ab', result: { status: 'applied', schemaChanged: true, recovery: { performed: false, journals: 0 } } } } }))
  plantJournal(paths, { preimages: [preimage(paths.ledgerPath, false, '')] })
  const result = upgradeRecover(paths)
  assert.equal(result.status, 'ok')
  assert.equal(result.schemaChanged, false)
  assert.notEqual(result.replayed, true)
  assert.equal(result.currentRecovery, undefined)
  assertRecovery(result.recovery, 1)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(domainJournals(paths).length, 0)
})

test('a later unsafe journal leaves an earlier safe journal unrestored', t => {
  const { root, paths } = syntheticVault(t, 4)
  const before = preservedHashes(root)
  const token = upgradePreview(paths).token
  const marker = markerFile(root)
  fs.writeFileSync(marker, 'live\n')
  const safe = plantJournal(paths, { name: 'a-safe.json', preimages: [preimage(marker, true, 'restored\n')] })
  const safeBytes = fs.readFileSync(safe)
  const escape = path.join(os.tmpdir(), `nextstep-escape-${crypto.randomUUID()}`)
  const unsafe = plantJournal(paths, { name: 'z-unsafe.json', preimages: [preimage(escape, true, 'x')] })
  expectCode(() => upgradeApply(paths, envelope(token, 'unsafe-apply')), 'UNSAFE_JOURNAL', { reason: 'unsafe' })
  expectCode(() => upgradeRecover(paths), 'UNSAFE_JOURNAL', { reason: 'unsafe' })
  assert.equal(fs.readFileSync(marker, 'utf8'), 'live\n')
  assert.deepEqual(fs.readFileSync(safe), safeBytes)
  assert.equal(fs.existsSync(unsafe), true)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.deepEqual(preservedHashes(root), before)
})

test('unreadable and unknown journals restore nothing', t => {
  const cases = [
    ['unreadable', file => fs.writeFileSync(file, '{'), 'unreadable'],
    ['unknown-state', file => fs.writeFileSync(file, json({ schemaVersion: 1, state: 'publishing', preimages: [] })), 'unknown'],
    ['unknown-shape', file => fs.writeFileSync(file, json({ schemaVersion: 2, state: 'prepared', preimages: [] })), 'unknown']
  ]
  for (const [, write, reason] of cases) {
    const { root, paths } = syntheticVault(t, 4)
    const marker = markerFile(root)
    fs.writeFileSync(marker, 'live\n')
    const safe = plantJournal(paths, { name: 'a-safe.json', preimages: [preimage(marker, true, 'restored\n')] })
    write(path.join(paths.journalDir, 'z-bad.json'))
    expectCode(() => upgradeRecover(paths), 'UNSAFE_JOURNAL', { reason })
    assert.equal(fs.readFileSync(marker, 'utf8'), 'live\n')
    assert.equal(fs.existsSync(safe), true)
    assert.equal(readManifest(paths).schema_version, 4)
    assert.equal(fs.existsSync(actionsFile(paths)), false)
  }
})

test('ordinary v4 reads still reject upgrade and write nothing', t => {
  const { root, paths } = syntheticVault(t, 4)
  const before = preservedHashes(root)
  const historical = fs.readFileSync(paths.auditPath)
  expectCode(() => get(paths, SYNTHETIC.companyId), 'VAULT_UPGRADE_REQUIRED')
  expectCode(() => doctor(paths), 'VAULT_UPGRADE_REQUIRED')
  assert.deepEqual(preservedHashes(root), before)
  assert.deepEqual(fs.readFileSync(paths.auditPath), historical)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(readManifest(paths).schema_version, 4)
})

test('upgrade routes are discoverable and recover-only usage does not recover', async t => {
  const names = routeNames()
  assert.equal(names.includes('init'), false)
  assert.equal(names.includes('model init'), false)
  assert.equal(names.includes('model downgrade'), false)
  assert.ok(names.includes('model upgrade-preview'))
  assert.ok(names.includes('model upgrade-apply'))
  const preview = commandDescription('model upgrade-preview')
  assert.equal(preview.contract.mode, 'read-only')
  assert.deepEqual(Object.keys(preview.contract.options).sort(), ['data-root', 'json'])
  assert.ok(preview.contract.invariants.some(line => /No downgrade command exists/.test(line)))
  assert.ok(preview.contract.invariants.some(line => /previous binary can force schema_version 4 and eight counts/.test(line)))
  const apply = commandDescription('model upgrade-apply')
  assert.equal(apply.contract.mode, 'mutation')
  assert.deepEqual(apply.contract.payload.required, ['token'])
  assert.ok(apply.contract.invariants.some(line => /currentRecovery/.test(line)))
  assert.match(apply.errorTaxonomy.VAULT_UPGRADE_REQUIRED, /model upgrade-preview/)
  assert.match(apply.errorTaxonomy.PENDING_JOURNAL, /preview/)
  assert.match(apply.errorTaxonomy.JOURNAL_CLEANUP_FAILED, /committed/)

  const help = ioBuffers()
  assert.equal(await main(['--help'], help.io), 0)
  assert.match(help.buffers.out, /model upgrade-preview/)
  assert.match(help.buffers.out, /model upgrade-apply --input -/)
  assert.match(help.buffers.out, /model upgrade-apply --recover-only/)

  for (const option of ['--dry-run', '--input', '--recover-only']) {
    const rejected = ioBuffers()
    const args = option === '--input' ? ['model', 'upgrade-preview', option, 'ignored.json'] : ['model', 'upgrade-preview', option]
    assert.equal(await main(args, rejected.io), 64)
    assert.equal(JSON.parse(rejected.buffers.err).error.code, 'USAGE')
  }

  const { root, paths } = syntheticVault(t, 4)
  const marker = markerFile(root)
  fs.writeFileSync(marker, 'live\n')
  const journal = plantJournal(paths, { preimages: [preimage(marker, true, 'restored\n')] })
  const journalBytes = fs.readFileSync(journal)
  const combined = ioBuffers()
  assert.equal(await main(['model', 'upgrade-apply', '--data-root', root, '--recover-only', '--input', path.join(root, 'missing.json'), '--json'], { ...combined.io, cwd: root, env: process.env }), 64)
  assert.equal(JSON.parse(combined.buffers.err).error.code, 'USAGE')
  const dryCombined = ioBuffers()
  assert.equal(await main(['model', 'upgrade-apply', '--data-root', root, '--recover-only', '--dry-run', '--json'], { ...dryCombined.io, cwd: root, env: process.env }), 64)
  assert.equal(JSON.parse(dryCombined.buffers.err).error.code, 'USAGE')
  expectCode(() => upgradeRecover({ ...paths, dryRun: true }), 'USAGE')
  assert.deepEqual(fs.readFileSync(journal), journalBytes)
  assert.equal(fs.readFileSync(marker, 'utf8'), 'live\n')
  assert.equal(readManifest(paths).schema_version, 4)

  const previewIo = ioBuffers()
  assert.equal(await main(['model', 'upgrade-preview', '--data-root', root, '--json'], { ...previewIo.io, cwd: root, env: process.env }), 1)
  assert.equal(JSON.parse(previewIo.buffers.err).error.code, 'PENDING_JOURNAL')
  fs.rmSync(journal)
  previewIo.buffers.out = ''
  previewIo.buffers.err = ''
  assert.equal(await main(['model', 'upgrade-preview', '--data-root', root, '--json'], { ...previewIo.io, cwd: root, env: process.env }), 0)
  const token = JSON.parse(previewIo.buffers.out).token
  const input = path.join(root, 'apply.json')
  fs.writeFileSync(input, JSON.stringify(envelope(token, 'cli-apply')))
  const applyIo = ioBuffers()
  assert.equal(await main(['model', 'upgrade-apply', '--data-root', root, '--input', input, '--json'], { ...applyIo.io, cwd: root, env: process.env }), 0)
  const applied = JSON.parse(applyIo.buffers.out)
  assert.equal(applied.status, 'applied')
  assert.equal(applied.schemaChanged, true)
  assert.equal(applied.currentRecovery, undefined)
  assert.equal(readManifest(paths).schema_version, 5)
  assert.equal(fs.readFileSync(actionsFile(paths), 'utf8'), '[]\n')
  assert.equal(domainJournals(paths).length, 0)

  const described = ioBuffers()
  assert.equal(await main(['command', 'describe', '--command', 'model upgrade-apply', '--json'], described.io), 0)
  assert.equal(JSON.parse(described.buffers.out).command, 'model upgrade-apply')
})

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
import { applyTransaction, listDomainJournalFiles } from '../src/storage.mjs'
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

const idleRecovery = { performed: false, journals: 0 }

function outsideSentinel(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-outside-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'sentinel.md')
  const bytes = Buffer.from('sentinel-bytes')
  fs.writeFileSync(file, bytes)
  return { dir, file, bytes }
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
  expectCode(() => upgradeApply(paths, input, { onPhase: crash('before-actions-rename') }), 'INTERRUPTED', { phase: 'before-actions-rename', recovery: idleRecovery })
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
  expectCode(() => upgradeApply(paths, input, { onPhase: crash('after-actions-rename') }), 'INTERRUPTED', { phase: 'after-actions-rename', recovery: idleRecovery })
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
  expectCode(() => upgradeApply(paths, input, { onPhase: crash(phase) }), 'INTERRUPTED', { phase, recovery: idleRecovery })
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
  expectCode(() => upgradeApply(paths, input, { onPhase: crash('after-committed-marker') }), 'INTERRUPTED', { phase: 'after-committed-marker', recovery: idleRecovery })
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
  expectCode(() => upgradeApply(paths, input, { onPhase: phase => { if (phase === 'journal-delete') throw Object.assign(new Error('delete failed'), { code: 'INJECTED_CLEANUP' }) } }), 'JOURNAL_CLEANUP_FAILED', { committed: true, publication: 'preserved', journalState: 'committed', recovery: idleRecovery })
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
  assert.match(apply.errorTaxonomy.UNSAFE_JOURNAL, /whole set/)
  assert.match(apply.errorTaxonomy.UNSAFE_JOURNAL, /before any restore/)
  assert.ok(apply.contract.invariants.some(line => /whole set before any restore/.test(line)))

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

function rewriteCompanyId(paths, id) {
  for (const type of ['companies', 'opportunities', 'people', 'interactions']) {
    const file = path.join(paths.recordsDir, RECORD_FILES[type])
    const records = JSON.parse(fs.readFileSync(file, 'utf8'))
    for (const record of records) {
      if (typeof record.id === 'string' && record.id.startsWith('company:')) record.id = id
      if (record.company_id) record.company_id = id
    }
    fs.writeFileSync(file, json(records))
  }
}

test('projected index paths cannot escape the vault through ids or a linked indexes directory', t => {
  const escaped = syntheticVault(t, 4)
  const sentinel = outsideSentinel(t)
  const slug = path.relative(path.join(escaped.paths.indexesDir, 'companies'), sentinel.file).split(path.sep).join('/')
  assert.equal(slug.endsWith('/sentinel.md'), true)
  const rendered = `companies/${slug.slice(0, -'.md'.length)}.md`
  assert.equal(path.resolve(escaped.paths.indexesDir, rendered), sentinel.file)
  rewriteCompanyId(escaped.paths, `company:${slug.slice(0, -'.md'.length)}`)
  expectCode(() => upgradePreview(escaped.paths), 'UNSAFE_PATH')
  expectCode(() => upgradeApply(escaped.paths, envelope({ schemaVersion: 1 }, 'escape-apply')), 'UNSAFE_PATH', { recovery: idleRecovery })
  assert.deepEqual(fs.readFileSync(sentinel.file), sentinel.bytes)
  assert.equal(readManifest(escaped.paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(escaped.paths)), false)
  assert.equal(fs.existsSync(escaped.paths.lockPath), false)

  const linked = syntheticVault(t, 4)
  const outside = outsideSentinel(t)
  fs.symlinkSync(outside.dir, linked.paths.indexesDir)
  expectCode(() => upgradePreview(linked.paths), 'UNSAFE_PATH')
  expectCode(() => upgradeApply(linked.paths, envelope({ schemaVersion: 1 }, 'linked-indexes')), 'UNSAFE_PATH', { recovery: idleRecovery })
  assert.deepEqual(fs.readdirSync(outside.dir), ['sentinel.md'])
  assert.deepEqual(fs.readFileSync(outside.file), outside.bytes)
  assert.equal(readManifest(linked.paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(linked.paths)), false)
})

test('journal directory and journal file links are rejected before any restore', t => {
  const fileLink = syntheticVault(t, 4)
  const sentinel = outsideSentinel(t)
  const marker = markerFile(fileLink.root)
  fs.writeFileSync(marker, 'live\n')
  const safe = plantJournal(fileLink.paths, { name: 'a-safe.json', preimages: [preimage(marker, true, 'restored\n')] })
  const safeBytes = fs.readFileSync(safe)
  const outsideJournal = path.join(sentinel.dir, 'outside-journal.json')
  fs.writeFileSync(outsideJournal, json({ schemaVersion: 1, id: 'outside', requestId: 'outside', state: 'prepared', preimages: [preimage(sentinel.file, true, 'pwned\n')] }))
  const outsideBytes = fs.readFileSync(outsideJournal)
  fs.symlinkSync(outsideJournal, path.join(fileLink.paths.journalDir, 'z-link.json'))
  expectCode(() => upgradePreview(fileLink.paths), 'PENDING_JOURNAL', { recoverCommand: 'model upgrade-apply --recover-only' })
  expectCode(() => upgradeApply(fileLink.paths, envelope({ schemaVersion: 1 }, 'journal-link')), 'UNSAFE_JOURNAL', { reason: 'unsafe' })
  expectCode(() => upgradeRecover(fileLink.paths), 'UNSAFE_JOURNAL', { reason: 'unsafe' })
  assert.equal(fs.readFileSync(marker, 'utf8'), 'live\n')
  assert.deepEqual(fs.readFileSync(safe), safeBytes)
  assert.deepEqual(fs.readFileSync(outsideJournal), outsideBytes)
  assert.deepEqual(fs.readFileSync(sentinel.file), sentinel.bytes)
  assert.equal(readManifest(fileLink.paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(fileLink.paths)), false)

  const dirLink = syntheticVault(t, 4)
  const outside = outsideSentinel(t)
  fs.writeFileSync(path.join(outside.dir, 'pending.json'), json({ schemaVersion: 1, id: 'pending', requestId: 'pending', state: 'prepared', preimages: [preimage(outside.file, true, 'pwned\n')] }))
  const listing = fs.readdirSync(outside.dir).sort()
  fs.mkdirSync(path.dirname(dirLink.paths.journalDir), { recursive: true })
  fs.symlinkSync(outside.dir, dirLink.paths.journalDir)
  expectCode(() => upgradePreview(dirLink.paths), 'UNSAFE_JOURNAL', { reason: 'unsafe' })
  expectCode(() => upgradeRecover(dirLink.paths), 'UNSAFE_JOURNAL', { reason: 'unsafe' })
  assert.deepEqual(fs.readdirSync(outside.dir).sort(), listing)
  assert.deepEqual(fs.readFileSync(outside.file), outside.bytes)
  assert.equal(readManifest(dirLink.paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(dirLink.paths)), false)
})

test('a later malformed preimage does not restore an earlier journal', t => {
  const cases = [
    {
      name: 'invalid-base64',
      reason: 'unknown',
      write(paths, root) {
        const target = path.join(root, 'Candidatures', 'created-by-bug.txt')
        fs.writeFileSync(path.join(paths.journalDir, 'z-bad.json'), json({ schemaVersion: 1, id: 'z-bad', requestId: 'z-bad', state: 'prepared', preimages: [{ file: target, existed: false, data: '%%%' }] }))
        return target
      },
      assertTarget(target) { assert.equal(fs.existsSync(target), false) }
    },
    {
      name: 'directory-target',
      reason: 'unsafe',
      write(paths, root) {
        const target = path.join(root, 'Candidatures', 'target-dir')
        fs.mkdirSync(target)
        plantJournal(paths, { name: 'z-bad.json', preimages: [preimage(target, true, 'x')] })
        return target
      },
      assertTarget(target) { assert.equal(fs.statSync(target).isDirectory(), true) }
    },
    {
      name: 'file-parent',
      reason: 'unsafe',
      write(paths, root) {
        const parent = path.join(root, 'Candidatures', 'not-a-directory')
        fs.writeFileSync(parent, 'parent-bytes')
        const target = path.join(parent, 'child.txt')
        plantJournal(paths, { name: 'z-bad.json', preimages: [preimage(target, false, 'x')] })
        return parent
      },
      assertTarget(target) { assert.equal(fs.readFileSync(target, 'utf8'), 'parent-bytes') }
    }
  ]
  for (const item of cases) {
    const { root, paths } = syntheticVault(t, 4)
    const sentinel = outsideSentinel(t)
    const marker = markerFile(root)
    fs.writeFileSync(marker, 'live\n')
    const safe = plantJournal(paths, { name: 'a-safe.json', preimages: [preimage(marker, true, 'restored\n')] })
    const safeBytes = fs.readFileSync(safe)
    const target = item.write(paths, root)
    expectCode(() => upgradeRecover(paths), 'UNSAFE_JOURNAL', { reason: item.reason })
    expectCode(() => upgradeApply(paths, envelope({ schemaVersion: 1 }, item.name)), 'UNSAFE_JOURNAL', { reason: item.reason })
    assert.equal(fs.readFileSync(marker, 'utf8'), 'live\n')
    assert.deepEqual(fs.readFileSync(safe), safeBytes)
    item.assertTarget(target)
    assert.deepEqual(fs.readFileSync(sentinel.file), sentinel.bytes)
    assert.equal(readManifest(paths).schema_version, 4)
    assert.equal(fs.existsSync(actionsFile(paths)), false)
    assert.equal(fs.existsSync(paths.ledgerPath), false)
  }
})

test('historical links are fingerprinted when contained and rejected when they escape', t => {
  const contained = syntheticVault(t, 4)
  const sentinel = outsideSentinel(t)
  const versions = path.join(contained.paths.artifactsDir, '.versions')
  const target = path.join(versions, 'contained-target.md')
  fs.writeFileSync(target, 'historical-v1')
  const link = path.join(versions, 'contained-link.md')
  fs.symlinkSync(target, link)
  fs.mkdirSync(contained.paths.indexesDir, { recursive: true })
  const indexTarget = path.join(contained.paths.indexesDir, 'real.md')
  fs.writeFileSync(indexTarget, 'index-v1')
  const token = upgradePreview(contained.paths).token
  const linkKey = 'Candidatures/artifacts/.versions/contained-link.md'
  assert.equal(token.snapshotAndTransmissionSha256[linkKey], shaFile(target))
  assert.equal(token.currentIndexSha256['real.md'], shaFile(indexTarget))
  fs.writeFileSync(target, 'historical-v2')
  fs.writeFileSync(indexTarget, 'index-v2')
  expectCode(() => upgradeApply(contained.paths, envelope(token, 'linked-drift')), 'STALE_REVISION', { recovery: idleRecovery })
  assert.equal(readManifest(contained.paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(contained.paths)), false)
  assert.equal(fs.readFileSync(target, 'utf8'), 'historical-v2')
  assert.deepEqual(fs.readFileSync(sentinel.file), sentinel.bytes)

  const escapedSnapshot = syntheticVault(t, 4)
  const outsideSnapshot = outsideSentinel(t)
  fs.symlinkSync(outsideSnapshot.file, path.join(escapedSnapshot.paths.artifactsDir, '.versions', 'escape.md'))
  expectCode(() => upgradePreview(escapedSnapshot.paths), 'UNSAFE_PATH')
  assert.deepEqual(fs.readFileSync(outsideSnapshot.file), outsideSnapshot.bytes)
  assert.equal(readManifest(escapedSnapshot.paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(escapedSnapshot.paths)), false)

  const escapedIndex = syntheticVault(t, 4)
  const outsideIndex = outsideSentinel(t)
  fs.mkdirSync(escapedIndex.paths.indexesDir, { recursive: true })
  fs.symlinkSync(outsideIndex.dir, path.join(escapedIndex.paths.indexesDir, 'escape-dir'))
  expectCode(() => upgradePreview(escapedIndex.paths), 'UNSAFE_PATH')
  assert.deepEqual(fs.readdirSync(outsideIndex.dir), ['sentinel.md'])
  assert.deepEqual(fs.readFileSync(outsideIndex.file), outsideIndex.bytes)
  assert.equal(readManifest(escapedIndex.paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(escapedIndex.paths)), false)
})

test('envelope ids and actor are enforced before recovery', t => {
  const { root, paths } = syntheticVault(t, 4)
  const sentinel = outsideSentinel(t)
  const marker = markerFile(root)
  fs.writeFileSync(marker, 'live\n')
  const journal = plantJournal(paths, { preimages: [preimage(marker, true, 'restored\n')] })
  const journalBytes = fs.readFileSync(journal)
  const token = { schemaVersion: 1 }
  expectCode(() => upgradeApply(paths, { schemaVersion: 1, requestId: 7, idempotencyKey: 8, payload: { token } }), 'INVALID_ENVELOPE')
  expectCode(() => upgradeApply(paths, { schemaVersion: 1, requestId: 'typed', idempotencyKey: 'typed', actor: 4, payload: { token } }), 'INVALID_ENVELOPE')
  expectCode(() => upgradeApply(paths, { schemaVersion: 1, requestId: 'null-actor', idempotencyKey: 'null-actor', actor: null, payload: { token } }), 'INVALID_ENVELOPE')
  assert.equal(fs.readFileSync(marker, 'utf8'), 'live\n')
  assert.deepEqual(fs.readFileSync(journal), journalBytes)
  assert.deepEqual(fs.readFileSync(sentinel.file), sentinel.bytes)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(fs.existsSync(paths.lockPath), false)
})

test('apply appends the audit line without rewriting the prefix bytes', t => {
  const { paths } = syntheticVault(t, 4)
  const prefix = Buffer.from('7b7d0aff0a', 'hex')
  fs.writeFileSync(paths.auditPath, prefix)
  const token = upgradePreview(paths).token
  assert.equal(token.auditPrefixSha256, shaFile(paths.auditPath))
  const applied = upgradeApply(paths, envelope(token, 'binary-audit'))
  assert.equal(applied.schemaChanged, true)
  const audit = fs.readFileSync(paths.auditPath)
  assert.deepEqual(audit.subarray(0, prefix.length), prefix)
  assert.equal(audit[3], 0xff)
  const added = JSON.parse(audit.subarray(prefix.length).toString('utf8'))
  assert.equal(added.command, 'model.upgradeApply')
  assert.equal(added.requestId, 'binary-audit')
  assert.equal(readManifest(paths).schema_version, 5)
})

test('a publication error after recovery keeps that recovery on the error', t => {
  const { root, paths } = syntheticVault(t, 4)
  const sentinel = outsideSentinel(t)
  const token = upgradePreview(paths).token
  const marker = markerFile(root)
  fs.writeFileSync(marker, 'live\n')
  plantJournal(paths, { name: 'a-prior.json', preimages: [preimage(marker, true, 'restored\n')] })
  expectCode(() => upgradeApply(paths, envelope(token, 'rename-failed'), { onPhase: phase => { if (phase === 'before-actions-rename') throw Object.assign(new Error('rename failed'), { code: 'EIO' }) } }), 'EIO', { recovery: { performed: true, journals: 1 } })
  assert.equal(fs.readFileSync(marker, 'utf8'), 'restored\n')
  assert.deepEqual(fs.readFileSync(sentinel.file), sentinel.bytes)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(domainJournals(paths).length, 0)
  assert.equal(fs.existsSync(paths.lockPath), false)
})

function unchangedUpgrade(paths, snapshotBytes) {
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(domainJournals(paths).length, 0)
  for (const [file, bytes] of snapshotBytes) assert.deepEqual(fs.readFileSync(file), bytes)
}

test('an index directory link cannot redirect publication into transmitted history', t => {
  const { root, paths } = syntheticVault(t, 4)
  const sentinel = outsideSentinel(t)
  rewriteCompanyId(paths, 'company:submission')
  const snapshot = fileIn(root, SYNTHETIC.submissionSnapshot)
  const outreach = fileIn(root, SYNTHETIC.outreachTransmission)
  const snapshotBytes = fs.readFileSync(snapshot)
  const outreachBytes = fs.readFileSync(outreach)
  const manifest = fs.readFileSync(path.join(paths.recordsDir, 'manifest.json'))
  fs.mkdirSync(paths.indexesDir, { recursive: true })
  fs.symlinkSync(path.dirname(snapshot), path.join(paths.indexesDir, 'companies'))
  expectCode(() => upgradePreview(paths), 'UNSAFE_PATH')
  expectCode(() => upgradeApply(paths, envelope({ schemaVersion: 1 }, 'index-history'), { onPhase: () => 'crash' }), 'UNSAFE_PATH', { recovery: idleRecovery })
  assert.deepEqual(fs.readFileSync(snapshot), snapshotBytes)
  assert.deepEqual(fs.readFileSync(outreach), outreachBytes)
  assert.deepEqual(fs.readFileSync(path.join(paths.recordsDir, 'manifest.json')), manifest)
  assert.deepEqual(fs.readFileSync(sentinel.file), sentinel.bytes)
  unchangedUpgrade(paths, [[snapshot, snapshotBytes], [outreach, outreachBytes]])

  const rooted = syntheticVault(t, 4)
  const history = path.join(rooted.paths.artifactsDir, '.versions')
  const historyBytes = fs.readFileSync(path.join(history, 'synthetic-cv', 'submission.md'))
  fs.symlinkSync(history, rooted.paths.indexesDir)
  expectCode(() => upgradePreview(rooted.paths), 'UNSAFE_PATH')
  expectCode(() => upgradeApply(rooted.paths, envelope({ schemaVersion: 1 }, 'index-root'), { onPhase: () => 'crash' }), 'UNSAFE_PATH', { recovery: idleRecovery })
  assert.deepEqual(fs.readFileSync(path.join(history, 'synthetic-cv', 'submission.md')), historyBytes)
  unchangedUpgrade(rooted.paths, [[path.join(history, 'synthetic-cv', 'submission.md'), historyBytes]])
})

test('historical directory aliases are rejected without dropping addressed bytes', t => {
  const { paths } = syntheticVault(t, 4)
  const versions = path.join(paths.artifactsDir, '.versions')
  const submission = path.join(versions, 'synthetic-cv', 'submission.md')
  const otherDir = path.join(versions, 'other-cv')
  fs.mkdirSync(otherDir)
  const other = path.join(otherDir, 'submission.md')
  fs.writeFileSync(other, 'other-submission-bytes\n')
  const submissionBytes = fs.readFileSync(submission)
  const otherBytes = fs.readFileSync(other)
  const alias = path.join(versions, 'zz-alias')
  fs.symlinkSync('synthetic-cv', alias)
  const interactions = path.join(paths.recordsDir, RECORD_FILES.interactions)
  const records = JSON.parse(fs.readFileSync(interactions, 'utf8'))
  for (const record of records) {
    for (const item of record.submission_bundle?.items || []) item.snapshot_path = 'artifacts/.versions/zz-alias/submission.md'
  }
  fs.writeFileSync(interactions, json(records))
  const manifest = fs.readFileSync(path.join(paths.recordsDir, 'manifest.json'))
  expectCode(() => upgradePreview(paths), 'UNSAFE_PATH')
  expectCode(() => upgradeApply(paths, envelope({ schemaVersion: 1 }, 'alias-a'), { onPhase: () => 'crash' }), 'UNSAFE_PATH', { recovery: idleRecovery })
  fs.unlinkSync(alias)
  fs.symlinkSync('other-cv', alias)
  expectCode(() => upgradePreview(paths), 'UNSAFE_PATH')
  expectCode(() => upgradeApply(paths, envelope({ schemaVersion: 1 }, 'alias-b'), { onPhase: () => 'crash' }), 'UNSAFE_PATH', { recovery: idleRecovery })
  assert.deepEqual(fs.readFileSync(submission), submissionBytes)
  assert.deepEqual(fs.readFileSync(other), otherBytes)
  assert.deepEqual(fs.readFileSync(path.join(paths.recordsDir, 'manifest.json')), manifest)
  assert.equal(fs.lstatSync(alias).isSymbolicLink(), true)
  unchangedUpgrade(paths, [[submission, submissionBytes], [other, otherBytes]])
})

test('index file links are rejected before a production journal is created', t => {
  const { root, paths } = syntheticVault(t, 4)
  const sentinel = outsideSentinel(t)
  const submission = fileIn(root, SYNTHETIC.submissionSnapshot)
  const submissionBytes = fs.readFileSync(submission)
  fs.mkdirSync(paths.indexesDir, { recursive: true })
  const target = path.join(paths.indexesDir, 'real.md')
  fs.writeFileSync(target, 'index-v1')
  const targetBytes = fs.readFileSync(target)
  fs.symlinkSync(target, path.join(paths.indexesDir, 'companies.md'))
  const manifest = fs.readFileSync(path.join(paths.recordsDir, 'manifest.json'))
  expectCode(() => upgradePreview(paths), 'UNSAFE_PATH')
  expectCode(() => upgradeApply(paths, envelope({ schemaVersion: 1 }, 'index-file-link'), { onPhase: phase => phase === 'before-actions-rename' ? 'crash' : undefined }), 'UNSAFE_PATH', { recovery: idleRecovery })
  const recovered = upgradeRecover(paths)
  assert.equal(recovered.schemaChanged, false)
  assertRecovery(recovered.recovery, 0)
  assert.deepEqual(fs.readFileSync(target), targetBytes)
  assert.deepEqual(fs.readFileSync(submission), submissionBytes)
  assert.deepEqual(fs.readFileSync(path.join(paths.recordsDir, 'manifest.json')), manifest)
  assert.deepEqual(fs.readFileSync(sentinel.file), sentinel.bytes)
  unchangedUpgrade(paths, [[target, targetBytes], [submission, submissionBytes]])
})

test('conflicting restore targets leave every earlier journal unchanged', t => {
  const { root, paths } = syntheticVault(t, 4)
  const sentinel = outsideSentinel(t)
  const marker = markerFile(root)
  fs.writeFileSync(marker, 'live\n')
  const parent = path.join(root, 'new-parent')
  const child = path.join(parent, 'child.txt')
  const safe = plantJournal(paths, { name: 'a-safe.json', preimages: [preimage(marker, true, 'restored\n')] })
  const created = plantJournal(paths, { name: 'b-parent.json', preimages: [preimage(parent, true, 'parent-bytes')] })
  const nested = plantJournal(paths, { name: 'c-child.json', preimages: [preimage(child, true, 'child-bytes')] })
  const safeBytes = fs.readFileSync(safe)
  const createdBytes = fs.readFileSync(created)
  const nestedBytes = fs.readFileSync(nested)
  expectCode(() => upgradeRecover(paths), 'UNSAFE_JOURNAL', { reason: 'unsafe' })
  expectCode(() => upgradeApply(paths, envelope({ schemaVersion: 1 }, 'ancestor-conflict')), 'UNSAFE_JOURNAL', { reason: 'unsafe' })
  assert.equal(fs.readFileSync(marker, 'utf8'), 'live\n')
  assert.equal(fs.existsSync(parent), false)
  assert.deepEqual(fs.readFileSync(safe), safeBytes)
  assert.deepEqual(fs.readFileSync(created), createdBytes)
  assert.deepEqual(fs.readFileSync(nested), nestedBytes)
  assert.deepEqual(fs.readFileSync(sentinel.file), sentinel.bytes)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(fs.existsSync(paths.ledgerPath), false)

  const duplicate = syntheticVault(t, 4)
  const duplicateMarker = markerFile(duplicate.root)
  fs.writeFileSync(duplicateMarker, 'live\n')
  const first = plantJournal(duplicate.paths, { name: 'a-one.json', preimages: [preimage(duplicateMarker, true, 'one\n')] })
  const second = plantJournal(duplicate.paths, { name: 'b-two.json', preimages: [preimage(duplicateMarker, true, 'two\n')] })
  const firstBytes = fs.readFileSync(first)
  const secondBytes = fs.readFileSync(second)
  expectCode(() => upgradeRecover(duplicate.paths), 'UNSAFE_JOURNAL', { reason: 'unsafe' })
  assert.equal(fs.readFileSync(duplicateMarker, 'utf8'), 'live\n')
  assert.deepEqual(fs.readFileSync(first), firstBytes)
  assert.deepEqual(fs.readFileSync(second), secondBytes)
  assert.equal(readManifest(duplicate.paths).schema_version, 4)
  assert.equal(fs.existsSync(duplicate.paths.ledgerPath), false)

  const journals = syntheticVault(t, 4)
  const journalMarker = markerFile(journals.root)
  fs.writeFileSync(journalMarker, 'live\n')
  const keeper = plantJournal(journals.paths, { name: 'b-keeper.json', preimages: [preimage(journalMarker, true, 'restored\n')] })
  const keeperBytes = fs.readFileSync(keeper)
  const attack = plantJournal(journals.paths, { name: 'a-attack.json', preimages: [preimage(keeper, true, 'rewritten-journal')] })
  const attackBytes = fs.readFileSync(attack)
  expectCode(() => upgradeRecover(journals.paths), 'UNSAFE_JOURNAL', { reason: 'unsafe' })
  assert.equal(fs.readFileSync(journalMarker, 'utf8'), 'live\n')
  assert.deepEqual(fs.readFileSync(keeper), keeperBytes)
  assert.deepEqual(fs.readFileSync(attack), attackBytes)
  assert.equal(readManifest(journals.paths).schema_version, 4)
  assert.equal(fs.existsSync(journals.paths.ledgerPath), false)
})

test('journal and historical root discovery reject dangling links and unreadable listings', t => {
  const dangling = syntheticVault(t, 4)
  const sentinel = outsideSentinel(t)
  const submission = fileIn(dangling.root, SYNTHETIC.submissionSnapshot)
  const submissionBytes = fs.readFileSync(submission)
  fs.mkdirSync(path.dirname(dangling.paths.journalDir), { recursive: true })
  fs.symlinkSync(path.join(sentinel.dir, 'missing-journal'), dangling.paths.journalDir)
  expectCode(() => upgradePreview(dangling.paths), 'UNSAFE_JOURNAL', { reason: 'unsafe' })
  expectCode(() => upgradeRecover(dangling.paths), 'UNSAFE_JOURNAL', { reason: 'unsafe' })
  assert.equal(fs.lstatSync(dangling.paths.journalDir).isSymbolicLink(), true)
  assert.equal(readManifest(dangling.paths).schema_version, 4)
  assert.equal(fs.existsSync(dangling.paths.ledgerPath), false)
  assert.deepEqual(fs.readFileSync(submission), submissionBytes)
  assert.deepEqual(fs.readFileSync(sentinel.file), sentinel.bytes)

  const listed = syntheticVault(t, 4)
  const marker = markerFile(listed.root)
  fs.writeFileSync(marker, 'live\n')
  const journal = plantJournal(listed.paths, { preimages: [preimage(marker, true, 'restored\n')] })
  const journalBytes = fs.readFileSync(journal)
  const originalReaddir = fs.readdirSync
  const journalDir = path.resolve(listed.paths.journalDir)
  fs.readdirSync = (target, options) => {
    if (path.resolve(target) === journalDir) {
      const error = new Error(`EACCES: permission denied, scandir '${target}'`)
      error.code = 'EACCES'
      throw error
    }
    return originalReaddir(target, options)
  }
  try {
    expectCode(() => upgradeRecover(listed.paths), 'UNSAFE_JOURNAL', { reason: 'unreadable' })
    expectCode(() => upgradePreview(listed.paths), 'UNSAFE_JOURNAL', { reason: 'unreadable' })
  } finally {
    fs.readdirSync = originalReaddir
  }
  assert.equal(fs.readFileSync(marker, 'utf8'), 'live\n')
  assert.deepEqual(fs.readFileSync(journal), journalBytes)
  assert.equal(readManifest(listed.paths).schema_version, 4)
  assert.equal(fs.existsSync(listed.paths.ledgerPath), false)

  const replaced = syntheticVault(t, 4)
  fs.mkdirSync(path.dirname(replaced.paths.journalDir), { recursive: true })
  fs.writeFileSync(replaced.paths.journalDir, 'not-a-directory')
  expectCode(() => upgradePreview(replaced.paths), 'UNSAFE_JOURNAL', { reason: 'unsafe' })
  expectCode(() => upgradeRecover(replaced.paths), 'UNSAFE_JOURNAL', { reason: 'unsafe' })
  assert.equal(fs.readFileSync(replaced.paths.journalDir, 'utf8'), 'not-a-directory')
  assert.equal(readManifest(replaced.paths).schema_version, 4)
  assert.equal(fs.existsSync(replaced.paths.ledgerPath), false)

  const history = syntheticVault(t, 4)
  const versions = path.join(history.paths.artifactsDir, '.versions')
  const held = path.join(history.paths.artifactsDir, 'versions-held')
  fs.renameSync(versions, held)
  const heldSubmission = path.join(held, 'synthetic-cv', 'submission.md')
  const heldBytes = fs.readFileSync(heldSubmission)
  const manifest = fs.readFileSync(path.join(history.paths.recordsDir, 'manifest.json'))
  fs.symlinkSync(path.join(sentinel.dir, 'missing-versions'), versions)
  expectCode(() => upgradePreview(history.paths), 'UNSAFE_PATH')
  expectCode(() => upgradeApply(history.paths, envelope({ schemaVersion: 1 }, 'dangling-history'), { onPhase: () => 'crash' }), 'UNSAFE_PATH', { recovery: idleRecovery })
  assert.equal(fs.lstatSync(versions).isSymbolicLink(), true)
  assert.deepEqual(fs.readFileSync(heldSubmission), heldBytes)
  assert.deepEqual(fs.readFileSync(path.join(history.paths.recordsDir, 'manifest.json')), manifest)
  assert.equal(readManifest(history.paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(history.paths)), false)
  assert.equal(fs.existsSync(history.paths.ledgerPath), false)
  assert.equal(domainJournals(history.paths).length, 0)
})

test('an unsafe journal parent link is rejected before its directory is listed', t => {
  const { paths } = syntheticVault(t, 4)
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-journal-parent-'))
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }))
  const externalDir = path.join(outside, 'transactions')
  fs.mkdirSync(externalDir)
  const externalFile = path.join(externalDir, 'external-journal-entry.json')
  const externalBytes = Buffer.from('{"schemaVersion":1,"id":"external"}\n')
  fs.writeFileSync(externalFile, externalBytes)
  fs.symlinkSync(outside, paths.stateRoot)
  assert.equal(fs.lstatSync(paths.stateRoot).isSymbolicLink(), true)
  assert.equal(fs.lstatSync(paths.journalDir).isDirectory(), true)
  assert.equal(fs.lstatSync(paths.journalDir).isSymbolicLink(), false)
  const manifest = fs.readFileSync(path.join(paths.recordsDir, 'manifest.json'))
  const listed = []
  const originalReaddir = fs.readdirSync
  fs.readdirSync = (target, options) => {
    listed.push(path.resolve(target))
    return originalReaddir(target, options)
  }
  try {
    expectCode(() => listDomainJournalFiles(paths), 'UNSAFE_JOURNAL', { reason: 'unsafe' })
    expectCode(() => upgradePreview(paths), 'UNSAFE_JOURNAL', { reason: 'unsafe' })
    expectCode(() => upgradeRecover(paths), 'UNSAFE_JOURNAL', { reason: 'unsafe' })
  } finally {
    fs.readdirSync = originalReaddir
  }
  const forbidden = new Set([path.resolve(paths.journalDir), path.resolve(externalDir), path.resolve(outside)])
  assert.equal(listed.some(dir => forbidden.has(dir)), false)
  assert.deepEqual(fs.readFileSync(externalFile), externalBytes)
  assert.deepEqual(fs.readFileSync(path.join(paths.recordsDir, 'manifest.json')), manifest)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
})

test('conflicting publication targets are rejected before a journal is created', t => {
  const { root, paths } = syntheticVault(t, 4)
  const sentinel = outsideSentinel(t)
  const before = preservedHashes(root)
  const historical = fs.readFileSync(paths.auditPath)
  const parent = path.join(paths.indexesDir, 'companies', 'parent.md')
  const child = path.join(parent, 'child.md')
  const values = new Map([[parent, '# Parent\n'], [child, '# Child\n']])
  expectCode(() => applyTransaction(paths, values, 'conflict-set'), 'UNSAFE_PATH')
  assert.equal(fs.existsSync(paths.journalDir), false)
  assert.equal(fs.existsSync(parent), false)
  assert.equal(domainJournals(paths).length, 0)
  assert.deepEqual(preservedHashes(root), before)
  assert.deepEqual(fs.readFileSync(paths.auditPath), historical)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.deepEqual(fs.readFileSync(sentinel.file), sentinel.bytes)
})

test('preview rejects conflicting company index paths before a token or journal', async t => {
  const { root, paths } = syntheticVault(t, 4)
  const sentinel = outsideSentinel(t)
  const companiesFile = path.join(paths.recordsDir, RECORD_FILES.companies)
  const companies = JSON.parse(fs.readFileSync(companiesFile, 'utf8'))
  assert.equal(companies.some(company => company.id === SYNTHETIC.companyId), true)
  companies.push({ id: 'company:parent', name: 'Parent' }, { id: 'company:parent.md/child', name: 'Child' })
  fs.writeFileSync(companiesFile, json(companies))
  const manifest = readManifest(paths)
  manifest.counts.companies = companies.length
  writeManifest(paths, manifest)
  const opportunities = JSON.parse(fs.readFileSync(path.join(paths.recordsDir, RECORD_FILES.opportunities), 'utf8'))
  assert.equal(opportunities.every(item => item.company_id === SYNTHETIC.companyId), true)
  const before = preservedHashes(root)
  const historical = fs.readFileSync(paths.auditPath)
  const manifestBytes = fs.readFileSync(path.join(paths.recordsDir, 'manifest.json'))
  expectCode(() => upgradePreview(paths), 'UNSAFE_PATH')
  const preview = ioBuffers()
  assert.equal(await main(['model', 'upgrade-preview', '--data-root', root, '--json'], { ...preview.io, cwd: root, env: process.env }), 1)
  assert.equal(JSON.parse(preview.buffers.err).error.code, 'UNSAFE_PATH')
  expectCode(() => upgradeApply(paths, envelope({ schemaVersion: 1 }, 'conflict-companies'), { onPhase: crash('before-actions-rename') }), 'UNSAFE_PATH', { recovery: idleRecovery })
  assert.equal(domainJournals(paths).length, 0)
  assert.equal(fs.existsSync(paths.journalDir), false)
  assert.equal(fs.existsSync(path.join(paths.indexesDir, 'companies', 'parent.md')), false)
  assert.deepEqual(preservedHashes(root), before)
  assert.deepEqual(fs.readFileSync(paths.auditPath), historical)
  assert.deepEqual(fs.readFileSync(path.join(paths.recordsDir, 'manifest.json')), manifestBytes)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.deepEqual(fs.readFileSync(sentinel.file), sentinel.bytes)
})

test('a canonical vault reached through an alias admits only canonical recovery targets', t => {
  const { root, paths } = syntheticVault(t, 4)
  assert.equal(root, fs.realpathSync.native(root))
  assert.equal(paths.vaultRoot, root)
  const aliasParent = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-vault-alias-'))
  t.after(() => fs.rmSync(aliasParent, { recursive: true, force: true }))
  const alias = path.join(aliasParent, 'vault')
  const linkKind = process.platform === 'win32' ? 'junction' : 'directory symlink'
  let linkError = null
  try {
    fs.symlinkSync(root, alias, process.platform === 'win32' ? 'junction' : 'dir')
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'ENOTSUP' || error.code === 'EACCES') linkError = error
    else throw error
  }
  if (linkError) {
    t.skip(`Cannot create a ${linkKind} (${linkError.code})`)
    return
  }

  const aliased = resolvePaths({ dataRoot: alias })
  assert.equal(aliased.vaultRoot, root)
  assert.notEqual(path.resolve(alias), root)
  const marker = markerFile(root)
  fs.writeFileSync(marker, 'live\n')
  const canonicalJournal = plantJournal(aliased, { name: 'canonical.json', preimages: [preimage(marker, true, 'restored\n')] })
  const restored = upgradeRecover(aliased)
  assert.equal(restored.status, 'ok')
  assert.equal(restored.schemaChanged, false)
  assert.equal(restored.currentRecovery, undefined)
  assertRecovery(restored.recovery, 1)
  assert.equal(fs.readFileSync(marker, 'utf8'), 'restored\n')
  assert.equal(fs.existsSync(canonicalJournal), false)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(fs.existsSync(actionsFile(paths)), false)

  fs.writeFileSync(marker, 'live\n')
  const aliasMarker = path.join(alias, 'Candidatures', 'marker.txt')
  assert.notEqual(path.resolve(aliasMarker), marker)
  const attack = plantJournal(paths, { name: 'alias-spelling.json', preimages: [preimage(aliasMarker, true, 'hijacked\n')] })
  const attackBytes = fs.readFileSync(attack)
  expectCode(() => upgradeRecover(paths), 'UNSAFE_JOURNAL', { reason: 'unsafe' })
  assert.equal(fs.readFileSync(marker, 'utf8'), 'live\n')
  assert.deepEqual(fs.readFileSync(attack), attackBytes)
  assert.equal(readManifest(paths).schema_version, 4)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(fs.existsSync(actionsFile(paths)), false)
})

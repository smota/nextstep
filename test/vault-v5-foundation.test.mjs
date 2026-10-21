// Node 5 vault version gate. Ordinary command tests keep the v5 factories.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { artifactStatus, bootstrapSnapshots, commandDescription, createStrategy, doctor, get, upsertEntity, validate } from '../src/commands.mjs'
import { main, routeNames } from '../src/cli.mjs'
import { resolvePaths } from '../src/config.mjs'
import { classifyVault, findEntity, json, loadModel, RECORD_FILES, RECORD_TYPES, rebuildBacklinks, validateModel } from '../src/model.mjs'
import { renderIndexes } from '../src/storage.mjs'
import { makeFixture } from '../scripts/c0-baseline.mjs'
import { fixture as careerFixture } from './fixtures/career-vault.mjs'
import { SYNTHETIC, syntheticVault, trackedFiles } from './fixtures/vault-v4.mjs'

const UPGRADE_MESSAGE = 'Vault schema_version 4 requires an explicit upgrade. Run model upgrade-preview, then model upgrade-apply with that token.'
const UPGRADE_DETAILS = { schemaVersion: 4, previewCommand: 'model upgrade-preview', applyCommand: 'model upgrade-apply' }

function upgradeError(error) {
  assert.equal(error.code, 'VAULT_UPGRADE_REQUIRED')
  assert.equal(error.message, UPGRADE_MESSAGE)
  assert.notEqual(error.replayed, true)
  assert.deepEqual(error.details, UPGRADE_DETAILS)
  return true
}

function fileSha(file) {
  return fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null
}

function freeze(root, extra = []) {
  const paths = resolvePaths({ dataRoot: root })
  const files = [...trackedFiles(root), paths.ledgerPath, path.join(paths.recordsDir, RECORD_FILES.actions), ...extra]
  return Object.fromEntries(files.map(file => [path.relative(root, file).split(path.sep).join('/'), fileSha(file)]))
}

function historicalInput() {
  return {
    schemaVersion: 1,
    requestId: 'hist-1',
    idempotencyKey: 'hist-key',
    payload: {
      record: {
        id: 'strategy:hist',
        definition_id: 'strategy-definition:cold-apply',
        objective: 'Keep the historical key',
        scope: { subject_ids: ['person:pat'] },
        success_criteria: []
      }
    }
  }
}

function strategyInput(id, subjectId = SYNTHETIC.personId) {
  return {
    schemaVersion: 1,
    requestId: id,
    idempotencyKey: id,
    payload: {
      record: {
        id: 'strategy:synthetic',
        definition_id: 'strategy-definition:cold-apply',
        objective: 'Keep version five',
        scope: { subject_ids: [subjectId] },
        success_criteria: []
      }
    }
  }
}

function manifestFile(root) {
  return path.join(root, 'Candidatures', 'records', 'manifest.json')
}

function readManifest(root) {
  return JSON.parse(fs.readFileSync(manifestFile(root), 'utf8'))
}

function writeManifest(root, manifest) {
  fs.writeFileSync(manifestFile(root), json(manifest))
}

function plantJournal(paths) {
  fs.mkdirSync(paths.journalDir, { recursive: true })
  const companies = path.join(paths.recordsDir, RECORD_FILES.companies)
  const original = fs.readFileSync(companies)
  const journalFile = path.join(paths.journalDir, 'pending.json')
  const body = json({
    schemaVersion: 1,
    id: 'pending-journal',
    requestId: 'pending',
    state: 'prepared',
    preimages: [{ file: companies, existed: true, data: Buffer.from(json([{ id: 'company:restored', name: 'Restored' }])).toString('base64') }]
  })
  fs.writeFileSync(journalFile, body)
  return { journalFile, body, companies, original }
}

function copyHistoricalLedger(t) {
  const source = careerFixture(t)
  assert.equal(createStrategy(source.paths, historicalInput()).status, 'applied')
  return fs.readFileSync(source.paths.ledgerPath)
}

function installLedger(paths, bytes) {
  fs.mkdirSync(path.dirname(paths.ledgerPath), { recursive: true })
  fs.writeFileSync(paths.ledgerPath, bytes)
}

function ioBuffers() {
  const buffers = { out: '', err: '' }
  return {
    buffers,
    io: {
      out: { write: value => { buffers.out += value } },
      err: { write: value => { buffers.err += value } }
    }
  }
}

function careerCounts(counts) {
  return RECORD_TYPES.filter(type => type !== 'actions').map(type => counts[type])
}

function assertErrorEnvelope(text) {
  const body = JSON.parse(text)
  assert.equal(body.schemaVersion, 1)
  assert.equal(body.status, 'error')
  assert.notEqual(body.status, 'degraded')
  assert.equal(body.error.code, 'VAULT_UPGRADE_REQUIRED')
  assert.equal(body.error.message, UPGRADE_MESSAGE)
  assert.deepEqual(body.error.details, UPGRADE_DETAILS)
  assert.notEqual(body.replayed, true)
}

test('ordinary v4 reads, doctor, and dry-run reject upgrade and write nothing', async t => {
  const { root, paths } = syntheticVault(t, 4)
  const before = freeze(root)
  assert.equal(fs.existsSync(paths.stateRoot), false)
  assert.equal(classifyVault(paths).kind, 'upgrade_required')
  assert.equal(Object.hasOwn(classifyVault(paths).model, 'actions'), false)
  assert.throws(() => loadModel(paths), upgradeError)
  assert.throws(() => get(paths, SYNTHETIC.companyId), upgradeError)
  assert.throws(() => validate(paths), upgradeError)
  assert.throws(() => doctor(paths), upgradeError)
  assert.throws(() => createStrategy({ ...paths, dryRun: true }, historicalInput()), upgradeError)

  const doctorIo = ioBuffers()
  assert.equal(await main(['doctor', '--data-root', root, '--json'], { ...doctorIo.io, cwd: root, env: process.env }), 1)
  assert.equal(doctorIo.buffers.out, '')
  assertErrorEnvelope(doctorIo.buffers.err)

  const getIo = ioBuffers()
  assert.equal(await main(['get', '--data-root', root, '--id', SYNTHETIC.companyId, '--json'], { ...getIo.io, cwd: root, env: process.env }), 1)
  assert.equal(getIo.buffers.out, '')
  assertErrorEnvelope(getIo.buffers.err)

  assert.deepEqual(freeze(root), before)
  assert.equal(fs.existsSync(paths.stateRoot), false)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(fs.existsSync(paths.lockPath), false)
  assert.equal(fs.existsSync(path.join(paths.recordsDir, RECORD_FILES.actions)), false)
})

test('a v4 mutation releases the lock and leaves career, snapshot, audit, and ledger bytes', t => {
  const { root, paths } = syntheticVault(t, 4)
  const before = freeze(root)
  assert.throws(() => createStrategy(paths, historicalInput()), upgradeError)
  assert.deepEqual(freeze(root), before)
  assert.equal(fs.existsSync(paths.lockPath), false)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(fs.existsSync(paths.journalDir), false)
  assert.equal(fs.existsSync(path.join(paths.recordsDir, RECORD_FILES.actions)), false)
})

test('a held lock on v4 stays COMMIT_BUSY and dry-run does not take it', t => {
  const { paths } = syntheticVault(t, 4)
  fs.mkdirSync(path.dirname(paths.lockPath), { recursive: true })
  const lockBody = json({ schemaVersion: 1, requestId: 'held', pid: 1, acquiredAt: new Date().toISOString() })
  fs.writeFileSync(paths.lockPath, lockBody)
  assert.throws(() => createStrategy(paths, strategyInput('lock-busy')), error => error.code === 'COMMIT_BUSY')
  assert.equal(fs.readFileSync(paths.lockPath, 'utf8'), lockBody)
  assert.throws(() => createStrategy({ ...paths, dryRun: true }, strategyInput('lock-dry')), upgradeError)
  assert.equal(fs.readFileSync(paths.lockPath, 'utf8'), lockBody)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(fs.existsSync(path.join(paths.recordsDir, RECORD_FILES.actions)), false)
})

test('a matching historical idempotency key beside a prepared journal does not replay or recover on v4', t => {
  const ledgerBytes = copyHistoricalLedger(t)
  const { root, paths } = syntheticVault(t, 4)
  installLedger(paths, ledgerBytes)
  const planted = plantJournal(paths)
  const before = freeze(root, [planted.journalFile])
  assert.throws(() => createStrategy(paths, historicalInput()), upgradeError)
  assert.throws(() => createStrategy({ ...paths, dryRun: true }, historicalInput()), upgradeError)
  assert.deepEqual(freeze(root, [planted.journalFile]), before)
  assert.deepEqual(fs.readFileSync(paths.ledgerPath), ledgerBytes)
  assert.equal(fs.readFileSync(planted.journalFile, 'utf8'), planted.body)
  assert.deepEqual(fs.readFileSync(planted.companies), planted.original)
  assert.equal(fs.readFileSync(planted.companies, 'utf8').includes('company:restored'), false)
})

test('a conflicting idempotency digest on v4 is still upgrade required', t => {
  const ledgerBytes = copyHistoricalLedger(t)
  const { root, paths } = syntheticVault(t, 4)
  installLedger(paths, ledgerBytes)
  const ledger = JSON.parse(fs.readFileSync(paths.ledgerPath, 'utf8'))
  ledger.entries['hist-key'].digest = 'a'.repeat(64)
  fs.writeFileSync(paths.ledgerPath, json(ledger))
  const planted = plantJournal(paths)
  const before = freeze(root, [planted.journalFile])
  assert.throws(() => createStrategy(paths, historicalInput()), error => upgradeError(error) && error.code !== 'IDEMPOTENCY_CONFLICT')
  assert.throws(() => createStrategy({ ...paths, dryRun: true }, historicalInput()), error => upgradeError(error) && error.code !== 'IDEMPOTENCY_CONFLICT')
  assert.deepEqual(freeze(root, [planted.journalFile]), before)
  assert.equal(fs.readFileSync(planted.journalFile, 'utf8'), planted.body)
  assert.deepEqual(fs.readFileSync(planted.companies), planted.original)
})

test('v4 canonical empty actions.json is still upgrade required and any other actions file is malformed', t => {
  const canonical = syntheticVault(t, 4)
  const actions = path.join(canonical.paths.recordsDir, RECORD_FILES.actions)
  fs.writeFileSync(actions, json([]))
  const before = fs.readFileSync(actions)
  assert.equal(classifyVault(canonical.paths).actionsFile, 'canonical-empty')
  assert.throws(() => loadModel(canonical.paths), upgradeError)
  assert.deepEqual(fs.readFileSync(actions), before)

  const loose = syntheticVault(t, 4)
  fs.writeFileSync(path.join(loose.paths.recordsDir, RECORD_FILES.actions), '[]')
  assert.throws(() => loadModel(loose.paths), error => error.code === 'MODEL_INVALID' && error.details.reason === 'unexpected_actions')

  const populated = syntheticVault(t, 4)
  fs.writeFileSync(path.join(populated.paths.recordsDir, RECORD_FILES.actions), json([{ id: 'action:one' }]))
  assert.throws(() => classifyVault(populated.paths), error => error.code === 'MODEL_INVALID' && error.details.reason === 'unexpected_actions')

  const counted = syntheticVault(t, 4)
  const manifest = readManifest(counted.root)
  manifest.counts.actions = 0
  writeManifest(counted.root, manifest)
  assert.throws(() => loadModel(counted.paths), error => error.code === 'MODEL_INVALID' && error.details.reason === 'unexpected_actions')
  assert.equal(fs.existsSync(path.join(counted.paths.recordsDir, RECORD_FILES.actions)), false)
})

test('malformed versions and career records fail closed before an actions collection is invented', t => {
  const mismatched = syntheticVault(t, 4)
  const mismatchManifest = readManifest(mismatched.root)
  mismatchManifest.counts.companies = 0
  writeManifest(mismatched.root, mismatchManifest)
  assert.throws(() => loadModel(mismatched.paths), error => error.code === 'MODEL_INVALID' && error.details.reason === 'schema_version' && error.details.collection === 'companies')

  const extra = syntheticVault(t, 4)
  const extraManifest = readManifest(extra.root)
  extraManifest.counts.notes = 0
  writeManifest(extra.root, extraManifest)
  assert.throws(() => loadModel(extra.paths), error => error.code === 'MODEL_INVALID' && error.details.reason === 'schema_version')

  const unreadable = syntheticVault(t, 4)
  fs.writeFileSync(path.join(unreadable.paths.recordsDir, RECORD_FILES.companies), '{}\n')
  assert.throws(() => loadModel(unreadable.paths), error => error.code === 'MODEL_INVALID' && error.details.reason === 'unreadable')

  const broken = syntheticVault(t, 4)
  fs.writeFileSync(path.join(broken.paths.recordsDir, RECORD_FILES.companies), '{\n')
  assert.throws(() => loadModel(broken.paths), error => error.code === 'MODEL_INVALID' && error.details.reason === 'unreadable')

  for (const version of [6, '5', 4.5]) {
    const vault = syntheticVault(t, 4)
    const manifest = readManifest(vault.root)
    manifest.schema_version = version
    writeManifest(vault.root, manifest)
    assert.throws(() => loadModel(vault.paths), error => error.code === 'MODEL_INVALID' && error.details.reason === 'schema_version')
    assert.equal(fs.existsSync(path.join(vault.paths.recordsDir, RECORD_FILES.actions)), false)
  }

  const missingVersion = syntheticVault(t, 4)
  const versionManifest = readManifest(missingVersion.root)
  delete versionManifest.schema_version
  writeManifest(missingVersion.root, versionManifest)
  assert.throws(() => loadModel(missingVersion.paths), error => error.code === 'MODEL_INVALID' && error.details.reason === 'schema_version')

  const missingManifest = syntheticVault(t, 4)
  fs.rmSync(manifestFile(missingManifest.root))
  assert.throws(() => loadModel(missingManifest.paths), error => error.code === 'MODEL_INVALID' && error.details.reason === 'schema_version')

  const badManifest = syntheticVault(t, 4)
  fs.writeFileSync(manifestFile(badManifest.root), '{')
  assert.throws(() => loadModel(badManifest.paths), error => error.code === 'MODEL_INVALID' && error.details.reason === 'unreadable')

  const older = syntheticVault(t, 4)
  const olderManifest = readManifest(older.root)
  olderManifest.schema_version = 3
  writeManifest(older.root, olderManifest)
  fs.rmSync(path.join(older.paths.recordsDir, RECORD_FILES.companies))
  assert.throws(() => loadModel(older.paths), error => error.code === 'MODEL_INVALID' && error.details.reason === 'schema_version' && error.code !== 'MODEL_INCOMPLETE')
  assert.equal(fs.existsSync(path.join(older.paths.recordsDir, RECORD_FILES.companies)), false)

  const incomplete = syntheticVault(t, 4)
  fs.rmSync(path.join(incomplete.paths.recordsDir, RECORD_FILES.companies))
  assert.throws(() => loadModel(incomplete.paths), error => error.code === 'MODEL_INCOMPLETE' && error.details.missingCollection === 'companies')
})

test('v5 requires a present actions array and agreeing counts', t => {
  const ready = syntheticVault(t, 5)
  const actions = path.join(ready.paths.recordsDir, RECORD_FILES.actions)
  fs.writeFileSync(actions, json([{ id: 'action:one' }]))
  const readyManifest = readManifest(ready.root)
  readyManifest.counts.actions = 1
  writeManifest(ready.root, readyManifest)
  const classified = classifyVault(ready.paths)
  assert.equal(classified.kind, 'ready')
  assert.equal(classified.schemaVersion, 5)
  assert.equal(loadModel(ready.paths).actions[0].id, 'action:one')

  const missing = syntheticVault(t, 5)
  const missingActions = path.join(missing.paths.recordsDir, RECORD_FILES.actions)
  const missingManifest = fs.readFileSync(manifestFile(missing.root))
  fs.rmSync(missingActions)
  assert.throws(() => loadModel(missing.paths), error => error.code === 'MODEL_INVALID' && error.details.reason === 'actions_missing' && error.code !== 'MODEL_INCOMPLETE')
  assert.equal(fs.existsSync(missingActions), false)
  assert.deepEqual(fs.readFileSync(manifestFile(missing.root)), missingManifest)

  const mismatch = syntheticVault(t, 5)
  const mismatchManifest = readManifest(mismatch.root)
  mismatchManifest.counts.actions = 4
  writeManifest(mismatch.root, mismatchManifest)
  assert.throws(() => loadModel(mismatch.paths), error => error.code === 'MODEL_INVALID' && error.details.reason === 'actions_count')

  const omitted = syntheticVault(t, 5)
  const omittedManifest = readManifest(omitted.root)
  delete omittedManifest.counts.actions
  writeManifest(omitted.root, omittedManifest)
  assert.throws(() => loadModel(omitted.paths), error => error.code === 'MODEL_INVALID' && error.details.reason === 'actions_count')

  const badActions = syntheticVault(t, 5)
  fs.writeFileSync(path.join(badActions.paths.recordsDir, RECORD_FILES.actions), '{')
  assert.throws(() => loadModel(badActions.paths), error => error.code === 'MODEL_INVALID' && error.details.reason === 'unreadable')

  const objectActions = syntheticVault(t, 5)
  fs.writeFileSync(path.join(objectActions.paths.recordsDir, RECORD_FILES.actions), '{}\n')
  assert.throws(() => loadModel(objectActions.paths), error => error.code === 'MODEL_INVALID' && error.details.reason === 'unreadable')

  const incomplete = syntheticVault(t, 5)
  fs.rmSync(path.join(incomplete.paths.recordsDir, RECORD_FILES.companies))
  assert.throws(() => loadModel(incomplete.paths), error => error.code === 'MODEL_INCOMPLETE' && error.details.missingCollection === 'companies')
})

test('an absent records directory returns an empty actions array and writes nothing', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-absent-records-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const recordsDir = path.join(root, 'Candidatures', 'records')
  const model = loadModel({ recordsDir })
  assert.deepEqual(Object.keys(model), [...RECORD_TYPES])
  assert.deepEqual(model.actions, [])
  assert.equal(fs.existsSync(recordsDir), false)
  assert.deepEqual(fs.readdirSync(root), [])
})

test('uninitialized doctor and mutation stay uninitialized', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-v5-uninit-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const paths = resolvePaths({ cwd: root })
  assert.equal(paths.vaultState, 'uninitialized')
  const report = doctor(paths)
  assert.equal(report.status, 'degraded')
  assert.equal(report.vaultState, 'uninitialized')
  assert.equal(report.checks.model.error, 'UNINITIALIZED')
  assert.throws(() => createStrategy(paths, historicalInput()), error => error.code === 'VAULT_NOT_INITIALIZED')
  const buffers = ioBuffers()
  assert.equal(await main(['doctor', '--json'], { ...buffers.io, cwd: root, env: process.env }), 2)
  assert.equal(JSON.parse(buffers.buffers.out).status, 'degraded')
  assert.equal(buffers.buffers.err, '')
  assert.equal(fs.existsSync(path.join(root, 'Candidatures')), false)
  assert.equal(fs.existsSync(paths.stateRoot), false)
})

test('the product tree is not a data root', () => {
  const productDir = path.resolve(import.meta.dirname, '..')
  assert.equal(JSON.parse(fs.readFileSync(path.join(productDir, 'package.json'), 'utf8')).name, 'nextstep')
  assert.throws(() => resolvePaths({ cwd: productDir }), error => error.code === 'PRODUCT_TREE_NOT_DATA')
})

test('default factories write version 5 and upgrade routes are discoverable', t => {
  const career = careerFixture(t)
  const careerManifest = readManifest(career.root)
  assert.equal(careerManifest.schema_version, 5)
  assert.deepEqual(Object.keys(careerManifest.counts), [...RECORD_TYPES])
  assert.equal(careerManifest.counts.actions, 0)
  assert.equal(fs.readFileSync(path.join(career.paths.recordsDir, RECORD_FILES.actions), 'utf8'), json([]))
  assert.deepEqual(loadModel(career.paths).actions, [])

  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-c0-factory-'))
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }))
  const c0 = makeFixture(parent, 'vault', 'C0 Co')
  const c0Paths = resolvePaths({ dataRoot: c0 })
  const c0Manifest = JSON.parse(fs.readFileSync(path.join(c0Paths.recordsDir, 'manifest.json'), 'utf8'))
  assert.equal(c0Manifest.schema_version, 5)
  assert.deepEqual(Object.keys(c0Manifest.counts), [...RECORD_TYPES])
  assert.equal(c0Manifest.counts.actions, 0)
  assert.equal(fs.readFileSync(path.join(c0Paths.recordsDir, RECORD_FILES.actions), 'utf8'), '[]\n')
  assert.equal(loadModel(c0Paths).companies[0].name, 'C0 Co')
  assert.deepEqual(loadModel(c0Paths).actions, [])

  const names = routeNames()
  assert.equal(names.includes('init'), false)
  assert.equal(names.includes('model init'), false)
  assert.equal(names.includes('model downgrade'), false)
  assert.equal(names.includes('model upgrade-preview'), true)
  assert.equal(names.includes('model upgrade-apply'), true)
  assert.equal(commandDescription('model upgrade-preview').contract.mode, 'read-only')
  assert.equal(commandDescription('model upgrade-apply').contract.mode, 'mutation')
})

test('v4 and v5 twins share career, audit, snapshot, and transmission bytes', t => {
  const legacy = syntheticVault(t, 4)
  const current = syntheticVault(t, 5)
  for (const file of trackedFiles(legacy.root)) {
    const relative = path.relative(legacy.root, file)
    assert.deepEqual(fs.readFileSync(path.join(current.root, relative)), fs.readFileSync(file), relative)
  }
  assert.equal(fs.readFileSync(path.join(legacy.paths.recordsDir, 'audit.jsonl'), 'utf8'), '{"schemaVersion":1,"at":"2020-01-01T00:00:00.000Z","command":"historical"}\n')
  assert.equal(fs.existsSync(path.join(legacy.paths.recordsDir, RECORD_FILES.actions)), false)
  assert.equal(fs.readFileSync(path.join(current.paths.recordsDir, RECORD_FILES.actions), 'utf8'), json([]))
  const legacyManifest = readManifest(legacy.root)
  const currentManifest = readManifest(current.root)
  assert.equal(legacyManifest.schema_version, 4)
  assert.equal(currentManifest.schema_version, 5)
  assert.equal(Object.hasOwn(legacyManifest.counts, 'actions'), false)
  assert.equal(Object.keys(legacyManifest.counts).length, 8)
  assert.deepEqual(Object.keys(currentManifest.counts), [...RECORD_TYPES])
  assert.equal(currentManifest.counts.actions, 0)
  assert.deepEqual(careerCounts(currentManifest.counts), careerCounts(legacyManifest.counts))
})

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

test('v5 read-only commands create no files', async t => {
  const { root, paths } = syntheticVault(t, 5)
  const before = listTree(root)
  assert.equal(get(paths, SYNTHETIC.companyId).value.name, 'Synthetic Co')
  const validated = validate(paths)
  assert.equal(validated.valid, true)
  assert.equal(validated.counts.actions, 0)
  assert.equal(artifactStatus(paths, { artifactId: SYNTHETIC.noteId }).status, 'ok')
  const buffers = ioBuffers()
  assert.equal(await main(['get', '--data-root', root, '--id', SYNTHETIC.personId, '--json'], { ...buffers.io, cwd: root, env: process.env }), 0)
  assert.equal(buffers.buffers.err, '')
  assert.equal(JSON.parse(buffers.buffers.out).value.id, SYNTHETIC.personId)
  assert.deepEqual(listTree(root), before)
  assert.equal(fs.existsSync(paths.stateRoot), false)
  const manifest = readManifest(root)
  assert.equal(manifest.schema_version, 5)
  assert.equal(Object.keys(manifest.counts).length, 9)
  assert.equal(manifest.counts.actions, 0)
})

test('validateModel accepts an empty actions array and does not add parent action backlinks', t => {
  const { paths } = syntheticVault(t, 5)
  const model = loadModel(paths)
  const validated = validateModel(model, { paths })
  assert.equal(validated.valid, true)
  assert.equal(validated.counts.actions, 0)
  const pages = [...renderIndexes(model).keys()]
  assert.equal(pages.includes('actions.md'), false)
  assert.equal(pages.some(name => name.startsWith('actions/')), false)

  model.actions.push({ id: 'action:one' })
  rebuildBacklinks(model)
  for (const type of ['companies', 'opportunities', 'applicationAttempts', 'people']) {
    for (const record of model[type]) assert.equal(Object.hasOwn(record, 'action_ids'), false)
  }
  assert.equal(findEntity(model, 'action:one').type, 'actions')
  assert.equal(validateModel(model, { paths }).counts.actions, 1)
  model.actions.push({ id: 'company:nope' })
  assert.throws(() => validateModel(model, { paths }), error => error.code === 'MODEL_INVALID' && error.details.errors.some(message => message.includes('Invalid actions ID')))
})

test('entity upsert cannot write an action', t => {
  const { root, paths } = syntheticVault(t, 5)
  const actions = path.join(paths.recordsDir, RECORD_FILES.actions)
  const before = fs.readFileSync(actions)
  const manifest = fs.readFileSync(manifestFile(root))
  assert.throws(() => upsertEntity(paths, { schemaVersion: 1, requestId: 'upsert-action', idempotencyKey: 'upsert-action', payload: { type: 'action', record: { id: 'action:one' } } }), error => error.code === 'INVALID_COMMAND')
  assert.deepEqual(fs.readFileSync(actions), before)
  assert.deepEqual(fs.readFileSync(manifestFile(root)), manifest)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(readManifest(root).schema_version, 5)
})

test('a v5 mutation keeps schema_version 5 and the actions count', t => {
  const { root, paths } = syntheticVault(t, 5)
  const actions = fs.readFileSync(path.join(paths.recordsDir, RECORD_FILES.actions))
  const applied = createStrategy(paths, strategyInput('keep-v5'))
  assert.equal(applied.status, 'applied')
  assert.notEqual(applied.replayed, true)
  const manifest = readManifest(root)
  assert.equal(manifest.schema_version, 5)
  assert.equal(manifest.counts.actions, 0)
  assert.equal(manifest.counts.strategies, 1)
  assert.deepEqual(Object.keys(manifest.counts), [...RECORD_TYPES])
  assert.deepEqual(fs.readFileSync(path.join(paths.recordsDir, RECORD_FILES.actions)), actions)
})

test('a prepared journal restores a v5 collection that diverged from the manifest', t => {
  const { root, paths } = syntheticVault(t, 5)
  const companies = path.join(paths.recordsDir, RECORD_FILES.companies)
  const original = fs.readFileSync(companies)
  const records = JSON.parse(original.toString('utf8'))
  records.push({ id: 'company:uncommitted', name: 'Uncommitted' })
  fs.writeFileSync(companies, json(records))
  fs.mkdirSync(paths.journalDir, { recursive: true })
  const journalFile = path.join(paths.journalDir, 'pending.json')
  const journalBody = json({
    schemaVersion: 1,
    id: 'interrupted-companies',
    requestId: 'interrupted-companies',
    state: 'prepared',
    preimages: [{ file: companies, existed: true, data: original.toString('base64') }]
  })
  fs.writeFileSync(journalFile, journalBody)
  const manifestBefore = fs.readFileSync(manifestFile(root))
  assert.throws(() => loadModel(paths), error => error.code === 'MODEL_INVALID' && error.details.reason === 'schema_version' && error.details.collection === 'companies')
  assert.throws(() => createStrategy({ ...paths, dryRun: true }, strategyInput('interrupt-dry')), error => error.code === 'MODEL_INVALID' && error.details.reason === 'schema_version' && error.details.collection === 'companies' && error.replayed !== true)
  assert.equal(fs.readFileSync(journalFile, 'utf8'), journalBody)
  assert.equal(JSON.parse(fs.readFileSync(companies, 'utf8')).some(company => company.id === 'company:uncommitted'), true)
  assert.deepEqual(fs.readFileSync(manifestFile(root)), manifestBefore)
  assert.equal(fs.existsSync(paths.ledgerPath), false)

  const applied = createStrategy(paths, strategyInput('interrupt-apply'))
  assert.equal(applied.status, 'applied')
  assert.notEqual(applied.replayed, true)
  assert.equal(fs.existsSync(journalFile), false)
  const restored = JSON.parse(fs.readFileSync(companies, 'utf8'))
  assert.equal(restored.some(company => company.id === 'company:uncommitted'), false)
  assert.equal(restored.length, JSON.parse(original.toString('utf8')).length)
  const manifest = readManifest(root)
  assert.equal(manifest.schema_version, 5)
  assert.equal(manifest.counts.companies, 1)
  assert.equal(manifest.counts.actions, 0)
})

test('mismatched v5 career counts without a journal fail before an idempotent replay', t => {
  const { root, paths } = syntheticVault(t, 5)
  const input = strategyInput('count-replay')
  assert.equal(createStrategy(paths, input).status, 'applied')
  const ledgerBytes = fs.readFileSync(paths.ledgerPath)
  const companies = path.join(paths.recordsDir, RECORD_FILES.companies)
  const records = JSON.parse(fs.readFileSync(companies, 'utf8'))
  records.push({ id: 'company:uncommitted', name: 'Uncommitted' })
  fs.writeFileSync(companies, json(records))
  const torn = fs.readFileSync(companies)
  const manifestBefore = fs.readFileSync(manifestFile(root))
  assert.equal(fs.existsSync(paths.journalDir) && fs.readdirSync(paths.journalDir).some(name => name.endsWith('.json') && name !== 'ledger.json'), false)

  assert.throws(() => createStrategy({ ...paths, dryRun: true }, input), error => error.code === 'MODEL_INVALID' && error.details.reason === 'schema_version' && error.details.collection === 'companies' && error.replayed !== true)
  assert.throws(() => createStrategy(paths, input), error => error.code === 'MODEL_INVALID' && error.details.reason === 'schema_version' && error.details.collection === 'companies' && error.replayed !== true)
  assert.deepEqual(fs.readFileSync(paths.ledgerPath), ledgerBytes)
  assert.deepEqual(fs.readFileSync(companies), torn)
  assert.deepEqual(fs.readFileSync(manifestFile(root)), manifestBefore)
  assert.equal(readManifest(root).counts.companies, 1)
  assert.equal(fs.existsSync(paths.lockPath), false)
})

test('v5 dry-run leaves a prepared journal and a later mutation still recovers it', t => {
  const { root, paths } = syntheticVault(t, 5)
  const marker = path.join(root, 'Candidatures', 'marker.txt')
  fs.writeFileSync(marker, 'live\n')
  fs.mkdirSync(paths.journalDir, { recursive: true })
  const journalFile = path.join(paths.journalDir, 'pending.json')
  fs.writeFileSync(journalFile, json({
    schemaVersion: 1,
    id: 'pending',
    requestId: 'pending',
    state: 'prepared',
    preimages: [{ file: marker, existed: true, data: Buffer.from('restored\n').toString('base64') }]
  }))
  const dry = createStrategy({ ...paths, dryRun: true }, strategyInput('recover-dry'))
  assert.equal(dry.status, 'dry_run')
  assert.equal(dry.dryRun, true)
  assert.equal(fs.readFileSync(marker, 'utf8'), 'live\n')
  assert.equal(fs.existsSync(journalFile), true)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  const applied = createStrategy(paths, strategyInput('recover-apply'))
  assert.equal(applied.status, 'applied')
  assert.equal(fs.readFileSync(marker, 'utf8'), 'restored\n')
  assert.equal(fs.existsSync(journalFile), false)
  assert.equal(readManifest(root).schema_version, 5)
})

test('bootstrap-snapshots on v5 does not force version 4 or invent actions.json', t => {
  const career = careerFixture(t)
  const actions = fs.readFileSync(path.join(career.paths.recordsDir, RECORD_FILES.actions))
  const applied = bootstrapSnapshots(career.paths, { schemaVersion: 1, requestId: 'bootstrap-intact', idempotencyKey: 'bootstrap-intact', payload: {} })
  assert.equal(applied.status, 'applied')
  assert.equal(readManifest(career.root).schema_version, 5)
  assert.equal(readManifest(career.root).counts.actions, 0)
  assert.deepEqual(fs.readFileSync(path.join(career.paths.recordsDir, RECORD_FILES.actions)), actions)

  const { root, paths } = syntheticVault(t, 5)
  const removed = path.join(paths.recordsDir, RECORD_FILES.actions)
  const manifest = fs.readFileSync(manifestFile(root))
  fs.rmSync(removed)
  const input = id => ({ schemaVersion: 1, requestId: id, idempotencyKey: id, payload: {} })
  assert.throws(() => bootstrapSnapshots({ ...paths, dryRun: true }, input('bootstrap-dry')), error => error.code === 'MODEL_INVALID' && error.details.reason === 'actions_missing')
  assert.throws(() => bootstrapSnapshots(paths, input('bootstrap-apply')), error => error.code === 'MODEL_INVALID' && error.details.reason === 'actions_missing')
  assert.equal(fs.existsSync(removed), false)
  assert.deepEqual(fs.readFileSync(manifestFile(root)), manifest)
  assert.equal(readManifest(root).schema_version, 5)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
})

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { counts, json, loadModel, rebuildBacklinks, validateModel } from './model.mjs'
import { assertContained } from './config.mjs'

const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value
const digest = value => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')

function atomicWrite(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.tmp-${process.pid}-${crypto.randomUUID()}`
  let fd
  try {
    fd = fs.openSync(temporary, 'wx', 0o600)
    fs.writeFileSync(fd, data)
    fs.fsyncSync(fd)
    fs.closeSync(fd); fd = undefined
    fs.renameSync(temporary, file)
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
    fs.rmSync(temporary, { force: true })
  }
}

function acquireCommit(paths, requestId) {
  fs.mkdirSync(path.dirname(paths.lockPath), { recursive: true })
  const value = { schemaVersion: 1, requestId, pid: process.pid, acquiredAt: new Date().toISOString() }
  try { fs.writeFileSync(paths.lockPath, json(value), { flag: 'wx', mode: 0o600 }) } catch (error) {
    if (error.code !== 'EEXIST') throw error
    let current
    try { current = JSON.parse(fs.readFileSync(paths.lockPath, 'utf8')) } catch { current = null }
    const stale = !current?.acquiredAt || Date.now() - Date.parse(current.acquiredAt) > 120_000
    if (!stale) throw Object.assign(new Error('Another short Nextstep commit is in progress'), { code: 'COMMIT_BUSY', details: current })
    const quarantine = `${paths.lockPath}.stale-${crypto.randomUUID()}`
    fs.renameSync(paths.lockPath, quarantine)
    try { fs.writeFileSync(paths.lockPath, json(value), { flag: 'wx', mode: 0o600 }) } finally { fs.rmSync(quarantine, { force: true }) }
  }
  return () => fs.rmSync(paths.lockPath, { force: true })
}

function loadLedger(paths) {
  if (!fs.existsSync(paths.ledgerPath)) return { schemaVersion: 1, entries: {} }
  return JSON.parse(fs.readFileSync(paths.ledgerPath, 'utf8'))
}

function renderIndexes(model) {
  const cell = value => String(value ?? '—').replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ')
  const table = (headers, rows) => `| ${headers.join(' | ')} |\n|${headers.map(() => '---').join('|')}|\n${rows.join('\n')}\n`
  return new Map([
    ['index.md', '# Career Model Index\n\n- [Companies](companies.md)\n- [Vacancies](vacancies.md)\n- [Applications](applications.md)\n- [People](people.md)\n- [Interactions](interactions.md)\n- [Artifacts](artifacts.md)\n'],
    ['companies.md', `# Companies\n\n${table(['ID', 'Company', 'Vacancies'], model.companies.map(x => `| ${cell(x.id)} | ${cell(x.name)} | ${(x.vacancy_ids || []).length} |`))}`],
    ['vacancies.md', `# Vacancies\n\n${table(['ID', 'Company', 'Role', 'State'], model.vacancies.map(x => `| ${cell(x.id)} | ${cell(x.company_id)} | ${cell(x.title)} | ${cell(x.vacancy_state)} |`))}`],
    ['applications.md', `# Applications\n\n${table(['ID', 'Vacancy', 'Lifecycle', 'Outcome', 'Storage'], model.applications.map(x => `| ${cell(x.id)} | ${cell(x.vacancy_id)} | ${cell(x.lifecycle_status)} | ${cell(x.outcome)} | ${cell(x.storage_scope)} |`))}`],
    ['people.md', `# People\n\n${table(['ID', 'Person', 'Company'], model.people.map(x => `| ${cell(x.id)} | ${cell(x.name)} | ${cell(x.company_id)} |`))}`],
    ['interactions.md', `# Interactions\n\n${table(['ID', 'Kind', 'Application', 'Evidence'], model.interactions.map(x => `| ${cell(x.id)} | ${cell(x.kind)} | ${cell(x.application_id)} | ${cell(x.evidence_state)} |`))}`],
    ['artifacts.md', `# Artifacts\n\n${table(['ID', 'Kind', 'Owner', 'File', 'SHA-256'], model.artifacts.map(x => `| ${cell(x.id)} | ${cell(x.kind)} | ${cell(`${x.owner_type}:${x.owner_id}`)} | ${cell(x.path)} | ${cell(x.sha256?.slice(0, 12))} |`))}`]
  ])
}

function outputs(paths, model, ledger, auditEntry, extraOutputs = new Map()) {
  const out = new Map()
  const changed = (file, data) => !fs.existsSync(file) || !Buffer.from(fs.readFileSync(file)).equals(Buffer.from(data))
  for (const type of ['companies', 'vacancies', 'applications', 'people', 'interactions', 'artifacts']) {
    const file = path.join(paths.recordsDir, `${type}.json`), data = json(model[type])
    if (changed(file, data)) out.set(file, data)
  }
  const manifestFile = path.join(paths.recordsDir, 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  const nextManifest = json({ ...manifest, schema_version: 2, model: 'nextstep-relational', counts: counts(model) })
  if (changed(manifestFile, nextManifest)) out.set(manifestFile, nextManifest)
  for (const [name, content] of renderIndexes(model)) {
    const file = path.join(paths.indexesDir, name)
    if (changed(file, content)) out.set(file, content)
  }
  out.set(paths.ledgerPath, json(ledger))
  const oldAudit = fs.existsSync(paths.auditPath) ? fs.readFileSync(paths.auditPath, 'utf8') : ''
  out.set(paths.auditPath, `${oldAudit}${JSON.stringify(auditEntry)}\n`)
  for (const [file, data] of extraOutputs) out.set(file, data)
  return out
}

function applyTransaction(paths, values, requestId) {
  fs.mkdirSync(paths.journalDir, { recursive: true })
  const id = crypto.randomUUID(), journalFile = path.join(paths.journalDir, `${id}.json`)
  const preimages = [...values.keys()].map(file => ({ file, existed: fs.existsSync(file), data: fs.existsSync(file) ? fs.readFileSync(file).toString('base64') : '' }))
  atomicWrite(journalFile, json({ schemaVersion: 1, id, requestId, state: 'prepared', preimages }))
  try {
    for (const [file, data] of values) atomicWrite(file, data)
    atomicWrite(journalFile, json({ schemaVersion: 1, id, requestId, state: 'committed', preimages }))
    fs.rmSync(journalFile, { force: true })
  } catch (error) {
    for (const item of preimages) item.existed ? atomicWrite(item.file, Buffer.from(item.data, 'base64')) : fs.rmSync(item.file, { force: true })
    fs.rmSync(journalFile, { force: true })
    throw error
  }
}

export function recoverTransactions(paths) {
  if (!fs.existsSync(paths.journalDir)) return { recovered: 0 }
  let recovered = 0
  for (const name of fs.readdirSync(paths.journalDir).filter(x => x.endsWith('.json') && x !== 'ledger.json')) {
    const file = path.join(paths.journalDir, name), journal = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (journal.state === 'prepared') for (const item of journal.preimages) {
      const inVault = (() => { try { assertContained(paths.vaultRoot, item.file, 'Recovery target'); return true } catch { return false } })()
      if (!inVault) throw Object.assign(new Error('Transaction journal contains an unsafe recovery target'), { code: 'UNSAFE_JOURNAL' })
      item.existed ? atomicWrite(item.file, Buffer.from(item.data, 'base64')) : fs.rmSync(item.file, { force: true })
    }
    fs.rmSync(file, { force: true }); recovered++
  }
  return { recovered }
}

export function transactionStatus(paths) {
  if (!fs.existsSync(paths.journalDir)) return { pending: 0 }
  const files = fs.readdirSync(paths.journalDir).filter(name => name.endsWith('.json') && name !== 'ledger.json')
  return { pending: files.length, files: files.slice(0, 20) }
}

export function mutate(paths, envelope, operation) {
  const { requestId, idempotencyKey, actor = 'user' } = envelope
  if (!requestId || !idempotencyKey) throw Object.assign(new Error('Mutations require requestId and idempotencyKey'), { code: 'INVALID_ENVELOPE' })
  const release = acquireCommit(paths, requestId)
  try {
    recoverTransactions(paths)
    const ledger = loadLedger(paths), key = idempotencyKey, commandDigest = digest(envelope)
    if (ledger.entries[key]) {
      if (ledger.entries[key].digest !== commandDigest) throw Object.assign(new Error('Idempotency key was reused for another command'), { code: 'IDEMPOTENCY_CONFLICT' })
      return { ...ledger.entries[key].result, replayed: true }
    }
    const model = loadModel(paths), result = operation(model)
    rebuildBacklinks(model)
    validateModel(model, { paths, pendingFiles: result.extraOutputs })
    const response = { schemaVersion: 1, requestId, status: result.status || 'applied', changedEntities: result.changedEntities || [], revision: result.revision ?? null, warnings: result.warnings || [], unresolvedEvidence: result.unresolvedEvidence || [], nextActions: result.nextActions || [] }
    ledger.entries[key] = { digest: commandDigest, result: response }
    const audit = { schemaVersion: 1, at: new Date().toISOString(), requestId, actor, command: envelope.command, changedEntities: response.changedEntities }
    applyTransaction(paths, outputs(paths, model, ledger, audit, result.extraOutputs), requestId)
    return response
  } finally { release() }
}

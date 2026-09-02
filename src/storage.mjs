import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { counts, json, loadModel, rebuildBacklinks, RECORD_FILES, RECORD_TYPES, validateModel } from './model.mjs'
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

export function renderIndexes(model) {
  const cell = value => String(value ?? '—').replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ')
  const table = (headers, rows) => `| ${headers.join(' | ')} |\n|${headers.map(() => '---').join('|')}|\n${rows.join('\n')}\n`
  const slug = id => id.slice(id.indexOf(':') + 1)
  const unique = values => [...new Set((values || []).filter(Boolean))].sort()
  const link = (folder, id, label = id) => `[${cell(label)}](${folder}/${slug(id)}.md)`
  const detailLink = (folder, id, label = id) => `[${cell(label)}](../${folder}/${slug(id)}.md)`
  const artifactLink = artifact => `[${cell(artifact.kind)}](../artifacts/${slug(artifact.id)}.md)`
  const entityFolder = id => id?.startsWith('company:') ? 'companies' : id?.startsWith('opportunity:') ? 'opportunities' : id?.startsWith('application-attempt:') ? 'application-attempts' : id?.startsWith('person:') ? 'people' : null
  const entityLabel = id => model.companies.find(item => item.id === id)?.name || model.opportunities.find(item => item.id === id)?.title || model.people.find(item => item.id === id)?.name || id
  const out = new Map([
    ['index.md', '# Career Model Index\n\n- [Opportunities](opportunities.md)\n- [Companies](companies.md)\n- [People](people.md)\n- [Application attempts](application-attempts.md)\n- [Interactions](interactions.md)\n- [Artifacts](artifacts.md)\n- [Strategies](strategies.md)\n- [Experiments](experiments.md)\n'],
    ['companies.md', `# Companies\n\n${table(['Company', 'Opportunities', 'People'], model.companies.map(x => `| ${link('companies', x.id, x.name)} | ${(x.opportunity_ids || []).length} | ${(x.person_ids || []).length} |`))}`],
    ['opportunities.md', `# Opportunities\n\n${table(['Opportunity', 'Company', 'Posting', 'Pursuit'], model.opportunities.map(x => `| ${link('opportunities', x.id, x.title)} | ${link('companies', x.company_id, model.companies.find(c => c.id === x.company_id)?.name || x.company_id)} | ${cell(x.posting_state)} | ${cell(x.pursuit_status)} |`))}`],
    ['application-attempts.md', `# Application attempts\n\n${table(['Attempt', 'Opportunity', 'Lifecycle', 'Outcome'], model.applicationAttempts.map(x => `| ${link('application-attempts', x.id)} | ${link('opportunities', x.opportunity_id, model.opportunities.find(o => o.id === x.opportunity_id)?.title || x.opportunity_id)} | ${cell(x.lifecycle_status)} | ${cell(x.outcome)} |`))}`],
    ['people.md', `# People\n\n${table(['Person', 'Company', 'Opportunities'], model.people.map(x => `| ${link('people', x.id, x.name)} | ${x.company_id ? link('companies', x.company_id, model.companies.find(c => c.id === x.company_id)?.name || x.company_id) : '—'} | ${(x.opportunity_ids || []).length} |`))}`],
    ['interactions.md', `# Interactions\n\n${table(['ID', 'Kind', 'Opportunity', 'Attempt', 'Evidence'], model.interactions.map(x => `| ${cell(x.id)} | ${cell(x.kind)} | ${x.opportunity_id ? link('opportunities', x.opportunity_id) : '—'} | ${x.application_attempt_id ? link('application-attempts', x.application_attempt_id) : '—'} | ${cell(x.evidence_state)} |`))}`],
    ['artifacts.md', `# Artifacts\n\n${table(['Artifact', 'Owner', 'File', 'SHA-256'], model.artifacts.map(x => `| ${link('artifacts', x.id, x.kind)} | ${cell(x.owner_id || x.owner_type)} | [open](../${encodeURI(x.path).replaceAll('\\', '/')}) | ${cell(x.sha256?.slice(0, 12))} |`))}`],
    ['strategies.md', `# Strategies\n\n${table(['ID', 'Definition', 'Status', 'Objective'], model.strategies.map(x => `| ${cell(x.id)} | ${cell(x.definition_id)} | ${cell(x.status)} | ${cell(x.objective)} |`))}`],
    ['experiments.md', `# Experiments\n\n${table(['ID', 'Status', 'Strategies', 'Hypothesis'], model.experiments.map(x => `| ${cell(x.id)} | ${cell(x.status)} | ${(x.strategy_ids || []).length} | ${cell(x.hypothesis)} |`))}`]
  ])
  for (const company of model.companies) {
    const opportunities = model.opportunities.filter(item => company.opportunity_ids?.includes(item.id))
    const people = model.people.filter(item => company.person_ids?.includes(item.id))
    const artifacts = model.artifacts.filter(item => company.artifact_ids?.includes(item.id))
    out.set(`companies/${slug(company.id)}.md`, `# ${cell(company.name)}\n\n[All companies](../companies.md)\n\n## Opportunities\n\n${opportunities.length ? opportunities.map(item => `- ${detailLink('opportunities', item.id, item.title)} — ${cell(item.pursuit_status)}`).join('\n') : '_None_'}\n\n## People\n\n${people.length ? people.map(item => `- ${detailLink('people', item.id, item.name)}${item.role ? ` — ${cell(item.role)}` : ''}`).join('\n') : '_None_'}\n\n## Profile and artifacts\n\n${artifacts.length ? artifacts.map(item => `- ${artifactLink(item)}`).join('\n') : '_None_'}\n`)
  }
  for (const opportunity of model.opportunities) {
    const company = model.companies.find(item => item.id === opportunity.company_id)
    const attempts = model.applicationAttempts.filter(item => opportunity.application_attempt_ids?.includes(item.id))
    const people = model.people.filter(item => opportunity.person_ids?.includes(item.id))
    const interactions = model.interactions.filter(item => opportunity.interaction_ids?.includes(item.id))
    const artifacts = model.artifacts.filter(item => opportunity.artifact_ids?.includes(item.id))
    out.set(`opportunities/${slug(opportunity.id)}.md`, `# ${cell(opportunity.title)}\n\n[All opportunities](../opportunities.md) · Company: ${detailLink('companies', company.id, company.name)}\n\n- Posting: ${cell(opportunity.posting_state)}\n- Pursuit: ${cell(opportunity.pursuit_status)}\n- Outcome: ${cell(opportunity.outcome)}\n- Source: ${opportunity.source_url ? `[external posting](${opportunity.source_url})` : '—'}\n\n## Application attempts\n\n${attempts.length ? attempts.map(item => `- ${detailLink('application-attempts', item.id)} — ${cell(item.lifecycle_status)}`).join('\n') : '_No application attempt_'}\n\n## People\n\n${people.length ? people.map(item => `- ${detailLink('people', item.id, item.name)}${item.role ? ` — ${cell(item.role)}` : ''}`).join('\n') : '_None recorded_'}\n\n## Interactions\n\n${interactions.length ? interactions.map(item => `- ${cell(item.kind)} — ${cell(item.occurred_at || 'date unresolved')}`).join('\n') : '_None_'}\n\n## Artifacts\n\n${artifacts.length ? artifacts.map(item => `- ${artifactLink(item)}`).join('\n') : '_None_'}\n`)
  }
  for (const person of model.people) {
    const company = model.companies.find(item => item.id === person.company_id)
    const opportunities = model.opportunities.filter(item => person.opportunity_ids?.includes(item.id))
    const attempts = model.applicationAttempts.filter(item => person.application_attempt_ids?.includes(item.id))
    const artifacts = model.artifacts.filter(item => person.artifact_ids?.includes(item.id))
    out.set(`people/${slug(person.id)}.md`, `# ${cell(person.name)}\n\n[All people](../people.md)${company ? ` · Company: ${detailLink('companies', company.id, company.name)}` : ''}\n\n- Role: ${cell(person.role)}\n\n## Opportunities\n\n${opportunities.length ? opportunities.map(item => `- ${detailLink('opportunities', item.id, item.title)}`).join('\n') : '_None_'}\n\n## Application attempts\n\n${attempts.length ? attempts.map(item => `- ${detailLink('application-attempts', item.id)}`).join('\n') : '_None_'}\n\n## Profile and artifacts\n\n${artifacts.length ? artifacts.map(item => `- ${artifactLink(item)}`).join('\n') : '_None_'}\n`)
  }
  for (const attempt of model.applicationAttempts) {
    const opportunity = model.opportunities.find(item => item.id === attempt.opportunity_id)
    const people = model.people.filter(item => attempt.person_ids?.includes(item.id))
    const artifacts = model.artifacts.filter(item => attempt.artifact_ids?.includes(item.id))
    out.set(`application-attempts/${slug(attempt.id)}.md`, `# Application attempt\n\n[All attempts](../application-attempts.md) · Opportunity: ${detailLink('opportunities', opportunity.id, opportunity.title)}\n\n- Lifecycle: ${cell(attempt.lifecycle_status)}\n- Outcome: ${cell(attempt.outcome)}\n- Storage: ${cell(attempt.storage_scope)}\n\n## People\n\n${people.length ? people.map(item => `- ${detailLink('people', item.id, item.name)}`).join('\n') : '_None_'}\n\n## Artifacts\n\n${artifacts.length ? artifacts.map(item => `- ${artifactLink(item)}`).join('\n') : '_None_'}\n`)
  }
  for (const artifact of model.artifacts) {
    const relatedIds = unique([artifact.owner_id, ...(artifact.subject_ids || [])])
    const related = relatedIds.map(id => ({ id, folder: entityFolder(id) })).filter(item => item.folder)
    out.set(`artifacts/${slug(artifact.id)}.md`, `# ${cell(artifact.kind)}\n\n[All artifacts](../artifacts.md) · [Open working file](../../${encodeURI(artifact.path).replaceAll('\\', '/')})\n\n- ID: ${cell(artifact.id)}\n- Owner: ${cell(artifact.owner_id || artifact.owner_type)}\n- State: ${cell(artifact.document?.state)}\n- Representation: ${cell(artifact.document?.representation)}\n- SHA-256: ${cell(artifact.sha256)}\n\n## Related subjects\n\n${related.length ? related.map(item => `- ${detailLink(item.folder, item.id, entityLabel(item.id))}`).join('\n') : '_None_'}\n`)
  }
  return out
}

function outputs(paths, model, ledger, auditEntry, extraOutputs = new Map()) {
  const out = new Map()
  const changed = (file, data) => !fs.existsSync(file) || !Buffer.from(fs.readFileSync(file)).equals(Buffer.from(data))
  for (const type of RECORD_TYPES) {
    const file = path.join(paths.recordsDir, RECORD_FILES[type]), data = json(model[type])
    if (changed(file, data)) out.set(file, data)
  }
  const manifestFile = path.join(paths.recordsDir, 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  const nextManifest = json({ ...manifest, schema_version: 4, model: 'nextstep-opportunity-graph', counts: counts(model) })
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

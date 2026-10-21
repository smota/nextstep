import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { counts, json, loadModel, rebuildBacklinks, RECORD_FILES, RECORD_TYPES, requireCurrentVault, validateModel } from './model.mjs'
import { assertContained, within } from './config.mjs'

const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value
export function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
}

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

export function withCommitLock(paths, requestId, operation) {
  const release = acquireCommit(paths, requestId)
  try { return operation() } finally { release() }
}

export function loadLedger(paths) {
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
  const formatLocation = loc => {
    if (!loc) return null
    const parts = []
    if (loc.raw) parts.push(loc.raw)
    else if (loc.city) parts.push(loc.city)
    if (Array.isArray(loc.country) && loc.country.length) parts.push(`[${loc.country.join(', ')}]`)
    return parts.length ? parts.join(' ') : null
  }
  const formatPay = pay => {
    if (!pay) return null
    const currency = pay.currency || ''
    let range = null
    if (pay.min != null && pay.max != null) range = `${currency} ${pay.min.toLocaleString()} – ${pay.max.toLocaleString()}`.trim()
    else if (pay.min != null) range = `>= ${currency} ${pay.min.toLocaleString()}`.trim()
    else if (pay.max != null) range = `<= ${currency} ${pay.max.toLocaleString()}`.trim()
    if (!range && !pay.period && pay.ote == null) return null
    const periodStr = pay.period && pay.period !== 'unknown' ? ` / ${pay.period}` : ''
    const oteStr = pay.ote != null ? ` (OTE: ${pay.ote ? 'yes' : 'no'})` : ''
    return `${range || '—'}${periodStr}${oteStr}`.trim()
  }
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
    const locStr = formatLocation(opportunity.location)
    const payStr = formatPay(opportunity.pay)
    out.set(`opportunities/${slug(opportunity.id)}.md`, `# ${cell(opportunity.title)}\n\n[All opportunities](../opportunities.md) · Company: ${detailLink('companies', company.id, company.name)}\n\n- Posting: ${cell(opportunity.posting_state)}\n- Pursuit: ${cell(opportunity.pursuit_status)}\n- Work model: ${cell(opportunity.work_model)}\n- Location: ${cell(locStr)}\n- Pay: ${cell(payStr)}\n- Outcome: ${cell(opportunity.outcome)}\n- Source: ${opportunity.source_url ? `[external posting](${opportunity.source_url})` : '—'}\n\n## Application attempts\n\n${attempts.length ? attempts.map(item => `- ${detailLink('application-attempts', item.id)} — ${cell(item.lifecycle_status)}`).join('\n') : '_No application attempt_'}\n\n## People\n\n${people.length ? people.map(item => `- ${detailLink('people', item.id, item.name)}${item.role ? ` — ${cell(item.role)}` : ''}`).join('\n') : '_None recorded_'}\n\n## Interactions\n\n${interactions.length ? interactions.map(item => `- ${cell(item.kind)} — ${cell(item.occurred_at || 'date unresolved')}`).join('\n') : '_None_'}\n\n## Artifacts\n\n${artifacts.length ? artifacts.map(item => `- ${artifactLink(item)}`).join('\n') : '_None_'}\n`)
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
    if (type === 'actions' && !Array.isArray(model.actions)) continue
    const file = path.join(paths.recordsDir, RECORD_FILES[type]), data = json(model[type])
    if (changed(file, data)) out.set(file, data)
  }
  const manifestFile = path.join(paths.recordsDir, 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  const nextManifest = json({ ...manifest, schema_version: 5, model: 'nextstep-opportunity-graph', counts: counts(model) })
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

function journalPhase(onPhase, phase) {
  if (typeof onPhase !== 'function') return 'continue'
  const directive = onPhase(phase)
  if (directive === 'abrupt' || directive === 'crash') return 'abrupt'
  return 'continue'
}

// Rollback is allowed only while the journal file is still prepared.
// A committed journal is publication: deleting it is not rollback.
function publicationError(message) {
  throw Object.assign(new Error(message), { code: 'UNSAFE_PATH' })
}

// Symlink components are unsupported. Callers must not follow them into history or another file.
function describeFileTarget(file) {
  const absolute = path.resolve(file)
  const root = path.parse(absolute).root
  const parts = path.relative(root, absolute).split(path.sep).filter(Boolean)
  const missing = []
  let cursor = root
  for (let index = 0; index < parts.length; index += 1) {
    if (missing.length > 0) {
      missing.push(parts[index])
      continue
    }
    cursor = path.join(cursor, parts[index])
    let stat
    try { stat = fs.lstatSync(cursor) } catch (error) {
      if (error.code === 'ENOENT') {
        missing.push(parts[index])
        continue
      }
      if (error.code === 'ENOTDIR') return { error: 'unsafe' }
      return { error: 'unreadable' }
    }
    if (stat.isSymbolicLink()) return { error: 'unsafe' }
    const last = index === parts.length - 1
    if (last) {
      if (!stat.isFile()) return { error: 'unsafe' }
    } else if (!stat.isDirectory()) return { error: 'unsafe' }
  }
  if (missing.length === parts.length) return { error: 'unsafe' }
  try {
    if (missing.length > 0) {
      const existing = path.join(root, ...parts.slice(0, parts.length - missing.length))
      return { physical: path.join(fs.realpathSync.native(existing), ...missing) }
    }
    return { physical: fs.realpathSync.native(absolute) }
  } catch {
    return { error: 'unreadable' }
  }
}

function assertPhysicalIndexArea(paths, physical) {
  let stat
  try { stat = fs.lstatSync(paths.indexesDir) } catch (error) {
    if (error.code === 'ENOENT') return
    publicationError('Projected index path is unsafe')
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) publicationError('Projected index link is unsupported')
  let indexReal
  try { indexReal = fs.realpathSync.native(paths.indexesDir) } catch { publicationError('Projected index path is unsafe') }
  const relative = path.relative(indexReal, physical)
  if (relative.startsWith('..') || path.isAbsolute(relative)) publicationError('Projected index path escapes the indexes directory')
}

function requirePublicationFile(file) {
  const described = describeFileTarget(file)
  if (described.error) publicationError(described.error === 'unreadable' ? 'Publication target is unreadable' : 'Publication target is unsupported')
  return described.physical
}

export function assertIndexDestination(paths, file) {
  try { assertContained(paths.vaultRoot, file, 'Projected index') }
  catch (error) { publicationError(error.message) }
  assertPhysicalIndexArea(paths, requirePublicationFile(file))
}

function assertPublicationTarget(paths, file) {
  try { assertContained(paths.vaultRoot, file, 'Publication target') }
  catch (error) { publicationError(error.message) }
  const physical = requirePublicationFile(file)
  if (within(paths.indexesDir, file)) assertPhysicalIndexArea(paths, physical)
}

export function applyTransaction(paths, values, requestId, { onPhase } = {}) {
  const id = crypto.randomUUID(), journalFile = path.join(paths.journalDir, `${id}.json`)
  for (const file of values.keys()) assertPublicationTarget(paths, file)
  assertPublicationTarget(paths, journalFile)
  fs.mkdirSync(paths.journalDir, { recursive: true })
  const preimages = [...values.keys()].map(file => ({ file, existed: fs.existsSync(file), data: fs.existsSync(file) ? fs.readFileSync(file).toString('base64') : '' }))
  const journalBody = state => json({ schemaVersion: 1, id, requestId, state, preimages })
  atomicWrite(journalFile, journalBody('prepared'))
  const actionsFile = path.join(paths.recordsDir, RECORD_FILES.actions)
  const ledgerFile = paths.ledgerPath
  let abrupt = null
  const stop = phase => {
    if (journalPhase(onPhase, phase) !== 'abrupt') return false
    abrupt = phase
    return true
  }
  try {
    if (!stop('before-actions-rename')) {
      if (values.has(actionsFile)) atomicWrite(actionsFile, values.get(actionsFile))
      if (!stop('after-actions-rename')) {
        for (const [file, data] of values) {
          if (file === actionsFile || file === ledgerFile) continue
          atomicWrite(file, data)
        }
        if (values.has(ledgerFile)) atomicWrite(ledgerFile, values.get(ledgerFile))
        if (!stop('after-ledger-publication') && !stop('before-committed-marker')) atomicWrite(journalFile, journalBody('committed'))
      }
    }
  } catch (error) {
    let prepared = false
    try { prepared = fs.existsSync(journalFile) && JSON.parse(fs.readFileSync(journalFile, 'utf8')).state === 'prepared' } catch { prepared = false }
    if (prepared) {
      for (const item of preimages) item.existed ? atomicWrite(item.file, Buffer.from(item.data, 'base64')) : fs.rmSync(item.file, { force: true })
      fs.rmSync(journalFile, { force: true })
    }
    throw error
  }
  if (abrupt) throw Object.assign(new Error(`Transaction interrupted at ${abrupt}`), { code: 'INTERRUPTED', phase: abrupt, details: { phase: abrupt } })
  if (stop('after-committed-marker')) throw Object.assign(new Error('Transaction interrupted at after-committed-marker'), { code: 'INTERRUPTED', phase: 'after-committed-marker', details: { phase: 'after-committed-marker' } })
  try {
    if (typeof onPhase === 'function') onPhase('journal-delete')
    fs.rmSync(journalFile, { force: true })
  } catch {
    if (!fs.existsSync(journalFile)) return
    throw Object.assign(new Error('The publication is committed and was not rolled back'), {
      code: 'JOURNAL_CLEANUP_FAILED',
      details: { committed: true, publication: 'preserved', journalState: 'committed' }
    })
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

export function listDomainJournalFiles(paths) {
  let stat
  try { stat = fs.lstatSync(paths.journalDir) } catch (error) {
    if (error.code === 'ENOENT') return []
    if (error.code === 'ENOTDIR') unsafeJournal('unsafe')
    unsafeJournal('unreadable')
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) unsafeJournal('unsafe')
  if (!journalContained(paths, paths.journalDir)) unsafeJournal('unsafe')
  let names
  try { names = fs.readdirSync(paths.journalDir) } catch { unsafeJournal('unreadable') }
  return names.filter(name => name.endsWith('.json') && name !== 'ledger.json').sort().map(name => path.join(paths.journalDir, name))
}

function unsafeJournal(reason) {
  const message = reason === 'unsafe'
    ? 'Transaction journal contains an unsafe recovery target'
    : reason === 'unreadable'
      ? 'Transaction journal is unreadable'
      : 'Transaction journal is not a supported prepared or committed record'
  throw Object.assign(new Error(message), { code: 'UNSAFE_JOURNAL', details: { reason } })
}

function journalContained(paths, file) {
  try { assertContained(paths.vaultRoot, file, 'Recovery target'); return true } catch { return false }
}

function assertJournalFile(paths, file) {
  let stat
  try { stat = fs.lstatSync(file) } catch { unsafeJournal('unreadable') }
  if (stat.isSymbolicLink() || !stat.isFile()) unsafeJournal('unsafe')
  if (!journalContained(paths, file)) unsafeJournal('unsafe')
}

function canonicalBase64(data) {
  if (typeof data !== 'string') return false
  if (data.length === 0) return true
  if (data.length % 4 !== 0) return false
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) return false
  return Buffer.from(data, 'base64').toString('base64') === data
}

function assertRestoreTarget(paths, file) {
  if (!journalContained(paths, file)) unsafeJournal('unsafe')
  const described = describeFileTarget(file)
  if (described.error) unsafeJournal(described.error)
  return described.physical
}

function isStrictAncestor(parent, child) {
  const relative = path.relative(parent, child)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function assertRestorePlan(journals) {
  const protectedPaths = new Set()
  for (const { file } of journals) {
    const described = describeFileTarget(file)
    if (described.error) unsafeJournal(described.error)
    protectedPaths.add(described.physical)
    protectedPaths.add(path.resolve(file))
  }
  const targets = []
  for (const { journal } of journals) {
    if (journal.state !== 'prepared') continue
    for (const item of journal.preimages) {
      const described = describeFileTarget(item.file)
      if (described.error) unsafeJournal(described.error)
      const lexical = path.resolve(item.file)
      if (protectedPaths.has(described.physical) || protectedPaths.has(lexical)) unsafeJournal('unsafe')
      targets.push(described.physical)
    }
  }
  const seen = new Set()
  for (const target of targets) {
    if (seen.has(target)) unsafeJournal('unsafe')
    seen.add(target)
  }
  for (const target of targets) {
    for (const other of targets) {
      if (isStrictAncestor(target, other)) unsafeJournal('unsafe')
    }
  }
}

export function inspectDomainJournals(paths) {
  const files = listDomainJournalFiles(paths)
  for (const file of files) assertJournalFile(paths, file)
  const journals = []
  for (const file of files) {
    let journal
    try { journal = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { unsafeJournal('unreadable') }
    if (!journal || typeof journal !== 'object' || Array.isArray(journal) || journal.schemaVersion !== 1) unsafeJournal('unknown')
    if (journal.state !== 'prepared' && journal.state !== 'committed') unsafeJournal('unknown')
    if (!Array.isArray(journal.preimages)) unsafeJournal('unknown')
    for (const item of journal.preimages) {
      if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.file !== 'string' || typeof item.existed !== 'boolean' || typeof item.data !== 'string') unsafeJournal('unknown')
      if (!canonicalBase64(item.data)) unsafeJournal('unknown')
      assertRestoreTarget(paths, item.file)
    }
    journals.push({ file, journal })
  }
  assertRestorePlan(journals)
  return journals
}

export function restoreDomainJournals(paths, journals) {
  for (const { file, journal } of journals) {
    if (journal.state === 'prepared') {
      for (const item of journal.preimages) item.existed ? atomicWrite(item.file, Buffer.from(item.data, 'base64')) : fs.rmSync(item.file, { force: true })
    }
    fs.rmSync(file, { force: true })
  }
  return { performed: journals.length > 0, journals: journals.length }
}

function dryRunMutation(paths, envelope, operation) {
  requireCurrentVault(paths)
  const { requestId, idempotencyKey } = envelope
  const entry = loadLedger(paths).entries[idempotencyKey]
  if (entry) {
    if (entry.digest !== digest(envelope)) throw Object.assign(new Error('Idempotency key was reused for another command'), { code: 'IDEMPOTENCY_CONFLICT' })
    return { ...entry.result, replayed: true, dryRun: true }
  }
  const model = loadModel(paths), result = operation(model)
  rebuildBacklinks(model)
  validateModel(model, { paths, pendingFiles: result.extraOutputs })
  return { schemaVersion: 1, requestId, status: 'dry_run', dryRun: true, changedEntities: result.changedEntities || [], revision: result.revision ?? null, warnings: result.warnings || [], unresolvedEvidence: result.unresolvedEvidence || [], nextActions: result.nextActions || [] }
}

export function mutate(paths, envelope, operation) {
  if (paths.vaultState === 'uninitialized') {
    throw Object.assign(new Error('Cannot mutate an uninitialized vault; run from a vault directory'), { code: 'VAULT_NOT_INITIALIZED' })
  }
  const { requestId, idempotencyKey, actor = 'user' } = envelope
  if (!requestId || !idempotencyKey) throw Object.assign(new Error('Mutations require requestId and idempotencyKey'), { code: 'INVALID_ENVELOPE' })
  if (paths.dryRun) return dryRunMutation(paths, envelope, operation)
  const release = acquireCommit(paths, requestId)
  try {
    // Version and actions still reject before recovery. v5 career counts are checked again after recovery, before ledger replay.
    requireCurrentVault(paths, { deferCareerCounts: true })
    recoverTransactions(paths)
    requireCurrentVault(paths)
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

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { holoselfContext, holoselfVersion } from './holoself.mjs'
import { findEntity, loadModel, sha, shaFile, validateScope, fail } from './model.mjs'
import { mutate, transactionStatus } from './storage.mjs'
import { assertContained, within } from './config.mjs'

const VERSION = '1.0.0'
const ENTITY_TYPES = { company: 'companies', vacancy: 'vacancies', application: 'applications', person: 'people', interaction: 'interactions' }
const CONTEXT_INTENTS = new Set(['analyze', 'outreach', 'drafting', 'application', 'interview'])
const now = () => new Date().toISOString()
const slug = value => String(value).replace(/^[^:]+:/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()

function fileFor(paths, artifact) {
  const file = path.resolve(paths.candidaturesDir, artifact.path || '')
  try { return assertContained(paths.candidaturesDir, file, 'Artifact path') } catch (error) { fail(error.message, 'UNSAFE_PATH') }
}

function mediaType(file) {
  if (/\.md$/i.test(file)) return 'text/markdown'
  if (/\.docx$/i.test(file)) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (/\.pdf$/i.test(file)) return 'application/pdf'
  return 'application/octet-stream'
}

function validateDocument(file) {
  const data = fs.readFileSync(file)
  if (!data.length) fail('Document is empty', 'INVALID_DOCUMENT')
  if (/\.docx$/i.test(file)) {
    const zipHeader = data.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
    const zipEnd = data.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
    const contentTypes = data.includes(Buffer.from('[Content_Types].xml'))
    const mainDocument = data.includes(Buffer.from('word/document.xml'))
    if (!zipHeader || zipEnd < 0 || !contentTypes || !mainDocument) fail('DOCX container is structurally invalid', 'INVALID_DOCUMENT')
  }
  if (/\.pdf$/i.test(file) && (!data.subarray(0, 5).equals(Buffer.from('%PDF-')) || !data.subarray(Math.max(0, data.length - 2048)).includes(Buffer.from('%%EOF')))) fail('PDF container is structurally invalid', 'INVALID_DOCUMENT')
  return { bytes: data, sha256: sha(data), sizeBytes: data.length }
}

function snapshot(paths, artifact, data) {
  const extension = path.extname(artifact.path).toLowerCase() || '.bin'
  const relative = `artifacts/.versions/${slug(artifact.id)}/${data.sha256}${extension}`
  return { relative, absolute: assertContained(paths.candidaturesDir, path.join(paths.candidaturesDir, relative), 'Snapshot path') }
}

function envelope(command, input = {}) {
  if (input.schemaVersion !== 1) fail('schemaVersion must be 1', 'INVALID_ENVELOPE')
  return { ...input, command, actor: input.actor || 'user' }
}

export function capabilities() {
  return {
    schemaVersion: 1,
    product: 'nextstep',
    version: VERSION,
    interface: 'local-cli',
    transport: ['stdin-json', 'stdout-json'],
    mutationAuthority: 'domain-engine',
    agentRuntime: 'external',
    workflows: ['analysis-only', 'research', 'networking', 'drafting', 'application', 'tracking', 'interview'],
    contextIntents: [...CONTEXT_INTENTS],
    contextBudgets: ['small', 'standard', 'deep'],
    commands: ['capabilities', 'doctor', 'context build', 'get', 'validate', 'entity upsert', 'artifact status', 'artifact register', 'artifact adopt', 'artifact bootstrap-snapshots', 'interaction record', 'application record-submission']
  }
}

export function doctor(paths) {
  const checks = {
    dataRoot: { ok: true },
    stateRoot: { ok: within(paths.vaultRoot, paths.stateRoot) },
    model: { ok: false },
    recovery: { ok: false },
    holoself: { ok: false }
  }
  try { const state = transactionStatus(paths); checks.recovery = { ok: state.pending === 0, ...state } } catch (error) { checks.recovery = { ok: false, error: error.code || error.message } }
  try { checks.model = { ok: true, ...validateScope(loadModel(paths), 'structure', paths) } } catch (error) { checks.model = { ok: false, error: error.code || error.message, details: error.details } }
  try { checks.holoself = { ok: true, ...holoselfVersion({ cwd: paths.vaultRoot }) } } catch (error) { checks.holoself = { ok: false, error: error.code || error.message } }
  return { schemaVersion: 1, status: Object.values(checks).every(x => x.ok) ? 'healthy' : 'degraded', checks }
}

export function get(paths, id) {
  const entity = findEntity(loadModel(paths), id)
  if (!entity) fail(`Entity not found: ${id}`, 'NOT_FOUND')
  return { schemaVersion: 1, status: 'ok', ...entity }
}

export function validate(paths, scope) { return { schemaVersion: 1, status: 'ok', ...validateScope(loadModel(paths), scope || 'structure', paths) } }

const SELF_DOCS = {
  outreach: ['profile/identity.md', 'profile/preferences.md', 'context/career.md', 'context/claims.md'],
  drafting: ['profile/identity.md', 'profile/voice.md', 'context/career.md', 'context/claims.md', 'context/evidence.md', 'context/story-bank.md'],
  application: ['profile/identity.md', 'profile/preferences.md', 'context/career.md', 'context/claims.md', 'context/evidence.md', 'context/positioning.md'],
  interview: ['profile/identity.md', 'context/career.md', 'context/claims.md', 'context/evidence.md', 'context/story-bank.md', 'context/leadership.md'],
  analyze: ['profile/identity.md', 'context/career.md', 'context/claims.md', 'context/evidence.md', 'context/positioning.md']
}

const CONTEXT_BUDGETS = {
  small: { selfCount: 1, selfChars: 1200, subjectCount: 1, subjectChars: 1600, strategyChars: 1200 },
  standard: { selfCount: 2, selfChars: 1800, subjectCount: 2, subjectChars: 2200, strategyChars: 2500 },
  deep: { selfCount: 6, selfChars: 8000, subjectCount: 6, subjectChars: 10000, strategyChars: 12000 }
}

function compactSelf(data, intent, limits) {
  const wanted = SELF_DOCS[intent] || SELF_DOCS.analyze, byPath = new Map((data?.self?.documents || []).map(document => [document.path, document]))
  const documents = wanted.map(p => byPath.get(p)).filter(Boolean).slice(0, limits.selfCount).map(document => ({ ...document, content: String(document.content || '').slice(0, limits.selfChars), truncated: String(document.content || '').length > limits.selfChars }))
  return { lens: data?.lens, validation: data?.validation, warnings: data?.warnings || [], documents, selectedSources: documents.length }
}

function subjectBundle(paths, model, subject, intent, limits) {
  if (!subject) return null
  const found = findEntity(model, subject)
  if (!found) fail(`Entity not found: ${subject}`, 'NOT_FOUND')
  const entities = { primary: found.value }, artifactIds = new Set(found.value.artifact_ids || found.value.profile_artifact_ids || found.value.snapshot_artifact_ids || [])
  if (found.type === 'applications') {
    const vacancy = model.vacancies.find(v => v.id === found.value.vacancy_id), company = model.companies.find(c => c.id === vacancy?.company_id)
    entities.vacancy = vacancy; entities.company = company
    entities.people = model.people.filter(p => (found.value.people_relations || []).some(r => r.person_id === p.id))
    entities.interactions = model.interactions.filter(i => i.application_id === found.value.id)
    for (const id of vacancy?.snapshot_artifact_ids || []) artifactIds.add(id)
    for (const id of company?.profile_artifact_ids || []) artifactIds.add(id)
    for (const person of entities.people) for (const id of person.profile_artifact_ids || []) artifactIds.add(id)
  } else if (found.type === 'vacancies') {
    entities.company = model.companies.find(c => c.id === found.value.company_id)
    for (const id of entities.company?.profile_artifact_ids || []) artifactIds.add(id)
  } else if (found.type === 'people') entities.interactions = model.interactions.filter(i => (i.person_ids || []).includes(found.value.id))
  else if (found.type === 'companies') entities.vacancies = model.vacancies.filter(v => v.company_id === found.value.id)
  const priorities = intent === 'outreach' ? /outreach|people|profile|job-description/i : intent === 'interview' ? /interview|fit-analysis|job-description|profile/i : /job-description|fit-analysis|cv|application-letter|profile/i
  const artifacts = model.artifacts.filter(a => artifactIds.has(a.id)).sort((a, b) => Number(priorities.test(b.path)) - Number(priorities.test(a.path)))
  const documents = []
  for (const artifact of artifacts) {
    if (documents.length >= limits.subjectCount || !/\.md$/i.test(artifact.path)) continue
    const file = fileFor(paths, artifact)
    if (!fs.existsSync(file) || shaFile(file) !== artifact.sha256) continue
    const content = fs.readFileSync(file, 'utf8')
    documents.push({ artifactId: artifact.id, kind: artifact.kind, path: artifact.path, sha256: artifact.sha256, content: content.slice(0, limits.subjectChars), truncated: content.length > limits.subjectChars })
  }
  return { entities, artifacts: artifacts.map(({ id, kind, owner_type, owner_id, path: artifactPath, sha256 }) => ({ id, kind, owner_type, owner_id, path: artifactPath, sha256 })), documents }
}

export function buildContext(paths, { intent = 'analyze', subject, task, budget = 'standard' } = {}) {
  if (!CONTEXT_INTENTS.has(intent)) fail(`Unsupported context intent: ${intent}`, 'INVALID_INTENT')
  const limits = CONTEXT_BUDGETS[budget]
  if (!limits) fail(`Unsupported context budget: ${budget}`, 'INVALID_BUDGET')
  const model = loadModel(paths), related = subjectBundle(paths, model, subject, intent, limits)
  const strategyFile = path.join(paths.candidaturesDir, 'config', 'executive-search-strategy.yaml')
  const strategyText = fs.existsSync(strategyFile) ? fs.readFileSync(strategyFile, 'utf8') : null
  const strategy = strategyText == null ? null : { content: strategyText.slice(0, limits.strategyChars), truncated: strategyText.length > limits.strategyChars }
  let self = null, warning = null
  try { self = compactSelf(holoselfContext(paths, { task: task || `${intent}${subject ? ` ${subject}` : ''}` }), intent, limits) } catch (error) { warning = { code: error.code, message: error.message } }
  const packet = { schemaVersion: 1, intent, budget, subject: related, strategy, self }
  return { status: warning ? 'degraded' : 'ok', packet, packetHash: sha(JSON.stringify(packet)), warnings: warning ? [warning] : [] }
}

export function artifactStatus(paths, { artifactId, applicationId, all = false } = {}) {
  const model = loadModel(paths)
  if (!artifactId && !applicationId && !all) fail('Select --artifact, --application, or explicit --all', 'SCOPE_REQUIRED')
  const selected = model.artifacts.filter(a => artifactId ? a.id === artifactId : applicationId ? a.owner_type === 'application' && a.owner_id === applicationId : true)
  if (artifactId && !selected.length) fail(`Artifact not found: ${artifactId}`, 'NOT_FOUND')
  return { schemaVersion: 1, status: 'ok', artifacts: selected.map(a => {
    const file = fileFor(paths, a), exists = fs.existsSync(file), currentSha = exists ? shaFile(file) : null
    return { id: a.id, path: a.path, exists, state: !exists ? 'missing' : currentSha === a.sha256 ? 'clean' : 'user_revision_pending', recordedSha256: a.sha256, currentSha256: currentSha, authorship: a.authorship || null }
  }) }
}

export function upsertEntity(paths, raw) {
  const input = envelope('entity.upsert', raw), type = ENTITY_TYPES[input.payload?.type], record = input.payload?.record
  if (!type || !record?.id || !record.id.startsWith(`${input.payload.type}:`)) fail('Invalid entity upsert payload', 'INVALID_COMMAND')
  return mutate(paths, input, model => {
    const existing = model[type].findIndex(x => x.id === record.id)
    if (existing >= 0) {
      const current = model[type][existing]
      if (input.expectedRevision != null && current.source_revision !== input.expectedRevision) fail('Entity revision changed', 'STALE_REVISION', { currentRevision: current.source_revision })
      model[type][existing] = { ...record, source_revision: (current.source_revision || 0) + 1 }
    } else model[type].push({ ...record, source_revision: record.source_revision || 0 })
    return { changedEntities: [record.id], revision: model[type].find(x => x.id === record.id).source_revision }
  })
}

export function registerArtifact(paths, raw) {
  const input = envelope('artifact.register', raw), record = { ...input.payload?.record }
  if (!record.path || !record.owner_type || (record.owner_type !== 'shared' && !record.owner_id)) fail('Artifact path and owner are required', 'INVALID_COMMAND')
  record.id ||= `artifact:${crypto.randomUUID()}`
  const file = fileFor(paths, record)
  if (!fs.existsSync(file)) fail(`Artifact file not found: ${record.path}`, 'NOT_FOUND')
  const data = validateDocument(file), version = snapshot(paths, record, data)
  return mutate(paths, input, model => {
    if (model.artifacts.some(a => a.id === record.id || a.path === record.path)) fail('Artifact ID or path already exists', 'ARTIFACT_CONFLICT')
    Object.assign(record, { sha256: data.sha256, size_bytes: data.sizeBytes, media_type: record.media_type || mediaType(file), authorship: record.authorship || 'user', revisions: [{ version: record.document?.version || 1, sha256: data.sha256, size_bytes: data.sizeBytes, authorship: record.authorship || 'user', committed_at: now(), snapshot_path: version.relative }] })
    model.artifacts.push(record)
    return { changedEntities: [record.id, record.owner_id].filter(Boolean), extraOutputs: new Map([[version.absolute, data.bytes]]) }
  })
}

export function adoptArtifact(paths, raw) {
  const input = envelope('artifact.adopt', raw), id = input.payload?.artifactId, authorship = input.payload?.authorship || 'user'
  if (!['user', 'ai', 'mixed'].includes(authorship)) fail('Invalid authorship', 'INVALID_COMMAND')
  return mutate(paths, input, model => {
    const artifact = model.artifacts.find(a => a.id === id)
    if (!artifact) fail(`Artifact not found: ${id}`, 'NOT_FOUND')
    if (input.payload.expectedSha256 && artifact.sha256 !== input.payload.expectedSha256) fail('Artifact record changed', 'STALE_REVISION', { currentSha256: artifact.sha256 })
    const file = fileFor(paths, artifact), data = validateDocument(file)
    if (data.sha256 === artifact.sha256) return { status: 'unchanged', changedEntities: [], revision: artifact.document?.version || null }
    const version = snapshot(paths, artifact, data)
    const nextVersion = (artifact.document?.version || artifact.revisions?.at(-1)?.version || 0) + 1
    artifact.revisions ||= []
    artifact.revisions.push({ version: nextVersion, sha256: data.sha256, size_bytes: data.sizeBytes, authorship, committed_at: now(), snapshot_path: version.relative })
    artifact.sha256 = data.sha256; artifact.size_bytes = data.sizeBytes; artifact.authorship = authorship
    if (artifact.document) {
      artifact.document.version = nextVersion
      if (/\.docx$/i.test(artifact.path) && artifact.document.representation === 'generated_docx') artifact.document.representation = 'user_edited_docx'
    }
    return { changedEntities: [artifact.id, artifact.owner_id].filter(Boolean), revision: nextVersion, extraOutputs: new Map([[version.absolute, data.bytes]]) }
  })
}

export function bootstrapSnapshots(paths, raw) {
  const input = envelope('artifact.bootstrapSnapshots', raw)
  return mutate(paths, input, model => {
    const extraOutputs = new Map(), changed = [], warnings = []
    for (const artifact of model.artifacts.filter(a => a.document)) {
      const file = fileFor(paths, artifact)
      if (!fs.existsSync(file) || shaFile(file) !== artifact.sha256) { warnings.push({ code: 'ARTIFACT_DRIFT', artifactId: artifact.id }); continue }
      const data = validateDocument(file), version = snapshot(paths, artifact, data)
      artifact.revisions ||= []
      if (!artifact.revisions.some(r => r.sha256 === data.sha256)) {
        artifact.revisions.push({ version: artifact.document?.version || 1, sha256: data.sha256, size_bytes: data.sizeBytes, authorship: artifact.authorship || 'mixed', committed_at: now(), snapshot_path: version.relative })
        extraOutputs.set(version.absolute, data.bytes); changed.push(artifact.id)
      }
    }
    for (const interaction of model.interactions) {
      for (const item of interaction.submission_bundle?.items || []) {
        const artifact = model.artifacts.find(a => a.id === item.transmitted_artifact_id) || model.artifacts.find(a => a.id === item.artifact_id)
        const revision = artifact?.revisions?.find(r => r.sha256 === (item.transmitted_sha256 || item.sha256))
        if (revision) item.snapshot_path = revision.snapshot_path
      }
      if (interaction.submission_bundle?.items?.length && interaction.submission_bundle.items.every(item => item.snapshot_path) && interaction.submission_bundle.schema_version !== 2) { interaction.submission_bundle.schema_version = 2; changed.push(interaction.id) }
      if (interaction.transmission) {
        const artifact = model.artifacts.find(a => a.id === interaction.transmission.message_artifact_id)
        const revision = artifact?.revisions?.find(r => r.sha256 === interaction.transmission.message_sha256)
        if (revision) interaction.transmission.snapshot_path = revision.snapshot_path
        if (interaction.transmission.snapshot_path && interaction.transmission.schema_version !== 2) { interaction.transmission.schema_version = 2; changed.push(interaction.id) }
      }
    }
    return { changedEntities: changed, warnings, extraOutputs }
  })
}

export function recordInteraction(paths, raw) {
  const input = envelope('interaction.record', raw), payload = input.payload || {}, record = { ...payload.record }
  if (!record.id) record.id = `interaction:${crypto.randomUUID()}`
  if (!record.id.startsWith('interaction:') || !record.kind || !record.evidence_state) fail('Invalid interaction payload', 'INVALID_COMMAND')
  if (record.evidence_state === 'confirmed' && !record.occurred_at) fail('Confirmed interactions require occurred_at', 'INVALID_COMMAND')
  const outreach = ['outreach', 'outreach_sent'].includes(record.kind)
  if (outreach && record.evidence_state === 'confirmed' && (!payload.channel || !payload.recipient || !payload.objective)) fail('Confirmed outreach requires channel, recipient, and objective', 'INVALID_COMMAND')
  if (record.transmission) fail('Supply messageArtifactId; transmission metadata is generated by Nextstep', 'INVALID_COMMAND')
  record.person_ids ||= []; record.artifact_ids ||= []; record.provenance ||= [`command:${input.requestId}`]
  return mutate(paths, input, model => {
    if (model.interactions.some(i => i.id === record.id)) fail(`Interaction exists: ${record.id}`, 'INTERACTION_CONFLICT')
    const extraOutputs = new Map()
    if (outreach && record.evidence_state === 'confirmed') record.outreach = { channel: payload.channel, recipient: payload.recipient, objective: payload.objective }
    if (payload.messageArtifactId) {
      if (!outreach || record.evidence_state !== 'confirmed') fail('messageArtifactId is only valid for confirmed outreach', 'INVALID_COMMAND')
      const artifact = model.artifacts.find(a => a.id === payload.messageArtifactId)
      if (!artifact) fail(`Artifact not found: ${payload.messageArtifactId}`, 'NOT_FOUND')
      const file = fileFor(paths, artifact), data = validateDocument(file), version = snapshot(paths, artifact, data)
      artifact.revisions ||= []
      if (!artifact.revisions.some(revision => revision.sha256 === data.sha256)) artifact.revisions.push({ version: artifact.document?.version || 1, sha256: data.sha256, size_bytes: data.sizeBytes, authorship: artifact.authorship || 'mixed', committed_at: now(), snapshot_path: version.relative })
      artifact.sha256 = data.sha256; artifact.size_bytes = data.sizeBytes
      record.artifact_ids = [...new Set([...record.artifact_ids, artifact.id])]
      record.transmission = { schema_version: 2, selection_mode: 'explicit', channel: payload.channel, sent_at: record.occurred_at, confirmed_at: payload.confirmedAt || record.occurred_at, message_artifact_id: artifact.id, message_sha256: data.sha256, objective: payload.objective, snapshot_path: version.relative }
      extraOutputs.set(version.absolute, data.bytes)
    }
    model.interactions.push(record)
    return { changedEntities: [record.id, record.application_id, record.vacancy_id, record.company_id, ...record.person_ids, payload.messageArtifactId].filter(Boolean), extraOutputs, unresolvedEvidence: outreach && record.evidence_state === 'confirmed' && !payload.messageArtifactId ? ['Exact outreach content was not supplied.'] : [] }
  })
}

export function recordSubmission(paths, raw) {
  const input = envelope('application.recordSubmission', raw), payload = input.payload || {}
  if (!payload.applicationId || !payload.channel || !payload.occurredAt) fail('applicationId, channel and occurredAt are required', 'INVALID_COMMAND')
  return mutate(paths, input, model => {
    const application = model.applications.find(a => a.id === payload.applicationId)
    if (!application) fail(`Application not found: ${payload.applicationId}`, 'NOT_FOUND')
    if (input.expectedRevision != null && application.source_revision !== input.expectedRevision) fail('Application revision changed', 'STALE_REVISION', { currentRevision: application.source_revision })
    let artifacts = (payload.artifactIds || []).map(id => model.artifacts.find(a => a.id === id))
    if (artifacts.some(a => !a || a.owner_type !== 'application' || a.owner_id !== application.id)) fail('Submission artifacts must belong to the application', 'INVALID_ARTIFACT_SELECTION')
    const extraOutputs = new Map(), items = []
    for (const artifact of artifacts) {
      const file = fileFor(paths, artifact), data = validateDocument(file), version = snapshot(paths, artifact, data)
      extraOutputs.set(version.absolute, data.bytes)
      artifact.revisions ||= []
      if (!artifact.revisions.some(r => r.sha256 === data.sha256)) artifact.revisions.push({ version: artifact.document?.version || 1, sha256: data.sha256, size_bytes: data.sizeBytes, authorship: artifact.authorship || 'mixed', committed_at: now(), snapshot_path: version.relative })
      artifact.sha256 = data.sha256; artifact.size_bytes = data.sizeBytes
      items.push({ role: artifact.document?.role || artifact.kind, artifact_id: artifact.id, version: artifact.document?.version || 1, sha256: data.sha256, snapshot_path: version.relative })
    }
    const interaction = { id: payload.interactionId || `interaction:${slug(application.id)}:submission-${Date.parse(payload.occurredAt) || Date.now()}`, application_id: application.id, vacancy_id: application.vacancy_id, person_ids: [], kind: 'submission', evidence_state: 'confirmed', occurred_at: payload.occurredAt, artifact_ids: artifacts.map(a => a.id), submission_bundle: { schema_version: 2, selection_mode: 'explicit', channel: payload.channel, confirmed_at: payload.occurredAt, note: payload.note || null, items }, provenance: [`command:${input.requestId}`] }
    if (model.interactions.some(i => i.id === interaction.id)) fail(`Interaction exists: ${interaction.id}`, 'INTERACTION_CONFLICT')
    model.interactions.push(interaction); application.lifecycle_status = 'applied'; application.updated = payload.occurredAt.slice(0, 10); application.source_revision = (application.source_revision || 0) + 1
    return { changedEntities: [application.id, interaction.id, ...artifacts.map(a => a.id)], revision: application.source_revision, extraOutputs, unresolvedEvidence: artifacts.length ? [] : ['No transmitted artifacts were asserted.'] }
  })
}

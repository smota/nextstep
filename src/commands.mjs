import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { holoselfContext, holoselfVersion } from './holoself.mjs'
import { findEntity, loadModel, sha, shaFile, validateScope, fail } from './model.mjs'
import { mutate, transactionStatus } from './storage.mjs'
import { assertContained, within } from './config.mjs'
import { loadStrategyCatalog, strategyDefinition, strategyDefinitions } from './strategy-catalog.mjs'

const VERSION = '1.1.0'
const ENTITY_TYPES = { company: 'companies', vacancy: 'vacancies', application: 'applications', person: 'people', interaction: 'interactions' }
const CONTEXT_INTENTS = new Set(['analyze', 'outreach', 'drafting', 'application', 'interview'])
const STRATEGY_TRANSITIONS = {
  draft: new Set(['active', 'abandoned']),
  active: new Set(['paused', 'completed', 'abandoned']),
  paused: new Set(['active', 'completed', 'abandoned']),
  completed: new Set(),
  abandoned: new Set()
}
const EXPERIMENT_TRANSITIONS = {
  draft: new Set(['running', 'abandoned']),
  running: new Set(['paused', 'completed', 'abandoned']),
  paused: new Set(['running', 'completed', 'abandoned']),
  completed: new Set(),
  abandoned: new Set()
}
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
  const definitions = strategyDefinitions()
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
    strategyDefinitions: definitions.map(({ id, version, label, category }) => ({ id, version, label, category })),
    commands: ['capabilities', 'doctor', 'context build', 'get', 'validate', 'entity upsert', 'strategy definitions', 'strategy definition', 'strategy list', 'strategy get', 'strategy guide', 'strategy evaluate', 'strategy initialize', 'strategy create', 'strategy update', 'strategy set-status', 'experiment list', 'experiment get', 'experiment evaluate', 'experiment create', 'experiment update', 'experiment set-status', 'artifact status', 'artifact register', 'artifact adopt', 'artifact bootstrap-snapshots', 'interaction record', 'application record-submission']
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
  try { const definitions = strategyDefinitions(); checks.strategyCatalog = { ok: true, definitions: definitions.length } } catch (error) { checks.strategyCatalog = { ok: false, error: error.message } }
  try { checks.holoself = { ok: true, ...holoselfVersion({ cwd: paths.vaultRoot }) } } catch (error) { checks.holoself = { ok: false, error: error.code || error.message } }
  return { schemaVersion: 1, status: Object.values(checks).every(x => x.ok) ? 'healthy' : 'degraded', checks }
}

export function get(paths, id) {
  const entity = findEntity(loadModel(paths), id)
  if (!entity) fail(`Entity not found: ${id}`, 'NOT_FOUND')
  return { schemaVersion: 1, status: 'ok', ...entity }
}

export function validate(paths, scope) { return { schemaVersion: 1, status: 'ok', ...validateScope(loadModel(paths), scope || 'structure', paths) } }

export function listStrategyDefinitions({ category } = {}) {
  const catalog = loadStrategyCatalog(), definitions = catalog.definitions.filter(definition => !category || definition.category === category)
  const referenced = new Set(definitions.flatMap(definition => definition.source_refs))
  return { schemaVersion: 1, status: 'ok', definitions, sources: catalog.sources.filter(source => referenced.has(source.id)) }
}

export function getStrategyDefinition(id) {
  const definition = strategyDefinition(id)
  if (!definition) fail(`Strategy definition not found: ${id}`, 'NOT_FOUND')
  const catalog = loadStrategyCatalog(), referenced = new Set(definition.source_refs)
  return { schemaVersion: 1, status: 'ok', definition, sources: catalog.sources.filter(source => referenced.has(source.id)) }
}

export function listStrategies(paths, { status, definitionId, subject } = {}) {
  const model = loadModel(paths)
  const subjectEntity = subject ? findEntity(model, subject) : null
  if (subject && !subjectEntity) fail(`Entity not found: ${subject}`, 'NOT_FOUND')
  const strategies = model.strategies.filter(strategy => (!status || strategy.status === status) && (!definitionId || strategy.definition_id === definitionId) && (!subject || (strategy.scope?.subject_ids || []).includes(subject) || subjectEntity.value?.strategy_ids?.includes(strategy.id)))
  return { schemaVersion: 1, status: 'ok', strategies }
}

export function getStrategy(paths, id) {
  const strategy = loadModel(paths).strategies.find(item => item.id === id)
  if (!strategy) fail(`Strategy not found: ${id}`, 'NOT_FOUND')
  const definition = strategyDefinition(strategy.definition_id)
  if (!definition) fail(`Strategy definition not found: ${strategy.definition_id}`, 'STRATEGY_DEFINITION_NOT_FOUND')
  return { schemaVersion: 1, status: 'ok', strategy, definition }
}

export function strategyGuide(paths, { id, phase, subject } = {}) {
  const model = loadModel(paths), strategy = model.strategies.find(item => item.id === id)
  if (!strategy) fail(`Strategy not found: ${id}`, 'NOT_FOUND')
  const definition = strategyDefinition(strategy.definition_id)
  if (!definition) fail(`Strategy definition not found: ${strategy.definition_id}`, 'STRATEGY_DEFINITION_NOT_FOUND')
  if (subject && !findEntity(model, subject)) fail(`Entity not found: ${subject}`, 'NOT_FOUND')
  const phases = phase ? definition.phases.filter(item => item.id === phase) : definition.phases
  if (phase && !phases.length) fail(`Strategy phase not found: ${phase}`, 'NOT_FOUND')
  const scoped = !subject || !(strategy.scope?.subject_ids || []).length || (strategy.scope.subject_ids || []).includes(subject) || findEntity(model, subject)?.value?.strategy_ids?.includes(strategy.id)
  return {
    schemaVersion: 1,
    status: 'ok',
    strategy: { id: strategy.id, status: strategy.status, objective: strategy.objective, parameters: strategy.parameters || {}, success_criteria: strategy.success_criteria || [] },
    definition: { id: definition.id, version: definition.version, label: definition.label, category: definition.category, purpose: definition.purpose },
    applicability: { subject: subject || null, withinConfiguredScope: scoped, requirements: definition.applicability },
    instructions: phases,
    metrics: definition.metrics,
    guardrails: definition.guardrails
  }
}

const confirmed = interaction => interaction.evidence_state === 'confirmed'
const kindIn = (interaction, kinds) => kinds.includes(interaction.kind)

function observations(interactions) {
  const verified = interactions.filter(confirmed)
  return {
    attributed_interactions: interactions.length,
    confirmed_events: verified.length,
    confirmed_submissions: verified.filter(item => item.kind === 'submission').length,
    outreach_sent: verified.filter(item => kindIn(item, ['outreach', 'outreach_sent'])).length,
    outreach_response: verified.filter(item => item.kind === 'outreach_response').length,
    human_response: verified.filter(item => kindIn(item, ['human_response', 'outreach_response', 'screen', 'interview'])).length,
    positive_progress: verified.filter(item => kindIn(item, ['positive_progress', 'screen', 'interview', 'offer'])).length,
    human_conversations: verified.filter(item => kindIn(item, ['conversation', 'screen', 'interview'])).length,
    introductions: verified.filter(item => item.kind === 'introduction').length,
    preparation_hours: verified.reduce((total, item) => total + (Number.isFinite(item.effort_hours) ? item.effort_hours : 0), 0)
  }
}

function criterionResult(criterion, values) {
  const actual = values[criterion.metric]
  if (actual == null) return { ...criterion, status: 'unmeasured', actual: null }
  const comparisons = { '>=': (a, b) => a >= b, '>': (a, b) => a > b, '<=': (a, b) => a <= b, '<': (a, b) => a < b, '==': (a, b) => a === b }
  const compare = comparisons[criterion.operator]
  if (!compare || typeof criterion.value !== 'number') return { ...criterion, status: 'invalid', actual }
  return { ...criterion, status: compare(actual, criterion.value) ? 'met' : 'not_met', actual }
}

export function evaluateStrategy(paths, id) {
  const model = loadModel(paths), strategy = model.strategies.find(item => item.id === id)
  if (!strategy) fail(`Strategy not found: ${id}`, 'NOT_FOUND')
  const interactions = model.interactions.filter(item => (item.strategy_ids || []).includes(id)), observed = observations(interactions)
  const definition = strategyDefinition(strategy.definition_id)
  if (!definition) fail(`Strategy definition not found: ${strategy.definition_id}`, 'STRATEGY_DEFINITION_NOT_FOUND')
  const measured = new Set(Object.keys(observed))
  return { schemaVersion: 1, status: 'ok', strategyId: id, evidenceBoundary: 'confirmed-events-only', observed, criteria: (strategy.success_criteria || []).map(criterion => criterionResult(criterion, observed)), unmeasuredDefinitionMetrics: definition.metrics.filter(metric => !measured.has(metric)) }
}

export function initializeStrategies(paths, raw) {
  const input = envelope('strategy.initialize', raw)
  return mutate(paths, input, model => ({ status: fs.existsSync(path.join(paths.recordsDir, 'strategies.json')) && fs.existsSync(path.join(paths.recordsDir, 'experiments.json')) ? 'unchanged' : 'applied', changedEntities: [] }), { allowUninitializedStrategy: true })
}

function validateStrategyRecord(record) {
  if (!record?.id?.startsWith('strategy:') || !record.definition_id || !strategyDefinition(record.definition_id) || !record.objective?.trim()) fail('Invalid strategy record', 'INVALID_COMMAND')
}

export function createStrategy(paths, raw) {
  const input = envelope('strategy.create', raw), record = { ...input.payload?.record }
  validateStrategyRecord(record)
  record.status ||= 'draft'; record.source_revision = 0; record.scope ||= { subject_ids: [] }; record.success_criteria ||= []; record.provenance ||= [`command:${input.requestId}`]
  return mutate(paths, input, model => {
    if (model.strategies.some(item => item.id === record.id)) fail(`Strategy exists: ${record.id}`, 'STRATEGY_CONFLICT')
    model.strategies.push(record)
    return { changedEntities: [record.id], revision: 0 }
  })
}

export function updateStrategy(paths, raw) {
  const input = envelope('strategy.update', raw), id = input.payload?.strategyId, changes = { ...input.payload?.changes }
  if (!id || input.expectedRevision == null || 'id' in changes || 'definition_id' in changes || 'source_revision' in changes || 'status' in changes) fail('strategyId, expectedRevision, and non-identity non-status changes are required', 'INVALID_COMMAND')
  return mutate(paths, input, model => {
    const strategy = model.strategies.find(item => item.id === id)
    if (!strategy) fail(`Strategy not found: ${id}`, 'NOT_FOUND')
    if (strategy.source_revision !== input.expectedRevision) fail('Strategy revision changed', 'STALE_REVISION', { currentRevision: strategy.source_revision })
    const next = { ...strategy, ...changes, id, status: strategy.status, source_revision: strategy.source_revision + 1 }
    validateStrategyRecord(next); Object.assign(strategy, next)
    return { changedEntities: [id], revision: strategy.source_revision }
  })
}

function setLifecycleStatus(paths, raw, { entity, collection, command, transitions }) {
  const input = envelope(command, raw), id = input.payload?.[`${entity}Id`], nextStatus = input.payload?.status
  if (!id || !nextStatus || input.expectedRevision == null) fail(`${entity}Id, status, and expectedRevision are required`, 'INVALID_COMMAND')
  return mutate(paths, input, model => {
    const record = model[collection].find(item => item.id === id)
    if (!record) fail(`${entity} not found: ${id}`, 'NOT_FOUND')
    if (record.source_revision !== input.expectedRevision) fail(`${entity} revision changed`, 'STALE_REVISION', { currentRevision: record.source_revision })
    if (!transitions[record.status]?.has(nextStatus)) fail(`Invalid ${entity} transition: ${record.status} -> ${nextStatus}`, 'INVALID_TRANSITION')
    if (['completed', 'abandoned'].includes(nextStatus) && !input.payload.conclusion?.trim()) fail(`Closing a ${entity} requires conclusion`, 'INVALID_COMMAND')
    record.status = nextStatus; record.source_revision += 1; record.updated_at = now()
    if (['completed', 'abandoned'].includes(nextStatus)) { record.conclusion = input.payload.conclusion; record.closed_at = input.payload.closedAt || now() }
    return { changedEntities: [id], revision: record.source_revision }
  })
}

export function setStrategyStatus(paths, raw) { return setLifecycleStatus(paths, raw, { entity: 'strategy', collection: 'strategies', command: 'strategy.setStatus', transitions: STRATEGY_TRANSITIONS }) }

export function listExperiments(paths, { status, strategyId } = {}) {
  const experiments = loadModel(paths).experiments.filter(experiment => (!status || experiment.status === status) && (!strategyId || experiment.strategy_ids.includes(strategyId)))
  return { schemaVersion: 1, status: 'ok', experiments }
}

export function getExperiment(paths, id) {
  const experiment = loadModel(paths).experiments.find(item => item.id === id)
  if (!experiment) fail(`Experiment not found: ${id}`, 'NOT_FOUND')
  return { schemaVersion: 1, status: 'ok', experiment }
}

export function evaluateExperiment(paths, id) {
  const model = loadModel(paths), experiment = model.experiments.find(item => item.id === id)
  if (!experiment) fail(`Experiment not found: ${id}`, 'NOT_FOUND')
  const cohorts = Object.fromEntries(experiment.cohorts.map(cohort => [cohort.id, observations(model.interactions.filter(item => item.experiment_id === id && item.cohort_id === cohort.id))]))
  return { schemaVersion: 1, status: 'ok', experimentId: id, evidenceBoundary: 'confirmed-events-only', cohorts, metrics: experiment.metrics }
}

function validateExperimentRecord(record) {
  if (!record?.id?.startsWith('experiment:') || !record.hypothesis?.trim() || !Array.isArray(record.strategy_ids) || !record.strategy_ids.length || !Array.isArray(record.cohorts) || !record.cohorts.length || !Array.isArray(record.metrics) || !record.metrics.length) fail('Invalid experiment record', 'INVALID_COMMAND')
}

export function createExperiment(paths, raw) {
  const input = envelope('experiment.create', raw), record = { ...input.payload?.record }
  validateExperimentRecord(record)
  record.status ||= 'draft'; record.source_revision = 0; record.provenance ||= [`command:${input.requestId}`]
  return mutate(paths, input, model => {
    if (model.experiments.some(item => item.id === record.id)) fail(`Experiment exists: ${record.id}`, 'EXPERIMENT_CONFLICT')
    model.experiments.push(record)
    return { changedEntities: [record.id, ...record.strategy_ids], revision: 0 }
  })
}

export function updateExperiment(paths, raw) {
  const input = envelope('experiment.update', raw), id = input.payload?.experimentId, changes = { ...input.payload?.changes }
  if (!id || input.expectedRevision == null || 'id' in changes || 'source_revision' in changes || 'status' in changes) fail('experimentId, expectedRevision, and non-status changes are required', 'INVALID_COMMAND')
  return mutate(paths, input, model => {
    const experiment = model.experiments.find(item => item.id === id)
    if (!experiment) fail(`Experiment not found: ${id}`, 'NOT_FOUND')
    if (experiment.source_revision !== input.expectedRevision) fail('Experiment revision changed', 'STALE_REVISION', { currentRevision: experiment.source_revision })
    const next = { ...experiment, ...changes, id, status: experiment.status, source_revision: experiment.source_revision + 1 }
    validateExperimentRecord(next); Object.assign(experiment, next)
    return { changedEntities: [id, ...experiment.strategy_ids], revision: experiment.source_revision }
  })
}

export function setExperimentStatus(paths, raw) { return setLifecycleStatus(paths, raw, { entity: 'experiment', collection: 'experiments', command: 'experiment.setStatus', transitions: EXPERIMENT_TRANSITIONS }) }

const SELF_DOCS = {
  outreach: ['profile/identity.md', 'profile/preferences.md', 'context/career.md', 'context/claims.md'],
  drafting: ['profile/identity.md', 'profile/voice.md', 'context/career.md', 'context/claims.md', 'context/evidence.md', 'context/story-bank.md'],
  application: ['profile/identity.md', 'profile/preferences.md', 'context/career.md', 'context/claims.md', 'context/evidence.md', 'context/positioning.md'],
  interview: ['profile/identity.md', 'context/career.md', 'context/claims.md', 'context/evidence.md', 'context/story-bank.md', 'context/leadership.md'],
  analyze: ['profile/identity.md', 'context/career.md', 'context/claims.md', 'context/evidence.md', 'context/positioning.md']
}

const CONTEXT_BUDGETS = {
  small: { selfCount: 1, selfChars: 1200, subjectCount: 1, subjectChars: 1600, strategyCount: 1, strategyPhaseCount: 2 },
  standard: { selfCount: 2, selfChars: 1800, subjectCount: 2, subjectChars: 2200, strategyCount: 2, strategyPhaseCount: 6 },
  deep: { selfCount: 6, selfChars: 8000, subjectCount: 6, subjectChars: 10000, strategyCount: 6, strategyPhaseCount: 20 }
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

function compactStrategy(strategy, limits) {
  const definition = strategyDefinition(strategy.definition_id)
  if (!definition) fail(`Strategy definition not found: ${strategy.definition_id}`, 'STRATEGY_DEFINITION_NOT_FOUND')
  return {
    instance: strategy,
    definition: {
      id: definition.id,
      version: definition.version,
      label: definition.label,
      category: definition.category,
      purpose: definition.purpose,
      applicability: definition.applicability,
      phases: definition.phases.slice(0, limits.strategyPhaseCount),
      metrics: definition.metrics,
      guardrails: definition.guardrails
    }
  }
}

function strategyBundle(model, { strategyId, subject, limits }) {
  let selected = []
  if (strategyId) {
    const strategy = model.strategies.find(item => item.id === strategyId)
    if (!strategy) fail(`Strategy not found: ${strategyId}`, 'NOT_FOUND')
    selected = [strategy]
  } else if (subject) {
    const entity = findEntity(model, subject)
    const attributed = new Set(entity?.value?.strategy_ids || [])
    selected = model.strategies.filter(strategy => strategy.status === 'active' && ((strategy.scope?.subject_ids || []).includes(subject) || attributed.has(strategy.id)))
  }
  selected.sort((a, b) => a.id.localeCompare(b.id))
  const truncated = selected.length > limits.strategyCount
  return { selectionMode: strategyId ? 'explicit' : 'subject-active', items: selected.slice(0, limits.strategyCount).map(strategy => compactStrategy(strategy, limits)), truncated }
}

export function buildContext(paths, { intent = 'analyze', subject, task, budget = 'standard', strategyId } = {}) {
  if (!CONTEXT_INTENTS.has(intent)) fail(`Unsupported context intent: ${intent}`, 'INVALID_INTENT')
  const limits = CONTEXT_BUDGETS[budget]
  if (!limits) fail(`Unsupported context budget: ${budget}`, 'INVALID_BUDGET')
  const model = loadModel(paths), related = subjectBundle(paths, model, subject, intent, limits)
  const strategy = strategyBundle(model, { strategyId, subject, limits })
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

function applyStrategyAttribution(model, record, payload) {
  if (record.strategy_ids || record.experiment_id || record.cohort_id) fail('Supply strategyIds, experimentId, and cohortId as command payload fields', 'INVALID_COMMAND')
  const strategyIds = [...new Set(payload.strategyIds || [])]
  for (const id of strategyIds) {
    const strategy = model.strategies.find(item => item.id === id)
    if (!strategy) fail(`Strategy not found: ${id}`, 'NOT_FOUND')
    if (record.evidence_state === 'confirmed' && strategy.status !== 'active') fail(`Confirmed strategy execution requires an active strategy: ${id}`, 'STRATEGY_NOT_ACTIVE')
  }
  if (payload.experimentId) {
    const experiment = model.experiments.find(item => item.id === payload.experimentId)
    if (!experiment) fail(`Experiment not found: ${payload.experimentId}`, 'NOT_FOUND')
    if (record.evidence_state === 'confirmed' && experiment.status !== 'running') fail(`Confirmed experiment evidence requires a running experiment: ${experiment.id}`, 'EXPERIMENT_NOT_RUNNING')
    if (!payload.cohortId || !experiment.cohorts.some(cohort => cohort.id === payload.cohortId)) fail('A valid cohortId is required for experiment attribution', 'INVALID_COMMAND')
    for (const id of strategyIds) if (!experiment.strategy_ids.includes(id)) fail(`Strategy ${id} is outside experiment ${experiment.id}`, 'INVALID_COMMAND')
    record.experiment_id = experiment.id; record.cohort_id = payload.cohortId
  } else if (payload.cohortId) fail('cohortId requires experimentId', 'INVALID_COMMAND')
  record.strategy_ids = strategyIds
}

export function recordInteraction(paths, raw) {
  const input = envelope('interaction.record', raw), payload = input.payload || {}, record = { ...payload.record }
  if (!record.id) record.id = `interaction:${crypto.randomUUID()}`
  if (!record.id.startsWith('interaction:') || !record.kind || !record.evidence_state) fail('Invalid interaction payload', 'INVALID_COMMAND')
  if (record.evidence_state === 'confirmed' && !record.occurred_at) fail('Confirmed interactions require occurred_at', 'INVALID_COMMAND')
  if (record.kind === 'strategy_gate_decision') {
    const gate = record.gate_decision
    if (record.evidence_state !== 'confirmed' || !gate || !['pass', 'mitigate', 'stop'].includes(gate.decision) || !/^\d{4}-\d{2}-\d{2}$/.test(gate.checked_at || '') || !Number.isInteger(gate.unresolved_gap_count) || gate.unresolved_gap_count < 0 || !gate.evidence_or_mitigation?.trim() || !(payload.strategyIds || []).length) fail('A strategy gate decision requires confirmed evidence, strategyIds, decision, checked_at, unresolved_gap_count, and evidence_or_mitigation', 'INVALID_COMMAND')
  }
  const outreach = ['outreach', 'outreach_sent'].includes(record.kind)
  if (outreach && record.evidence_state === 'confirmed' && (!payload.channel || !payload.recipient || !payload.objective)) fail('Confirmed outreach requires channel, recipient, and objective', 'INVALID_COMMAND')
  if (record.transmission) fail('Supply messageArtifactId; transmission metadata is generated by Nextstep', 'INVALID_COMMAND')
  record.person_ids ||= []; record.artifact_ids ||= []; record.provenance ||= [`command:${input.requestId}`]
  return mutate(paths, input, model => {
    if (model.interactions.some(i => i.id === record.id)) fail(`Interaction exists: ${record.id}`, 'INTERACTION_CONFLICT')
    applyStrategyAttribution(model, record, payload)
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
    applyStrategyAttribution(model, interaction, payload)
    for (const strategyId of interaction.strategy_ids) {
      const strategy = model.strategies.find(item => item.id === strategyId)
      if (strategyDefinition(strategy.definition_id)?.id !== 'strategy-definition:cold-apply') continue
      const decisions = model.interactions.filter(item => item.kind === 'strategy_gate_decision' && item.evidence_state === 'confirmed' && (item.strategy_ids || []).includes(strategyId) && (item.application_id === application.id || item.vacancy_id === application.vacancy_id)).sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)))
      const latest = decisions[0]
      if (!latest) fail(`Cold-apply strategy requires a confirmed gate decision for ${application.id}`, 'STRATEGY_REQUIREMENT_UNMET')
      if (latest.gate_decision.decision === 'stop') fail(`Cold-apply gate decision stops submission for ${application.id}`, 'STRATEGY_REQUIREMENT_UNMET')
      const maximum = strategy.parameters?.maximum_unresolved_hard_gaps
      if (Number.isInteger(maximum) && latest.gate_decision.unresolved_gap_count > maximum) fail(`Cold-apply unresolved gaps exceed the configured maximum for ${application.id}`, 'STRATEGY_REQUIREMENT_UNMET', { unresolvedGapCount: latest.gate_decision.unresolved_gap_count, maximum })
    }
    if (model.interactions.some(i => i.id === interaction.id)) fail(`Interaction exists: ${interaction.id}`, 'INTERACTION_CONFLICT')
    model.interactions.push(interaction); application.lifecycle_status = 'applied'; application.updated = payload.occurredAt.slice(0, 10); application.strategy_ids = [...new Set([...(application.strategy_ids || []), ...interaction.strategy_ids])]; application.source_revision = (application.source_revision || 0) + 1
    return { changedEntities: [application.id, interaction.id, ...artifacts.map(a => a.id)], revision: application.source_revision, extraOutputs, unresolvedEvidence: artifacts.length ? [] : ['No transmitted artifacts were asserted.'] }
  })
}

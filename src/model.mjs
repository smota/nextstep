import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { assertContained } from './config.mjs'
import { strategyDefinition } from './strategy-catalog.mjs'

export const RECORD_TYPES = Object.freeze(['companies', 'opportunities', 'applicationAttempts', 'people', 'interactions', 'artifacts', 'strategies', 'experiments'])
export const RECORD_FILES = Object.freeze({ companies: 'companies.json', opportunities: 'opportunities.json', applicationAttempts: 'application-attempts.json', people: 'people.json', interactions: 'interactions.json', artifacts: 'artifacts.json', strategies: 'strategies.json', experiments: 'experiments.json' })
const PREFIXES = { companies: 'company', opportunities: 'opportunity', applicationAttempts: 'application-attempt', people: 'person', interactions: 'interaction', artifacts: 'artifact', strategies: 'strategy', experiments: 'experiment' }
const ATTEMPT_LIFECYCLES = new Set(['preparing', 'ready_to_apply', 'applied', 'recruiter_screen', 'interview', 'offer', 'rejected', 'withdrawn', 'closed'])
const PURSUIT_STATUSES = new Set(['identified', 'evaluating', 'pursuing', 'preparing', 'ready_to_apply', 'applied', 'recruiter_screen', 'interview', 'offer', 'not_pursued', 'withdrawn', 'rejected', 'closed'])
const REPRESENTATIONS = new Set(['canonical_markdown', 'generated_docx', 'user_edited_docx'])
const STRATEGY_STATUSES = new Set(['draft', 'active', 'paused', 'completed', 'abandoned'])
const EXPERIMENT_STATUSES = new Set(['draft', 'running', 'paused', 'completed', 'abandoned'])
const QA_RESULTS = new Set(['passed', 'failed', 'not_run'])
const QA_STATUSES = new Set(['generated', 'structurally_verified', 'visually_verified'])

export const json = value => `${JSON.stringify(value, null, 2)}\n`
export const sha = value => crypto.createHash('sha256').update(value).digest('hex')
export const shaFile = file => sha(fs.readFileSync(file))
export const counts = model => Object.fromEntries(RECORD_TYPES.map(key => [key, model[key].length]))
export function fail(message, code = 'NEXTSTEP_ERROR', details) { throw Object.assign(new Error(message), { code, details }) }

export function loadModel(paths) {
  const model = {}
  for (const type of RECORD_TYPES) {
    const file = path.join(paths.recordsDir, RECORD_FILES[type])
    if (!fs.existsSync(file)) {
      fail(`Missing canonical record file: ${RECORD_FILES[type]}`, 'MODEL_INCOMPLETE', { missingCollection: type })
    }
    try { model[type] = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { fail(`Invalid JSON in ${RECORD_FILES[type]}`, 'MODEL_INVALID') }
  }
  return model
}

const unique = values => [...new Set((values || []).filter(Boolean))].sort()
const same = (a, b) => JSON.stringify(unique(a)) === JSON.stringify(unique(b))

function graph(model) {
  const opportunities = new Map(model.opportunities.map(item => [item.id, item]))
  const attempts = new Map(model.applicationAttempts.map(item => [item.id, item]))
  const opportunityForAttempt = id => opportunities.get(attempts.get(id)?.opportunity_id)
  const interactionTouchesOpportunity = (interaction, opportunityId) => interaction.opportunity_id === opportunityId || opportunityForAttempt(interaction.application_attempt_id)?.id === opportunityId
  const artifactSubjects = artifact => unique([artifact.owner_id, ...(artifact.subject_ids || [])])
  return { opportunities, attempts, opportunityForAttempt, interactionTouchesOpportunity, artifactSubjects }
}

export function rebuildBacklinks(model) {
  const g = graph(model)
  for (const company of model.companies) {
    company.opportunity_ids = unique(model.opportunities.filter(item => item.company_id === company.id).map(item => item.id))
    company.application_attempt_ids = unique(model.applicationAttempts.filter(item => g.opportunities.get(item.opportunity_id)?.company_id === company.id).map(item => item.id))
    company.person_ids = unique(model.people.filter(person => person.company_id === company.id || person.company_ids?.includes(company.id)).map(person => person.id))
    company.interaction_ids = unique(model.interactions.filter(item => item.company_id === company.id || g.opportunities.get(item.opportunity_id)?.company_id === company.id || g.opportunityForAttempt(item.application_attempt_id)?.company_id === company.id).map(item => item.id))
    company.artifact_ids = unique(model.artifacts.filter(item => g.artifactSubjects(item).includes(company.id)).map(item => item.id))
  }
  for (const opportunity of model.opportunities) {
    opportunity.application_attempt_ids = unique(model.applicationAttempts.filter(item => item.opportunity_id === opportunity.id).map(item => item.id))
    opportunity.interaction_ids = unique(model.interactions.filter(item => g.interactionTouchesOpportunity(item, opportunity.id)).map(item => item.id))
    opportunity.person_ids = unique([
      ...(opportunity.people_relations || []).map(item => item.person_id),
      ...model.applicationAttempts.filter(item => item.opportunity_id === opportunity.id).flatMap(item => (item.people_relations || []).map(relation => relation.person_id)),
      ...model.interactions.filter(item => g.interactionTouchesOpportunity(item, opportunity.id)).flatMap(item => item.person_ids || [])
    ])
    opportunity.artifact_ids = unique(model.artifacts.filter(item => g.artifactSubjects(item).includes(opportunity.id) || (item.owner_type === 'application_attempt' && opportunity.application_attempt_ids.includes(item.owner_id))).map(item => item.id))
  }
  for (const attempt of model.applicationAttempts) {
    attempt.interaction_ids = unique(model.interactions.filter(item => item.application_attempt_id === attempt.id).map(item => item.id))
    attempt.person_ids = unique([...(attempt.people_relations || []).map(item => item.person_id), ...model.interactions.filter(item => item.application_attempt_id === attempt.id).flatMap(item => item.person_ids || [])])
    attempt.artifact_ids = unique(model.artifacts.filter(item => g.artifactSubjects(item).includes(attempt.id)).map(item => item.id))
  }
  for (const person of model.people) {
    person.interaction_ids = unique(model.interactions.filter(item => (item.person_ids || []).includes(person.id)).map(item => item.id))
    person.application_attempt_ids = unique(model.applicationAttempts.filter(item => (item.people_relations || []).some(relation => relation.person_id === person.id) || model.interactions.some(interaction => interaction.application_attempt_id === item.id && (interaction.person_ids || []).includes(person.id))).map(item => item.id))
    person.opportunity_ids = unique([
      ...model.opportunities.filter(item => (item.people_relations || []).some(relation => relation.person_id === person.id)).map(item => item.id),
      ...person.application_attempt_ids.map(id => g.attempts.get(id)?.opportunity_id),
      ...model.interactions.filter(item => (item.person_ids || []).includes(person.id)).map(item => item.opportunity_id || g.attempts.get(item.application_attempt_id)?.opportunity_id)
    ])
    person.artifact_ids = unique(model.artifacts.filter(item => g.artifactSubjects(item).includes(person.id)).map(item => item.id))
  }
  return model
}

export function validateModel(model, { verifyFiles = false, paths, allowIncomplete = true, pendingFiles } = {}) {
  const errors = [], ids = new Map()
  for (const type of RECORD_TYPES) {
    if (!Array.isArray(model[type])) { errors.push(`${type} must be an array`); continue }
    for (const item of model[type]) {
      if (typeof item.id !== 'string' || !item.id.startsWith(`${PREFIXES[type]}:`)) errors.push(`Invalid ${type} ID: ${item.id}`)
      if (ids.has(item.id)) errors.push(`Duplicate ID: ${item.id}`); else ids.set(item.id, type)
    }
  }
  const sets = Object.fromEntries(RECORD_TYPES.map(type => [type, new Set((model[type] || []).map(item => item.id))]))
  const entityIds = new Set([...sets.companies, ...sets.opportunities, ...sets.applicationAttempts, ...sets.people, ...sets.interactions, ...sets.artifacts])
  const expected = structuredClone(model)
  rebuildBacklinks(expected)
  for (const company of model.companies || []) {
    const value = expected.companies.find(item => item.id === company.id)
    for (const field of ['opportunity_ids', 'application_attempt_ids', 'person_ids', 'interaction_ids', 'artifact_ids']) if (!same(company[field], value[field])) errors.push(`${company.id} ${field} backlinks differ`)
  }
  for (const opportunity of model.opportunities || []) {
    if (!sets.companies.has(opportunity.company_id)) errors.push(`${opportunity.id} missing company ${opportunity.company_id}`)
    if (opportunity.previous_opportunity_id && !sets.opportunities.has(opportunity.previous_opportunity_id)) errors.push(`${opportunity.id} missing previous opportunity ${opportunity.previous_opportunity_id}`)
    if (!PURSUIT_STATUSES.has(opportunity.pursuit_status)) errors.push(`${opportunity.id} invalid pursuit_status`)
    for (const relation of opportunity.people_relations || []) if (!sets.people.has(relation.person_id)) errors.push(`${opportunity.id} missing person ${relation.person_id}`)
    const value = expected.opportunities.find(item => item.id === opportunity.id)
    for (const field of ['application_attempt_ids', 'person_ids', 'interaction_ids', 'artifact_ids']) if (!same(opportunity[field], value[field])) errors.push(`${opportunity.id} ${field} backlinks differ`)
  }
  for (const attempt of model.applicationAttempts || []) {
    if (!sets.opportunities.has(attempt.opportunity_id)) errors.push(`${attempt.id} missing opportunity ${attempt.opportunity_id}`)
    if (!ATTEMPT_LIFECYCLES.has(attempt.lifecycle_status)) errors.push(`${attempt.id} invalid lifecycle`)
    if (!['active', 'archive'].includes(attempt.storage_scope)) errors.push(`${attempt.id} invalid storage scope`)
    if (!allowIncomplete && attempt.record_state === 'incomplete') errors.push(`${attempt.id} is incomplete`)
    if (attempt.previous_attempt_id && !sets.applicationAttempts.has(attempt.previous_attempt_id)) errors.push(`${attempt.id} missing previous attempt ${attempt.previous_attempt_id}`)
    for (const relation of attempt.people_relations || []) if (!sets.people.has(relation.person_id)) errors.push(`${attempt.id} missing person ${relation.person_id}`)
    const value = expected.applicationAttempts.find(item => item.id === attempt.id)
    for (const field of ['person_ids', 'interaction_ids', 'artifact_ids']) if (!same(attempt[field], value[field])) errors.push(`${attempt.id} ${field} backlinks differ`)
  }
  for (const person of model.people || []) {
    if (person.company_id && !sets.companies.has(person.company_id)) errors.push(`${person.id} missing company ${person.company_id}`)
    for (const id of person.company_ids || []) if (!sets.companies.has(id)) errors.push(`${person.id} missing company ${id}`)
    const value = expected.people.find(item => item.id === person.id)
    for (const field of ['opportunity_ids', 'application_attempt_ids', 'interaction_ids', 'artifact_ids']) if (!same(person[field], value[field])) errors.push(`${person.id} ${field} backlinks differ`)
  }
  for (const interaction of model.interactions || []) {
    if (interaction.application_attempt_id && !sets.applicationAttempts.has(interaction.application_attempt_id)) errors.push(`${interaction.id} missing application attempt ${interaction.application_attempt_id}`)
    if (interaction.opportunity_id && !sets.opportunities.has(interaction.opportunity_id)) errors.push(`${interaction.id} missing opportunity ${interaction.opportunity_id}`)
    if (interaction.company_id && !sets.companies.has(interaction.company_id)) errors.push(`${interaction.id} missing company ${interaction.company_id}`)
    for (const id of interaction.person_ids || []) if (!sets.people.has(id)) errors.push(`${interaction.id} missing person ${id}`)
    if (!interaction.application_attempt_id && !interaction.opportunity_id && !interaction.company_id && !(interaction.person_ids || []).length) errors.push(`${interaction.id} has no relational subject`)
    for (const id of interaction.artifact_ids || []) if (!sets.artifacts.has(id)) errors.push(`${interaction.id} missing artifact ${id}`)
    for (const id of interaction.strategy_ids || []) if (!sets.strategies.has(id)) errors.push(`${interaction.id} missing strategy ${id}`)
    if (interaction.experiment_id) {
      const experiment = model.experiments.find(item => item.id === interaction.experiment_id)
      if (!experiment) errors.push(`${interaction.id} missing experiment ${interaction.experiment_id}`)
      else if (!interaction.cohort_id || !(experiment.cohorts || []).some(cohort => cohort.id === interaction.cohort_id)) errors.push(`${interaction.id} invalid experiment cohort`)
    } else if (interaction.cohort_id) errors.push(`${interaction.id} cohort_id requires experiment_id`)
    if (interaction.kind === 'opportunity_decision') {
      const decision = interaction.opportunity_decision
      if (interaction.evidence_state !== 'confirmed' || !decision || !['pursue', 'calibrate', 'not_pursued', 'closed', 'ineligible'].includes(decision.decision) || !Array.isArray(decision.reason_codes) || !decision.reason_codes.length || !['user', 'agent_recommendation', 'user_directed_exception'].includes(decision.decision_source)) errors.push(`${interaction.id} invalid opportunity decision`)
    }
    if (interaction.kind === 'strategy_gate_decision') {
      const gate = interaction.gate_decision
      if (interaction.evidence_state !== 'confirmed' || !gate || !['pass', 'mitigate', 'stop'].includes(gate.decision) || !/^\d{4}-\d{2}-\d{2}$/.test(gate.checked_at || '') || !Number.isInteger(gate.unresolved_gap_count) || gate.unresolved_gap_count < 0 || !(interaction.strategy_ids || []).length) errors.push(`${interaction.id} invalid strategy gate decision`)
    }
    if (interaction.submission_bundle) validateTransmission(interaction, paths, pendingFiles, errors)
    if (interaction.transmission) validateOutreach(interaction, paths, pendingFiles, errors)
  }
  for (const artifact of model.artifacts || []) {
    const owners = { company: sets.companies, opportunity: sets.opportunities, application_attempt: sets.applicationAttempts, person: sets.people, interaction: sets.interactions }
    if (artifact.owner_type !== 'shared' && !owners[artifact.owner_type]?.has(artifact.owner_id)) errors.push(`${artifact.id} missing owner ${artifact.owner_id}`)
    for (const id of artifact.subject_ids || []) if (!entityIds.has(id)) errors.push(`${artifact.id} missing subject ${id}`)
    if (artifact.document?.representation && !REPRESENTATIONS.has(artifact.document.representation)) errors.push(`${artifact.id} invalid representation`)
    if (artifact.quality && (artifact.quality.schema_version !== 1 || artifact.quality.artifact_sha256 !== artifact.sha256 || !QA_STATUSES.has(artifact.quality.status) || ['structural', 'accessibility', 'parity', 'visual'].some(name => !QA_RESULTS.has(artifact.quality.checks?.[name])))) errors.push(`${artifact.id} invalid quality manifest`)
    if (verifyFiles && paths) validateArtifactFile(artifact, paths, errors)
  }
  for (const strategy of model.strategies || []) {
    if (!strategyDefinition(strategy.definition_id)) errors.push(`${strategy.id} unknown definition ${strategy.definition_id}`)
    if (!STRATEGY_STATUSES.has(strategy.status)) errors.push(`${strategy.id} invalid strategy status`)
    if (typeof strategy.objective !== 'string' || !strategy.objective.trim()) errors.push(`${strategy.id} objective is required`)
    for (const id of strategy.scope?.subject_ids || []) if (!entityIds.has(id)) errors.push(`${strategy.id} missing subject ${id}`)
  }
  for (const experiment of model.experiments || []) {
    if (!EXPERIMENT_STATUSES.has(experiment.status)) errors.push(`${experiment.id} invalid experiment status`)
    if (typeof experiment.hypothesis !== 'string' || !experiment.hypothesis.trim()) errors.push(`${experiment.id} hypothesis is required`)
    if (!Array.isArray(experiment.strategy_ids) || !experiment.strategy_ids.length) errors.push(`${experiment.id} requires strategy_ids`)
    for (const id of experiment.strategy_ids || []) if (!sets.strategies.has(id)) errors.push(`${experiment.id} missing strategy ${id}`)
  }
  if (errors.length) fail(`Model validation failed with ${errors.length} error(s)`, 'MODEL_INVALID', { errors })
  return { valid: true, counts: counts(model) }
}

function validateArtifactFile(artifact, paths, errors) {
  let file
  try { file = assertContained(paths.candidaturesDir, path.resolve(paths.candidaturesDir, artifact.path), 'Artifact path') } catch { errors.push(`${artifact.id} unsafe file ${artifact.path}`); return }
  if (!fs.existsSync(file)) errors.push(`${artifact.id} missing file ${artifact.path}`)
  else if (shaFile(file) !== artifact.sha256) errors.push(`${artifact.id} checksum mismatch ${artifact.path}`)
}

function validateTransmission(interaction, paths, pendingFiles, errors) {
  const bundle = interaction.submission_bundle
  if (![2, 3].includes(bundle.schema_version) || !Array.isArray(bundle.items)) { errors.push(`${interaction.id} invalid submission bundle`); return }
  for (const item of bundle.items) {
    const expected = item.transmitted_sha256 || item.sha256
    if (!item.snapshot_path) { errors.push(`${interaction.id} submission item lacks immutable snapshot`); continue }
    if (!paths) continue
    let snapshot
    try { snapshot = assertContained(paths.candidaturesDir, path.resolve(paths.candidaturesDir, item.snapshot_path), 'Submission snapshot') } catch { errors.push(`${interaction.id} invalid submission snapshot ${item.snapshot_path}`); continue }
    const bytes = pendingFiles?.get(snapshot)
    if ((bytes == null && !fs.existsSync(snapshot)) || sha(bytes == null ? fs.readFileSync(snapshot) : bytes) !== expected) errors.push(`${interaction.id} invalid submission snapshot ${item.snapshot_path}`)
  }
}

function validateOutreach(interaction, paths, pendingFiles, errors) {
  if (interaction.transmission.schema_version !== 2 || !interaction.transmission.snapshot_path) { errors.push(`${interaction.id} invalid outreach transmission`); return }
  if (!paths) return
  let snapshot
  try { snapshot = assertContained(paths.candidaturesDir, path.resolve(paths.candidaturesDir, interaction.transmission.snapshot_path), 'Outreach snapshot') } catch { errors.push(`${interaction.id} invalid outreach snapshot`); return }
  const bytes = pendingFiles?.get(snapshot)
  if ((bytes == null && !fs.existsSync(snapshot)) || sha(bytes == null ? fs.readFileSync(snapshot) : bytes) !== interaction.transmission.message_sha256) errors.push(`${interaction.id} invalid outreach snapshot`)
}

export function findEntity(model, id) {
  for (const type of RECORD_TYPES) {
    const value = model[type].find(item => item.id === id)
    if (value) return { type, value }
  }
  return null
}

export function resolveSubgraph(model, subjectId) {
  const found = findEntity(model, subjectId)
  if (!found) fail(`Entity not found: ${subjectId}`, 'NOT_FOUND')
  const ids = new Set([subjectId]), add = values => (values || []).forEach(value => value && ids.add(value))
  const value = found.value
  add(value.opportunity_ids); add(value.application_attempt_ids); add(value.person_ids); add(value.interaction_ids); add(value.artifact_ids)
  add([value.company_id, value.opportunity_id, value.application_attempt_id, value.owner_id]); add(value.subject_ids)
  if (found.type === 'applicationAttempts') {
    const opportunity = model.opportunities.find(item => item.id === value.opportunity_id)
    add([opportunity?.id, opportunity?.company_id]); add(opportunity?.person_ids); add(opportunity?.artifact_ids)
  }
  return Object.fromEntries(RECORD_TYPES.map(type => [type, model[type].filter(item => ids.has(item.id))]))
}

export function relatedToApplicationAttempt(model, applicationAttemptId) {
  const attempt = model.applicationAttempts.find(item => item.id === applicationAttemptId)
  if (!attempt) fail(`ApplicationAttempt not found: ${applicationAttemptId}`, 'NOT_FOUND')
  const interactions = model.interactions.filter(item => item.application_attempt_id === applicationAttemptId)
  const artifactIds = new Set(attempt.artifact_ids || [])
  for (const interaction of interactions) for (const id of interaction.artifact_ids || []) artifactIds.add(id)
  return { applicationAttempt: attempt, interactions, artifacts: model.artifacts.filter(item => artifactIds.has(item.id)) }
}

export function validateScope(model, scope, paths) {
  if (!scope || scope === 'structure') return validateModel(model, { paths })
  if (scope === 'all') return validateModel(model, { verifyFiles: true, paths })
  if (scope.startsWith('application-attempt:')) {
    validateModel(model, { paths })
    const related = relatedToApplicationAttempt(model, scope)
    const errors = []
    for (const artifact of related.artifacts) validateArtifactFile(artifact, paths, errors)
    if (errors.length) fail('ApplicationAttempt validation failed', 'APPLICATION_ATTEMPT_INVALID', { errors })
    return { valid: true, scope, checked: { applicationAttempts: 1, interactions: related.interactions.length, artifacts: related.artifacts.length } }
  }
  fail(`Unsupported validation scope: ${scope}`, 'INVALID_SCOPE')
}

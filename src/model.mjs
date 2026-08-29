import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { assertContained } from './config.mjs'
import { strategyDefinition } from './strategy-catalog.mjs'

export const RECORD_TYPES = Object.freeze(['companies', 'vacancies', 'applications', 'people', 'interactions', 'artifacts', 'strategies', 'experiments'])
export const LEGACY_RECORD_TYPES = Object.freeze(['companies', 'vacancies', 'applications', 'people', 'interactions', 'artifacts'])
const PREFIXES = { companies: 'company', vacancies: 'vacancy', applications: 'application', people: 'person', interactions: 'interaction', artifacts: 'artifact', strategies: 'strategy', experiments: 'experiment' }
const LIFECYCLES = new Set(['identified', 'to_apply', 'applied', 'recruiter_screen', 'interview', 'offer', 'rejected', 'withdrawn', 'archived'])
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

export function loadModel(paths, { allowUninitializedStrategy = false } = {}) {
  const model = {}
  for (const type of RECORD_TYPES) {
    const file = path.join(paths.recordsDir, `${type}.json`)
    if (!fs.existsSync(file)) {
      if (allowUninitializedStrategy && ['strategies', 'experiments'].includes(type)) { model[type] = []; continue }
      fail(`Missing canonical record file: ${type}.json`, 'MODEL_INCOMPLETE', { missingCollection: type, migrationCommand: 'strategy initialize' })
    }
    try { model[type] = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { fail(`Invalid JSON in ${type}.json`, 'MODEL_INVALID') }
  }
  return model
}

const unique = values => [...new Set(values || [])].sort()
const same = (a, b) => JSON.stringify(unique(a)) === JSON.stringify(unique(b))

export function rebuildBacklinks(model) {
  for (const company of model.companies) {
    company.vacancy_ids = unique(model.vacancies.filter(v => v.company_id === company.id).map(v => v.id))
    company.person_ids = unique(model.people.filter(p => p.company_id === company.id).map(p => p.id))
  }
  for (const vacancy of model.vacancies) vacancy.application_ids = unique(model.applications.filter(a => a.vacancy_id === vacancy.id).map(a => a.id))
  for (const application of model.applications) {
    application.interaction_ids = unique(model.interactions.filter(i => i.application_id === application.id).map(i => i.id))
    application.artifact_ids = unique(model.artifacts.filter(a => a.owner_type === 'application' && a.owner_id === application.id).map(a => a.id))
  }
  for (const person of model.people) {
    person.application_ids = unique(model.applications.filter(a => (a.people_relations || []).some(r => r.person_id === person.id)).map(a => a.id))
    person.vacancy_ids = unique(person.application_ids.map(id => model.applications.find(a => a.id === id)?.vacancy_id).filter(Boolean))
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
  const sets = Object.fromEntries(RECORD_TYPES.map(type => [type, new Set((model[type] || []).map(x => x.id))]))
  const artifacts = new Map((model.artifacts || []).map(x => [x.id, x]))
  const entityIds = new Set([...sets.companies, ...sets.vacancies, ...sets.applications, ...sets.people, ...sets.interactions, ...sets.artifacts])
  for (const c of model.companies || []) {
    if (!same(c.vacancy_ids, model.vacancies.filter(v => v.company_id === c.id).map(v => v.id))) errors.push(`${c.id} vacancy backlinks differ`)
    if (!same(c.person_ids, model.people.filter(p => p.company_id === c.id).map(p => p.id))) errors.push(`${c.id} person backlinks differ`)
    for (const id of c.strategy_ids || []) if (!sets.strategies.has(id)) errors.push(`${c.id} missing strategy ${id}`)
  }
  for (const v of model.vacancies || []) {
    if (!sets.companies.has(v.company_id)) errors.push(`${v.id} missing company ${v.company_id}`)
    if (!same(v.application_ids, model.applications.filter(a => a.vacancy_id === v.id).map(a => a.id))) errors.push(`${v.id} application backlinks differ`)
    for (const id of v.strategy_ids || []) if (!sets.strategies.has(id)) errors.push(`${v.id} missing strategy ${id}`)
  }
  for (const a of model.applications || []) {
    if (!sets.vacancies.has(a.vacancy_id)) errors.push(`${a.id} missing vacancy ${a.vacancy_id}`)
    if (a.lifecycle_status != null && !LIFECYCLES.has(a.lifecycle_status)) errors.push(`${a.id} invalid lifecycle`)
    if (!['active', 'archive'].includes(a.storage_scope)) errors.push(`${a.id} invalid storage scope`)
    if (!allowIncomplete && a.record_state === 'incomplete') errors.push(`${a.id} is incomplete`)
    for (const relation of a.people_relations || []) if (!sets.people.has(relation.person_id)) errors.push(`${a.id} missing person ${relation.person_id}`)
    for (const id of a.strategy_ids || []) if (!sets.strategies.has(id)) errors.push(`${a.id} missing strategy ${id}`)
  }
  for (const i of model.interactions || []) {
    if (i.application_id && !sets.applications.has(i.application_id)) errors.push(`${i.id} missing application ${i.application_id}`)
    if (i.vacancy_id && !sets.vacancies.has(i.vacancy_id)) errors.push(`${i.id} missing vacancy ${i.vacancy_id}`)
    if (i.company_id && !sets.companies.has(i.company_id)) errors.push(`${i.id} missing company ${i.company_id}`)
    for (const id of i.person_ids || []) if (!sets.people.has(id)) errors.push(`${i.id} missing person ${id}`)
    if (!i.application_id && !i.vacancy_id && !i.company_id && !(i.person_ids || []).length) errors.push(`${i.id} has no relational subject`)
    for (const id of i.artifact_ids || []) if (!sets.artifacts.has(id)) errors.push(`${i.id} missing artifact ${id}`)
    for (const id of i.strategy_ids || []) if (!sets.strategies.has(id)) errors.push(`${i.id} missing strategy ${id}`)
    if (i.experiment_id) {
      const experiment = model.experiments.find(x => x.id === i.experiment_id)
      if (!experiment) errors.push(`${i.id} missing experiment ${i.experiment_id}`)
      else {
        if (!i.cohort_id) errors.push(`${i.id} experiment attribution requires cohort_id`)
        else if (!(experiment.cohorts || []).some(cohort => cohort.id === i.cohort_id)) errors.push(`${i.id} missing experiment cohort ${i.cohort_id}`)
        for (const id of i.strategy_ids || []) if (!(experiment.strategy_ids || []).includes(id)) errors.push(`${i.id} strategy ${id} is outside experiment ${i.experiment_id}`)
      }
    } else if (i.cohort_id) errors.push(`${i.id} cohort_id requires experiment_id`)
    if (i.kind === 'strategy_gate_decision') {
      const gate = i.gate_decision
      if (i.evidence_state !== 'confirmed' || !gate || !['pass', 'mitigate', 'stop'].includes(gate.decision) || !/^\d{4}-\d{2}-\d{2}$/.test(gate.checked_at || '') || !Number.isInteger(gate.unresolved_gap_count) || gate.unresolved_gap_count < 0 || typeof gate.evidence_or_mitigation !== 'string' || !gate.evidence_or_mitigation.trim() || !(i.strategy_ids || []).length) errors.push(`${i.id} invalid strategy gate decision`)
    }
    if (i.kind === 'opportunity_decision') {
      const decision = i.opportunity_decision
      if (i.evidence_state !== 'confirmed' || !decision || !['pursue', 'calibrate', 'not_pursued', 'closed', 'ineligible'].includes(decision.decision) || !Array.isArray(decision.reason_codes) || !decision.reason_codes.length || !['user', 'agent_recommendation', 'user_directed_exception'].includes(decision.decision_source)) errors.push(`${i.id} invalid opportunity decision`)
      if (decision?.decision_source === 'user_directed_exception' && (!['go', 'calibrate_first', 'stop'].includes(decision.original_recommendation) || !decision.rationale?.trim())) errors.push(`${i.id} invalid user-directed exception`)
    }
    if (i.submission_bundle) {
      if (i.submission_bundle.schema_version !== 2 || !Array.isArray(i.submission_bundle.items)) errors.push(`${i.id} invalid submission bundle`)
      for (const item of i.submission_bundle.items || []) {
        const expected = item.transmitted_sha256 || item.sha256
        if (!item.snapshot_path) errors.push(`${i.id} submission item lacks immutable snapshot`)
        else if (paths) {
          let snapshot
          try { snapshot = assertContained(paths.candidaturesDir, path.resolve(paths.candidaturesDir, item.snapshot_path), 'Submission snapshot') } catch { errors.push(`${i.id} invalid submission snapshot ${item.snapshot_path}`); continue }
          const relative = path.relative(paths.candidaturesDir, snapshot)
          const bytes = pendingFiles?.get(snapshot)
          if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || (bytes == null && !fs.existsSync(snapshot)) || sha(bytes == null ? fs.readFileSync(snapshot) : bytes) !== expected) errors.push(`${i.id} invalid submission snapshot ${item.snapshot_path}`)
        }
      }
    }
    if (i.transmission) {
      if (i.transmission.schema_version !== 2 || !i.transmission.snapshot_path) errors.push(`${i.id} invalid outreach transmission`)
      else if (paths) {
        let snapshot
        try { snapshot = assertContained(paths.candidaturesDir, path.resolve(paths.candidaturesDir, i.transmission.snapshot_path), 'Outreach snapshot') } catch { errors.push(`${i.id} invalid outreach snapshot ${i.transmission.snapshot_path}`); continue }
        const relative = path.relative(paths.candidaturesDir, snapshot)
        const bytes = pendingFiles?.get(snapshot)
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || (bytes == null && !fs.existsSync(snapshot)) || sha(bytes == null ? fs.readFileSync(snapshot) : bytes) !== i.transmission.message_sha256) errors.push(`${i.id} invalid outreach snapshot ${i.transmission.snapshot_path}`)
      }
    }
  }
  for (const a of model.artifacts || []) {
    const owners = { company: sets.companies, vacancy: sets.vacancies, application: sets.applications, person: sets.people, interaction: sets.interactions }
    if (a.owner_type !== 'shared' && !owners[a.owner_type]?.has(a.owner_id)) errors.push(`${a.id} missing owner ${a.owner_id}`)
    if (a.document?.representation && !REPRESENTATIONS.has(a.document.representation)) errors.push(`${a.id} invalid representation`)
    if (a.quality) {
      if (a.quality.schema_version !== 1 || !a.quality.capability_id || !/^[a-f0-9]{64}$/.test(a.quality.source_sha256 || '') || a.quality.artifact_sha256 !== a.sha256 || !QA_STATUSES.has(a.quality.status) || !a.quality.checks || ['structural', 'accessibility', 'parity', 'visual'].some(name => !QA_RESULTS.has(a.quality.checks[name]))) errors.push(`${a.id} invalid quality manifest`)
      if (a.quality.status === 'visually_verified' && a.quality.checks.visual !== 'passed') errors.push(`${a.id} visual verification status lacks passed visual check`)
    }
    for (const id of a.strategy_ids || []) if (!sets.strategies.has(id)) errors.push(`${a.id} missing strategy ${id}`)
    if (verifyFiles && paths) {
      let file
      try { file = assertContained(paths.candidaturesDir, path.resolve(paths.candidaturesDir, a.path), 'Artifact path') } catch { errors.push(`${a.id} unsafe file ${a.path}`); continue }
      if (!fs.existsSync(file)) errors.push(`${a.id} missing file ${a.path}`)
      else if (shaFile(file) !== a.sha256) errors.push(`${a.id} checksum mismatch ${a.path}`)
    }
  }
  for (const person of model.people || []) for (const id of person.strategy_ids || []) if (!sets.strategies.has(id)) errors.push(`${person.id} missing strategy ${id}`)
  for (const strategy of model.strategies || []) {
    if (typeof strategy.definition_id !== 'string' || !strategy.definition_id.startsWith('strategy-definition:')) errors.push(`${strategy.id} invalid definition_id`)
    else if (!strategyDefinition(strategy.definition_id)) errors.push(`${strategy.id} unknown definition ${strategy.definition_id}`)
    if (!STRATEGY_STATUSES.has(strategy.status)) errors.push(`${strategy.id} invalid strategy status`)
    if (typeof strategy.objective !== 'string' || !strategy.objective.trim()) errors.push(`${strategy.id} objective is required`)
    if (!Number.isInteger(strategy.source_revision) || strategy.source_revision < 0) errors.push(`${strategy.id} invalid source_revision`)
    for (const id of strategy.scope?.subject_ids || []) if (!entityIds.has(id)) errors.push(`${strategy.id} missing subject ${id}`)
    if (strategy.success_criteria != null && !Array.isArray(strategy.success_criteria)) errors.push(`${strategy.id} success_criteria must be an array`)
  }
  for (const experiment of model.experiments || []) {
    if (!EXPERIMENT_STATUSES.has(experiment.status)) errors.push(`${experiment.id} invalid experiment status`)
    if (typeof experiment.hypothesis !== 'string' || !experiment.hypothesis.trim()) errors.push(`${experiment.id} hypothesis is required`)
    if (!Number.isInteger(experiment.source_revision) || experiment.source_revision < 0) errors.push(`${experiment.id} invalid source_revision`)
    if (!Array.isArray(experiment.strategy_ids) || !experiment.strategy_ids.length) errors.push(`${experiment.id} requires strategy_ids`)
    for (const id of experiment.strategy_ids || []) if (!sets.strategies.has(id)) errors.push(`${experiment.id} missing strategy ${id}`)
    if (!Array.isArray(experiment.cohorts) || !experiment.cohorts.length) errors.push(`${experiment.id} requires cohorts`)
    const cohortIds = (experiment.cohorts || []).map(cohort => cohort.id)
    if (cohortIds.some(id => typeof id !== 'string' || !id) || new Set(cohortIds).size !== cohortIds.length) errors.push(`${experiment.id} invalid cohort IDs`)
    if (!Array.isArray(experiment.metrics) || !experiment.metrics.length) errors.push(`${experiment.id} requires metrics`)
  }
  if (errors.length) fail(`Model validation failed with ${errors.length} error(s)`, 'MODEL_INVALID', { errors })
  return { valid: true, counts: counts(model) }
}

export function findEntity(model, id) {
  for (const type of RECORD_TYPES) {
    const value = model[type].find(item => item.id === id)
    if (value) return { type, value }
  }
  return null
}

export function relatedToApplication(model, applicationId) {
  const application = model.applications.find(a => a.id === applicationId)
  if (!application) fail(`Application not found: ${applicationId}`, 'NOT_FOUND')
  const interactions = model.interactions.filter(i => i.application_id === applicationId)
  const artifactIds = new Set(application.artifact_ids || [])
  for (const i of interactions) for (const id of i.artifact_ids || []) artifactIds.add(id)
  return { application, interactions, artifacts: model.artifacts.filter(a => artifactIds.has(a.id)) }
}

export function validateScope(model, scope, paths) {
  if (!scope || scope === 'structure') return validateModel(model, { paths })
  if (scope === 'all') return validateModel(model, { verifyFiles: true, paths })
  if (scope.startsWith('application:')) {
    validateModel(model, { paths })
    const related = relatedToApplication(model, scope)
    const errors = []
    for (const a of related.artifacts) {
      let file
      try { file = assertContained(paths.candidaturesDir, path.resolve(paths.candidaturesDir, a.path), 'Artifact path') } catch { errors.push(`${a.id} unsafe file ${a.path}`); continue }
      if (!fs.existsSync(file) || shaFile(file) !== a.sha256) errors.push(`${a.id} checksum mismatch ${a.path}`)
    }
    if (errors.length) fail('Application validation failed', 'APPLICATION_INVALID', { errors })
    return { valid: true, scope, checked: { applications: 1, interactions: related.interactions.length, artifacts: related.artifacts.length } }
  }
  fail(`Unsupported validation scope: ${scope}`, 'INVALID_SCOPE')
}

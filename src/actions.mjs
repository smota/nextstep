import crypto from 'node:crypto'
import fs from 'node:fs'
import { fail, loadModel } from './model.mjs'
import { mutate } from './storage.mjs'

export const CONTACT_KINDS = Object.freeze(['outreach', 'outreach_sent', 'outreach_response', 'human_response', 'conversation', 'interview', 'screen'])
const CONTACT_KIND_SET = new Set(CONTACT_KINDS)
const CATEGORIES = new Set(['internal', 'external_contact'])
const STATUSES = new Set(['open', 'waiting', 'completed', 'cancelled'])
const OPEN_OR_WAITING = new Set(['open', 'waiting'])
const SUBJECT_COLLECTIONS = { company: 'companies', person: 'people', opportunity: 'opportunities', application_attempt: 'applicationAttempts' }
const SUBJECT_PREFIXES = { company: 'company:', person: 'person:', opportunity: 'opportunity:', application_attempt: 'application-attempt:' }
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/

const clockNow = () => new Date().toISOString()

export function isRealDate(value) {
  if (typeof value !== 'string') return false
  const match = DATE_RE.exec(value)
  if (!match) return false
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  if (month < 1 || month > 12 || day < 1) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function isRealDateTime(value) {
  if (typeof value !== 'string') return false
  const match = DATE_TIME_RE.exec(value)
  if (!match) return false
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const hour = Number(match[4]), minute = Number(match[5]), second = Number(match[6])
  if (hour > 23 || minute > 59 || second > 59) return false
  if (!isRealDate(`${match[1]}-${match[2]}-${match[3]}`)) return false
  return !Number.isNaN(Date.parse(value))
}

// Clock classification is separate from completion. Explicit direction wins over kind.
// Undirected outreach and outreach_sent select outbound only as a kind match.
export function contactClock(interaction) {
  if (!interaction || interaction.evidence_state !== 'confirmed') return 'unknown'
  if (!CONTACT_KIND_SET.has(interaction.kind)) return 'unknown'
  if (!isRealDateTime(interaction.occurred_at)) return 'unknown'
  if (interaction.direction === 'outbound' || interaction.direction === 'inbound') return interaction.direction
  if (interaction.direction != null) return 'unknown'
  if (interaction.kind === 'outreach' || interaction.kind === 'outreach_sent') return 'outbound'
  return 'unknown'
}

export function applyRecordedDirection(record, payload = {}) {
  if (record && Object.prototype.hasOwnProperty.call(record, 'direction')) fail('Supply direction as a command payload field', 'INVALID_COMMAND')
  if (Object.prototype.hasOwnProperty.call(payload, 'direction')) {
    if (payload.direction !== 'outbound' && payload.direction !== 'inbound') fail('direction must be outbound or inbound', 'INVALID_COMMAND')
    if (!CONTACT_KIND_SET.has(record.kind)) fail(`Direction is not stored for kind ${record.kind}`, 'INVALID_COMMAND')
    record.direction = payload.direction
  }
  const clock = contactClock(record)
  if (record.direction && clock !== 'unknown' && clock !== record.direction) fail('Explicit direction must select its contact clock', 'INVALID_COMMAND')
  return clock
}

export function assertNoSubmissionDirection(payload = {}) {
  if (Object.prototype.hasOwnProperty.call(payload, 'direction')) fail('application-attempt record-submission does not set direction', 'INVALID_COMMAND')
}

function envelope(command, input = {}) {
  if (input?.schemaVersion !== 1) fail('schemaVersion must be 1', 'INVALID_ENVELOPE')
  return { ...input, command, actor: input.actor || 'user' }
}

function rejectUnknown(payload, allowed) {
  for (const key of Object.keys(payload || {})) if (!allowed.has(key)) fail(`Unexpected field: ${key}`, 'INVALID_COMMAND')
}

function nonempty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function requireDate(value, label) {
  if (!isRealDate(value)) fail(`${label} must be a real YYYY-MM-DD date`, 'INVALID_COMMAND')
}

function requireDateTime(value, label) {
  if (!isRealDateTime(value)) fail(`${label} must be a real UTC date-time`, 'INVALID_COMMAND')
}

function resolveSubjects(model, subjects) {
  if (!Array.isArray(subjects) || subjects.length === 0) fail('subjects must be a nonempty list', 'INVALID_COMMAND')
  const seen = new Set()
  const stored = []
  for (const subject of subjects) {
    if (!subject || typeof subject !== 'object' || Array.isArray(subject)) fail('Invalid subject', 'INVALID_COMMAND')
    rejectUnknown(subject, new Set(['type', 'id']))
    const prefix = SUBJECT_PREFIXES[subject.type]
    if (!prefix) fail('Invalid subject type', 'INVALID_COMMAND')
    if (typeof subject.id !== 'string' || !subject.id.startsWith(prefix)) fail('Invalid subject id', 'INVALID_COMMAND')
    const pair = `${subject.type}\0${subject.id}`
    if (seen.has(pair)) fail('Duplicate subject', 'INVALID_COMMAND')
    seen.add(pair)
    const collection = model[SUBJECT_COLLECTIONS[subject.type]] || []
    if (!collection.some(item => item.id === subject.id)) fail(`Subject not found: ${subject.id}`, 'NOT_FOUND')
    stored.push({ type: subject.type, id: subject.id })
  }
  return stored
}

function applyAttribution(model, action, payload) {
  if (Object.prototype.hasOwnProperty.call(payload, 'strategyIds')) {
    if (!Array.isArray(payload.strategyIds) || payload.strategyIds.some(id => typeof id !== 'string' || !id.startsWith('strategy:'))) fail('strategyIds must be strategy ids', 'INVALID_COMMAND')
  }
  const strategyIds = [...new Set(payload.strategyIds || [])]
  for (const id of strategyIds) if (!model.strategies.some(item => item.id === id)) fail(`Strategy not found: ${id}`, 'NOT_FOUND')
  const hasExperiment = Object.prototype.hasOwnProperty.call(payload, 'experimentId')
  const hasCohort = Object.prototype.hasOwnProperty.call(payload, 'cohortId')
  if (hasExperiment) {
    if (typeof payload.experimentId !== 'string' || !payload.experimentId.startsWith('experiment:')) fail('experimentId must be an experiment id', 'INVALID_COMMAND')
    const experiment = model.experiments.find(item => item.id === payload.experimentId)
    if (!experiment) fail(`Experiment not found: ${payload.experimentId}`, 'NOT_FOUND')
    if (!hasCohort || typeof payload.cohortId !== 'string' || !payload.cohortId || !(experiment.cohorts || []).some(cohort => cohort.id === payload.cohortId)) fail('A valid cohortId is required for experiment attribution', 'INVALID_COMMAND')
    for (const id of strategyIds) if (!(experiment.strategy_ids || []).includes(id)) fail(`Strategy ${id} is outside experiment ${experiment.id}`, 'INVALID_COMMAND')
    action.experiment_id = experiment.id
    action.cohort_id = payload.cohortId
  } else if (hasCohort) fail('cohortId requires experimentId', 'INVALID_COMMAND')
  if (Object.prototype.hasOwnProperty.call(payload, 'strategyIds')) action.strategy_ids = strategyIds
}

function planRecord(model, input) {
  const payload = input.payload || {}
  rejectUnknown(payload, new Set(['id', 'category', 'subjects', 'objective', 'expectedKind', 'dueOn', 'note', 'strategyIds', 'experimentId', 'cohortId']))
  if (!CATEGORIES.has(payload.category)) fail('category must be internal or external_contact', 'INVALID_COMMAND')
  if (!nonempty(payload.objective)) fail('objective is required', 'INVALID_COMMAND')
  if (payload.category === 'external_contact') {
    if (!Object.prototype.hasOwnProperty.call(payload, 'expectedKind') || !CONTACT_KIND_SET.has(payload.expectedKind)) fail('external_contact requires expectedKind', 'INVALID_COMMAND')
  } else if (Object.prototype.hasOwnProperty.call(payload, 'expectedKind')) fail('internal omits expectedKind', 'INVALID_COMMAND')
  if (Object.prototype.hasOwnProperty.call(payload, 'dueOn')) requireDate(payload.dueOn, 'dueOn')
  if (Object.prototype.hasOwnProperty.call(payload, 'note') && !nonempty(payload.note)) fail('note must be a nonempty string', 'INVALID_COMMAND')
  let id = payload.id
  if (id == null) id = `action:${crypto.randomUUID()}`
  else if (typeof id !== 'string' || !/^action:.+/.test(id)) fail('id must start with action:', 'INVALID_COMMAND')
  if (model.actions.some(item => item.id === id)) fail(`Action exists: ${id}`, 'INVALID_COMMAND')
  const subjects = resolveSubjects(model, payload.subjects)
  const at = clockNow()
  const action = {
    id,
    category: payload.category,
    subjects,
    objective: payload.objective.trim(),
    status: 'open',
    actor: input.actor,
    created_at: at,
    updated_at: at,
    source_revision: 0,
    history: [{ command: 'action plan', at, source_revision: 0 }]
  }
  if (payload.category === 'external_contact') action.expected_kind = payload.expectedKind
  if (Object.prototype.hasOwnProperty.call(payload, 'dueOn')) action.due_on = payload.dueOn
  if (Object.prototype.hasOwnProperty.call(payload, 'note')) action.note = payload.note.trim()
  applyAttribution(model, action, payload)
  return action
}

function findAction(model, id) {
  if (typeof id !== 'string' || !/^action:.+/.test(id)) fail('id must start with action:', 'INVALID_COMMAND')
  const action = model.actions.find(item => item.id === id)
  if (!action) fail(`Action not found: ${id}`, 'NOT_FOUND')
  return action
}

function requireRevision(action, input) {
  if (input.expectedRevision == null) fail('expectedRevision is required', 'INVALID_COMMAND')
  if (action.source_revision !== input.expectedRevision) fail('Action revision changed', 'STALE_REVISION', { currentRevision: action.source_revision })
}

function rejectTerminal(action) {
  if (action.status === 'completed' || action.status === 'cancelled') fail(`Invalid action transition: ${action.status}`, 'INVALID_TRANSITION')
}

function touch(action, command) {
  let at = clockNow()
  if (action.updated_at && at <= action.updated_at) at = new Date(Date.parse(action.updated_at) + 1).toISOString()
  action.source_revision += 1
  action.updated_at = at
  action.history = [...(action.history || []), { command, at, source_revision: action.source_revision }]
}

function requireMutable(action, input) {
  requireRevision(action, input)
  rejectTerminal(action)
  if (!OPEN_OR_WAITING.has(action.status)) fail(`Invalid action transition: ${action.status}`, 'INVALID_TRANSITION')
}

function subjectCovered(interaction, subject) {
  if (subject.type === 'company') return interaction.company_id === subject.id
  if (subject.type === 'person') return Array.isArray(interaction.person_ids) && interaction.person_ids.includes(subject.id)
  if (subject.type === 'opportunity') return interaction.opportunity_id === subject.id
  if (subject.type === 'application_attempt') return interaction.application_attempt_id === subject.id
  return false
}

function completeExternal(model, action, payload) {
  rejectUnknown(payload, new Set(['id', 'completedAt', 'interactionId']))
  if (typeof payload.interactionId !== 'string' || !payload.interactionId.startsWith('interaction:')) fail('interactionId is required', 'INVALID_COMMAND')
  const interaction = model.interactions.find(item => item.id === payload.interactionId)
  if (!interaction) fail(`Interaction not found: ${payload.interactionId}`, 'NOT_FOUND')
  const kindMatches = interaction.kind === action.expected_kind
  const confirmed = interaction.evidence_state === 'confirmed'
  const covered = Array.isArray(action.subjects) && action.subjects.every(subject => subjectCovered(interaction, subject))
  if (!confirmed || !kindMatches || !covered) fail('Interaction does not match the action', 'INVALID_COMMAND')
  action.interaction_id = interaction.id
}

function completeInternal(model, action, payload) {
  if (Object.prototype.hasOwnProperty.call(payload, 'interactionId')) fail('An interaction id is not internal evidence', 'INVALID_COMMAND')
  rejectUnknown(payload, new Set(['id', 'completedAt', 'result', 'artifactId']))
  const hasResult = Object.prototype.hasOwnProperty.call(payload, 'result')
  const hasArtifact = Object.prototype.hasOwnProperty.call(payload, 'artifactId')
  if (hasResult && !nonempty(payload.result)) fail('result must be nonempty', 'INVALID_COMMAND')
  if (!hasResult && !hasArtifact) fail('Internal completion requires a result, a linked artifact, or both', 'INVALID_COMMAND')
  if (hasArtifact) {
    if (typeof payload.artifactId !== 'string' || !payload.artifactId.startsWith('artifact:')) fail('artifactId must be an artifact id', 'INVALID_COMMAND')
    const artifact = model.artifacts.find(item => item.id === payload.artifactId)
    if (!artifact) fail(`Artifact not found: ${payload.artifactId}`, 'NOT_FOUND')
    const subjectIds = new Set((action.subjects || []).map(subject => subject.id))
    const linked = subjectIds.has(artifact.owner_id) || (artifact.subject_ids || []).some(id => subjectIds.has(id))
    if (!linked) fail('Artifact is not linked to an action subject', 'INVALID_COMMAND')
    action.artifact_id = artifact.id
  }
  if (hasResult) action.result = payload.result.trim()
}

export function validateActions(model, errors) {
  if (!Array.isArray(model?.actions)) return
  for (const action of model.actions) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) { errors.push('action must be an object'); continue }
    const id = typeof action.id === 'string' ? action.id : 'action'
    if (!CATEGORIES.has(action.category)) errors.push(`${id} category must be internal or external_contact`)
    if (!STATUSES.has(action.status)) errors.push(`${id} status must be open, waiting, completed, or cancelled`)
    if (!nonempty(action.objective)) errors.push(`${id} objective is required`)
    if (!Array.isArray(action.subjects) || action.subjects.length === 0) errors.push(`${id} subjects are required`)
    else {
      const seen = new Set()
      for (const subject of action.subjects) {
        if (!subject || typeof subject !== 'object' || !SUBJECT_PREFIXES[subject.type] || typeof subject.id !== 'string' || !subject.id.startsWith(SUBJECT_PREFIXES[subject.type])) {
          errors.push(`${id} invalid subject`)
          continue
        }
        const pair = `${subject.type}\0${subject.id}`
        if (seen.has(pair)) errors.push(`${id} duplicate subject ${subject.type} ${subject.id}`)
        seen.add(pair)
        const collection = model[SUBJECT_COLLECTIONS[subject.type]] || []
        if (!collection.some(item => item?.id === subject.id)) errors.push(`${id} missing subject ${subject.id}`)
      }
    }
    if (action.category === 'internal' && action.expected_kind != null) errors.push(`${id} internal action omits expected_kind`)
    if (action.category === 'external_contact' && !CONTACT_KIND_SET.has(action.expected_kind)) errors.push(`${id} expected_kind is required`)
    if (action.expected_kind != null && action.category !== 'external_contact' && action.category !== 'internal') errors.push(`${id} expected_kind is only valid for external_contact`)
    if (action.due_on != null && !isRealDate(action.due_on)) errors.push(`${id} due_on is not a real date`)
    if (action.status === 'completed' && !isRealDateTime(action.completed_at)) errors.push(`${id} completed_at is required`)
    if (action.status === 'cancelled' && !nonempty(action.reason)) errors.push(`${id} reason is required`)
    if (!nonempty(action.actor)) errors.push(`${id} actor is required`)
    if (!isRealDateTime(action.created_at)) errors.push(`${id} created_at must be a real UTC date-time`)
    if (!isRealDateTime(action.updated_at)) errors.push(`${id} updated_at must be a real UTC date-time`)
    if (!Number.isInteger(action.source_revision) || action.source_revision < 0) errors.push(`${id} source_revision is required`)
    if (!Array.isArray(action.history) || action.history.length === 0) errors.push(`${id} history is required`)
    else for (const entry of action.history) {
      if (!entry || typeof entry !== 'object' || !nonempty(entry.command) || !isRealDateTime(entry.at) || !Number.isInteger(entry.source_revision) || entry.source_revision < 0) errors.push(`${id} history entry is incomplete`)
    }
    if (Array.isArray(action.strategy_ids)) for (const strategyId of action.strategy_ids) if (!(model.strategies || []).some(item => item.id === strategyId)) errors.push(`${id} missing strategy ${strategyId}`)
    if (action.experiment_id) {
      const experiment = (model.experiments || []).find(item => item.id === action.experiment_id)
      if (!experiment) errors.push(`${id} missing experiment ${action.experiment_id}`)
      else if (!action.cohort_id || !(experiment.cohorts || []).some(cohort => cohort.id === action.cohort_id)) errors.push(`${id} invalid experiment cohort`)
      else if (Array.isArray(action.strategy_ids)) for (const strategyId of action.strategy_ids) if (!(experiment.strategy_ids || []).includes(strategyId)) errors.push(`${id} strategy ${strategyId} is outside ${experiment.id}`)
    } else if (action.cohort_id) errors.push(`${id} cohort_id requires experiment_id`)
  }
}

function recordsDirectoryMissing(paths) {
  return !paths?.recordsDir || !fs.existsSync(paths.recordsDir)
}

export function listActions(paths) {
  if (recordsDirectoryMissing(paths)) return { schemaVersion: 1, status: 'ok', actions: [] }
  const model = loadModel(paths)
  return { schemaVersion: 1, status: 'ok', actions: model.actions }
}

export function getAction(paths, id) {
  if (typeof id !== 'string' || !id) fail('action get requires --id', 'USAGE')
  if (recordsDirectoryMissing(paths)) fail(`Action not found: ${id}`, 'NOT_FOUND')
  const model = loadModel(paths)
  const action = model.actions.find(item => item.id === id)
  if (!action) fail(`Action not found: ${id}`, 'NOT_FOUND')
  return { schemaVersion: 1, status: 'ok', action }
}

export function planAction(paths, raw) {
  const input = envelope('action plan', raw)
  if (raw && Object.prototype.hasOwnProperty.call(raw, 'expectedRevision')) fail('plan rejects expectedRevision', 'INVALID_COMMAND')
  return mutate(paths, input, model => {
    const action = planRecord(model, input)
    model.actions.push(action)
    return { changedEntities: [action.id], revision: action.source_revision }
  })
}

export function waitAction(paths, raw) {
  const input = envelope('action wait', raw)
  const payload = input.payload || {}
  rejectUnknown(payload, new Set(['id']))
  return mutate(paths, input, model => {
    const action = findAction(model, payload.id)
    requireRevision(action, input)
    if (action.status === 'completed' || action.status === 'cancelled') fail(`Invalid action transition: ${action.status} -> waiting`, 'INVALID_TRANSITION')
    if (action.status !== 'open') fail(`Invalid action transition: ${action.status} -> waiting`, 'INVALID_TRANSITION')
    action.status = 'waiting'
    touch(action, 'action wait')
    return { changedEntities: [action.id], revision: action.source_revision }
  })
}

export function unwaitAction(paths, raw) {
  const input = envelope('action unwait', raw)
  const payload = input.payload || {}
  rejectUnknown(payload, new Set(['id']))
  return mutate(paths, input, model => {
    const action = findAction(model, payload.id)
    requireRevision(action, input)
    if (action.status === 'completed' || action.status === 'cancelled') fail(`Invalid action transition: ${action.status} -> open`, 'INVALID_TRANSITION')
    if (action.status !== 'waiting') fail(`Invalid action transition: ${action.status} -> open`, 'INVALID_TRANSITION')
    action.status = 'open'
    touch(action, 'action unwait')
    return { changedEntities: [action.id], revision: action.source_revision }
  })
}

export function updateAction(paths, raw) {
  const input = envelope('action update', raw)
  const payload = input.payload || {}
  rejectUnknown(payload, new Set(['id', 'objective', 'note']))
  if (!Object.prototype.hasOwnProperty.call(payload, 'objective') && !Object.prototype.hasOwnProperty.call(payload, 'note')) fail('update requires objective, note, or both', 'INVALID_COMMAND')
  if (Object.prototype.hasOwnProperty.call(payload, 'objective') && !nonempty(payload.objective)) fail('objective is required', 'INVALID_COMMAND')
  if (Object.prototype.hasOwnProperty.call(payload, 'note') && payload.note != null && !nonempty(payload.note)) fail('note must be a nonempty string or null', 'INVALID_COMMAND')
  return mutate(paths, input, model => {
    const action = findAction(model, payload.id)
    requireMutable(action, input)
    if (Object.prototype.hasOwnProperty.call(payload, 'objective')) action.objective = payload.objective.trim()
    if (Object.prototype.hasOwnProperty.call(payload, 'note')) {
      if (payload.note == null) delete action.note
      else action.note = payload.note.trim()
    }
    touch(action, 'action update')
    return { changedEntities: [action.id], revision: action.source_revision }
  })
}

export function rescheduleAction(paths, raw) {
  const input = envelope('action reschedule', raw)
  const payload = input.payload || {}
  rejectUnknown(payload, new Set(['id', 'dueOn']))
  if (!Object.prototype.hasOwnProperty.call(payload, 'dueOn')) fail('dueOn is required', 'INVALID_COMMAND')
  if (payload.dueOn != null) requireDate(payload.dueOn, 'dueOn')
  return mutate(paths, input, model => {
    const action = findAction(model, payload.id)
    requireMutable(action, input)
    if (payload.dueOn == null) delete action.due_on
    else action.due_on = payload.dueOn
    touch(action, 'action reschedule')
    return { changedEntities: [action.id], revision: action.source_revision }
  })
}

export function completeAction(paths, raw) {
  const input = envelope('action complete', raw)
  const payload = input.payload || {}
  if (!Object.prototype.hasOwnProperty.call(payload, 'completedAt')) fail('completedAt is required', 'INVALID_COMMAND')
  requireDateTime(payload.completedAt, 'completedAt')
  return mutate(paths, input, model => {
    const action = findAction(model, payload.id)
    requireMutable(action, input)
    if (action.category === 'external_contact') completeExternal(model, action, payload)
    else completeInternal(model, action, payload)
    action.completed_at = payload.completedAt
    action.status = 'completed'
    touch(action, 'action complete')
    return { changedEntities: [action.id], revision: action.source_revision }
  })
}

export function cancelAction(paths, raw) {
  const input = envelope('action cancel', raw)
  const payload = input.payload || {}
  rejectUnknown(payload, new Set(['id', 'reason']))
  if (!nonempty(payload.reason)) fail('reason is required', 'INVALID_COMMAND')
  return mutate(paths, input, model => {
    const action = findAction(model, payload.id)
    requireMutable(action, input)
    action.reason = payload.reason.trim()
    action.status = 'cancelled'
    touch(action, 'action cancel')
    return { changedEntities: [action.id], revision: action.source_revision }
  })
}

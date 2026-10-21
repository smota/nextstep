import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { contactClock, getAction, isRealDateTime, listActions, validateActions } from '../src/actions.mjs'
import { main, routeNames } from '../src/cli.mjs'
import { commandDescription, get, planAction, waitAction, unwaitAction, updateAction, rescheduleAction, completeAction, cancelAction, recordInteraction, recordOpportunityDecision, recordOutreachSent, recordSubmission, closeApplication, upsertEntity, createStrategy, createExperiment } from '../src/commands.mjs'
import { resolvePaths } from '../src/config.mjs'
import { json, loadModel, RECORD_FILES, validateModel } from '../src/model.mjs'
import { renderIndexes } from '../src/storage.mjs'
import { fixture as careerFixture } from './fixtures/career-vault.mjs'
import { SYNTHETIC, syntheticVault, trackedFiles } from './fixtures/vault-v4.mjs'

const UPGRADE_MESSAGE = 'Vault schema_version 4 requires an explicit upgrade. Run model upgrade-preview, then model upgrade-apply with that token.'
const UPGRADE_DETAILS = { schemaVersion: 4, previewCommand: 'model upgrade-preview', applyCommand: 'model upgrade-apply' }
const WHEN = '2026-10-21T15:00:00.000Z'
const EARLIER = '2026-10-01T15:00:00.000Z'

let sequence = 0
function env(payload, extra = {}) {
  sequence += 1
  const id = extra.requestId || `action-${sequence}`
  return { schemaVersion: 1, requestId: id, idempotencyKey: extra.idempotencyKey || id, actor: extra.actor || 'user', ...extra, payload }
}

function expectCode(fn, code) {
  let caught
  try { fn() } catch (error) { caught = error }
  assert.ok(caught, `expected ${code}`)
  assert.equal(caught.code, code)
  return caught
}

function fileSha(file) {
  return fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null
}

function freeze(root, extra = []) {
  const paths = resolvePaths({ dataRoot: root })
  const files = [...trackedFiles(root), paths.ledgerPath, path.join(paths.recordsDir, RECORD_FILES.actions), ...extra]
  return Object.fromEntries(files.map(file => [path.relative(root, file).split(path.sep).join('/'), fileSha(file)]))
}

function actionsOf(paths) { return loadModel(paths).actions }

function actionById(paths, id) { return actionsOf(paths).find(item => item.id === id) }

function writeCollection(paths, type, records) {
  fs.writeFileSync(path.join(paths.recordsDir, RECORD_FILES[type]), json(records))
  const manifestFile = path.join(paths.recordsDir, 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  manifest.counts[type] = records.length
  fs.writeFileSync(manifestFile, json(manifest))
}

function holdLock(paths) {
  fs.mkdirSync(path.dirname(paths.lockPath), { recursive: true })
  const body = json({ schemaVersion: 1, requestId: 'held', pid: process.pid, acquiredAt: new Date().toISOString() })
  fs.writeFileSync(paths.lockPath, body, { flag: 'wx' })
  return body
}

function plantJournal(paths) {
  fs.mkdirSync(paths.journalDir, { recursive: true })
  const companies = path.join(paths.recordsDir, RECORD_FILES.companies)
  const original = fs.readFileSync(companies)
  const journalFile = path.join(paths.journalDir, 'pending.json')
  const body = json({ schemaVersion: 1, id: 'pending-journal', requestId: 'pending', state: 'prepared', preimages: [{ file: companies, existed: true, data: Buffer.from(json([{ id: 'company:restored', name: 'Restored' }])).toString('base64') }] })
  fs.writeFileSync(journalFile, body)
  return { journalFile, body, companies, original }
}

function externalPlan(id, subjects, expectedKind, extra = {}) {
  return env({ id, category: 'external_contact', subjects, objective: 'Send the introduction', expectedKind, ...extra.payload }, extra)
}

test('contactClock classifies confirmed contact rows and ignores every other row', () => {
  const at = WHEN
  assert.equal(contactClock({ kind: 'outreach', evidence_state: 'confirmed', occurred_at: at }), 'outbound')
  assert.equal(contactClock({ kind: 'outreach_sent', evidence_state: 'confirmed', occurred_at: at }), 'outbound')
  assert.equal(contactClock({ kind: 'outreach', evidence_state: 'confirmed', occurred_at: at, direction: 'inbound' }), 'inbound')
  assert.equal(contactClock({ kind: 'conversation', evidence_state: 'confirmed', occurred_at: at }), 'unknown')
  assert.equal(contactClock({ kind: 'interview', evidence_state: 'confirmed', occurred_at: at }), 'unknown')
  assert.equal(contactClock({ kind: 'screen', evidence_state: 'confirmed', occurred_at: at, direction: 'outbound' }), 'outbound')
  assert.equal(contactClock({ kind: 'outreach', evidence_state: 'confirmed', occurred_at: '2026-10-21' }), 'unknown')
  assert.equal(contactClock({ kind: 'outreach', evidence_state: 'confirmed' }), 'unknown')
  assert.equal(contactClock({ kind: 'outreach', evidence_state: 'confirmed', occurred_at: 'not-a-date' }), 'unknown')
  assert.equal(contactClock({ kind: 'outreach', evidence_state: 'planned', occurred_at: at, direction: 'outbound' }), 'unknown')
  for (const kind of ['note', 'application_outcome', 'opportunity_decision', 'strategy_gate_decision', 'submission']) {
    assert.equal(contactClock({ kind, evidence_state: 'confirmed', occurred_at: at, direction: 'outbound' }), 'unknown')
  }
})

test('a vacancy-free company can be planned, completed from record-sent, and continued', t => {
  const { paths } = careerFixture(t)
  const companyId = 'company:vacancy-free'
  assert.equal(upsertEntity(paths, env({ type: 'company', record: { id: companyId, name: 'Vacancy Free' } })).status, 'applied')
  const planned = planAction(paths, env({ id: 'action:intro', category: 'external_contact', subjects: [{ type: 'company', id: companyId }], objective: 'Send the introduction', expectedKind: 'outreach', dueOn: '2026-10-28' }, { actor: 'operator' }))
  assert.equal(planned.status, 'applied')
  assert.equal(planned.revision, 0)
  const action = actionById(paths, 'action:intro')
  assert.equal(action.status, 'open')
  assert.equal(action.category, 'external_contact')
  assert.equal(action.expected_kind, 'outreach')
  assert.equal(action.actor, 'operator')
  assert.equal(action.objective, 'Send the introduction')
  assert.deepEqual(action.subjects, [{ type: 'company', id: companyId }])
  assert.equal(action.due_on, '2026-10-28')
  assert.equal(Object.hasOwn(action, 'company_id'), false)
  assert.equal(isRealDateTime(action.created_at), true)
  assert.equal(action.updated_at, action.created_at)
  assert.deepEqual(action.history, [{ command: 'action plan', at: action.created_at, source_revision: 0 }])
  assert.equal(loadModel(paths).opportunities.some(item => item.company_id === companyId), false)
  assert.equal(loadModel(paths).applicationAttempts.some(item => item.opportunity_id?.includes('vacancy-free')), false)

  const sent = recordOutreachSent(paths, env({ channel: 'email', recipient: 'hiring', objective: 'introduce the work', occurredAt: EARLIER, companyId, interactionId: 'interaction:vacancy-free-outreach' }))
  assert.equal(sent.status, 'applied')
  const outreach = loadModel(paths).interactions.find(item => item.id === 'interaction:vacancy-free-outreach')
  assert.equal(outreach.kind, 'outreach')
  assert.equal(outreach.direction, 'outbound')
  assert.equal(outreach.evidence_state, 'confirmed')
  assert.equal(contactClock(outreach), 'outbound')
  const beforeComplete = loadModel(paths)
  const interactionBytes = fs.readFileSync(path.join(paths.recordsDir, RECORD_FILES.interactions))
  const attempt = beforeComplete.applicationAttempts.find(item => item.id === 'application-attempt:acme-lead')
  const opportunity = beforeComplete.opportunities.find(item => item.id === 'opportunity:acme-lead')
  const completed = completeAction(paths, env({ id: 'action:intro', completedAt: WHEN, interactionId: outreach.id }, { expectedRevision: 0 }))
  assert.equal(completed.revision, 1)
  const done = actionById(paths, 'action:intro')
  assert.equal(done.status, 'completed')
  assert.equal(done.completed_at, WHEN)
  assert.notEqual(done.completed_at, outreach.occurred_at)
  assert.equal(done.interaction_id, outreach.id)
  assert.equal(done.updated_at > done.created_at, true)
  assert.deepEqual(fs.readFileSync(path.join(paths.recordsDir, RECORD_FILES.interactions)), interactionBytes)
  const after = loadModel(paths)
  assert.equal(after.applicationAttempts.find(item => item.id === attempt.id).lifecycle_status, attempt.lifecycle_status)
  assert.equal(after.opportunities.find(item => item.id === opportunity.id).pursuit_status, opportunity.pursuit_status)
  assert.equal(after.interactions.length, beforeComplete.interactions.length)
  assert.equal(contactClock(after.interactions.find(item => item.id === outreach.id)), 'outbound')

  planAction(paths, env({ id: 'action:intro-next', category: 'external_contact', subjects: [{ type: 'company', id: companyId }], objective: 'Wait for a reply', expectedKind: 'human_response' }))
  assert.equal(actionById(paths, 'action:intro').status, 'completed')
  assert.equal(actionById(paths, 'action:intro-next').status, 'open')
  assert.equal(loadModel(paths).opportunities.some(item => item.company_id === companyId), false)
  const rendered = [...renderIndexes(loadModel(paths)).values()].join('\n')
  // interaction: ends with the letters action:; require an action-id boundary so those rows stay visible.
  assert.equal(/(^|[^a-z])action:/.test(rendered), false)
  assert.equal(rendered.includes('action:intro'), false)
  assert.equal(rendered.includes('action:intro-next'), false)
  assert.equal(Object.hasOwn(loadModel(paths).companies.find(item => item.id === companyId), 'action_ids'), false)
})

test('a person-only subject does not attach a company', t => {
  const { paths } = careerFixture(t)
  upsertEntity(paths, env({ type: 'person', record: { id: 'person:solo', name: 'Solo' } }))
  const beforePeople = loadModel(paths).people.map(item => structuredClone(item))
  const beforeCompanies = loadModel(paths).companies.map(item => structuredClone(item))
  const result = planAction(paths, env({ id: 'action:solo', category: 'internal', subjects: [{ type: 'person', id: 'person:solo' }], objective: 'Draft the note' }))
  assert.equal(result.status, 'applied')
  assert.deepEqual(loadModel(paths).people, beforePeople)
  assert.deepEqual(loadModel(paths).companies, beforeCompanies)
  const patBefore = beforePeople.find(item => item.id === 'person:pat')
  planAction(paths, env({ id: 'action:pat', category: 'external_contact', subjects: [{ type: 'person', id: 'person:pat' }], objective: 'Ask Pat', expectedKind: 'conversation' }))
  const pat = loadModel(paths).people.find(item => item.id === 'person:pat')
  const solo = loadModel(paths).people.find(item => item.id === 'person:solo')
  assert.equal(pat.company_id, patBefore.company_id)
  assert.deepEqual(pat.company_ids, patBefore.company_ids)
  assert.equal(solo.company_id, undefined)
  assert.equal(Object.hasOwn(actionById(paths, 'action:solo'), 'company_id'), false)
  assert.equal(Object.hasOwn(actionById(paths, 'action:pat'), 'company_id'), false)
  assert.deepEqual(loadModel(paths).companies.find(item => item.id === 'company:acme').person_ids, beforeCompanies.find(item => item.id === 'company:acme').person_ids)
})

test('an undirected confirmed conversation completes without moving either clock', t => {
  const { paths } = careerFixture(t)
  recordOutreachSent(paths, env({ channel: 'email', recipient: 'person:pat', objective: 'earlier note', occurredAt: EARLIER, companyId: 'company:acme', interactionId: 'interaction:acme-outbound' }))
  recordInteraction(paths, env({ record: { id: 'interaction:acme-conversation', kind: 'conversation', evidence_state: 'confirmed', occurred_at: WHEN, company_id: 'company:acme', person_ids: ['person:pat'] } }))
  const conversation = loadModel(paths).interactions.find(item => item.id === 'interaction:acme-conversation')
  assert.equal(Object.hasOwn(conversation, 'direction'), false)
  assert.equal(contactClock(conversation), 'unknown')
  assert.equal(contactClock(loadModel(paths).interactions.find(item => item.id === 'interaction:acme-outbound')), 'outbound')
  planAction(paths, env({ id: 'action:talk', category: 'external_contact', subjects: [{ type: 'company', id: 'company:acme' }, { type: 'person', id: 'person:pat' }], objective: 'Hold the conversation', expectedKind: 'conversation' }))
  const before = loadModel(paths).interactions.map(item => structuredClone(item))
  completeAction(paths, env({ id: 'action:talk', completedAt: '2026-10-22T12:00:00.000Z', interactionId: 'interaction:acme-conversation' }, { expectedRevision: 0 }))
  assert.equal(actionById(paths, 'action:talk').status, 'completed')
  assert.equal(actionById(paths, 'action:talk').completed_at, '2026-10-22T12:00:00.000Z')
  assert.deepEqual(loadModel(paths).interactions, before)
  assert.equal(contactClock(loadModel(paths).interactions.find(item => item.id === 'interaction:acme-conversation')), 'unknown')
  assert.equal(contactClock(loadModel(paths).interactions.find(item => item.id === 'interaction:acme-outbound')), 'outbound')

  const model = loadModel(paths)
  model.interactions.push({ id: 'interaction:undated-conversation', kind: 'conversation', evidence_state: 'confirmed', company_id: 'company:acme', person_ids: [] })
  writeCollection(paths, 'interactions', model.interactions)
  planAction(paths, env({ id: 'action:undated', category: 'external_contact', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Count the undated conversation', expectedKind: 'conversation' }))
  const stored = loadModel(paths).interactions.find(item => item.id === 'interaction:undated-conversation')
  assert.equal(contactClock(stored), 'unknown')
  const interactionsBefore = loadModel(paths).interactions.map(item => item.id)
  completeAction(paths, env({ id: 'action:undated', completedAt: WHEN, interactionId: 'interaction:undated-conversation' }, { expectedRevision: 0 }))
  assert.equal(actionById(paths, 'action:undated').status, 'completed')
  assert.deepEqual(loadModel(paths).interactions.map(item => item.id), interactionsBefore)
  assert.equal(Object.hasOwn(loadModel(paths).interactions.find(item => item.id === 'interaction:undated-conversation'), 'direction'), false)
  assert.equal(Object.hasOwn(loadModel(paths).interactions.find(item => item.id === 'interaction:undated-conversation'), 'occurred_at'), false)
})

test('internal completion does not add an interaction, move the outbound clock, or change application lifecycle', t => {
  const { paths } = careerFixture(t)
  recordOutreachSent(paths, env({ channel: 'email', recipient: 'person:pat', objective: 'keep the clock', occurredAt: EARLIER, companyId: 'company:acme', interactionId: 'interaction:clock' }))
  const beforeLifecycle = loadModel(paths).applicationAttempts[0].lifecycle_status
  const beforePursuit = loadModel(paths).opportunities[0].pursuit_status
  const beforeInteractions = loadModel(paths).interactions.map(item => structuredClone(item))
  planAction(paths, env({ id: 'action:result', category: 'internal', subjects: [{ type: 'application_attempt', id: 'application-attempt:acme-lead' }], objective: 'Write the result' }))
  planAction(paths, env({ id: 'action:artifact', category: 'internal', subjects: [{ type: 'person', id: 'person:pat' }], objective: 'Use the note' }))
  planAction(paths, env({ id: 'action:both', category: 'internal', subjects: [{ type: 'person', id: 'person:pat' }], objective: 'Use both' }))
  completeAction(paths, env({ id: 'action:result', completedAt: WHEN, result: 'The note is ready' }, { expectedRevision: 0 }))
  completeAction(paths, env({ id: 'action:artifact', completedAt: WHEN, artifactId: 'artifact:pat-note' }, { expectedRevision: 0 }))
  completeAction(paths, env({ id: 'action:both', completedAt: WHEN, result: 'Sent the working note', artifactId: 'artifact:pat-note' }, { expectedRevision: 0 }))
  assert.equal(actionById(paths, 'action:result').result, 'The note is ready')
  assert.equal(Object.hasOwn(actionById(paths, 'action:result'), 'interaction_id'), false)
  assert.equal(actionById(paths, 'action:artifact').artifact_id, 'artifact:pat-note')
  assert.equal(actionById(paths, 'action:both').result, 'Sent the working note')
  assert.equal(actionById(paths, 'action:both').artifact_id, 'artifact:pat-note')
  assert.deepEqual(loadModel(paths).interactions, beforeInteractions)
  assert.equal(contactClock(loadModel(paths).interactions.find(item => item.id === 'interaction:clock')), 'outbound')
  assert.equal(loadModel(paths).applicationAttempts[0].lifecycle_status, beforeLifecycle)
  assert.equal(loadModel(paths).opportunities[0].pursuit_status, beforePursuit)
  planAction(paths, env({ id: 'action:neither', category: 'internal', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Do not cite an interaction' }))
  expectCode(() => completeAction(paths, env({ id: 'action:neither', completedAt: WHEN, interactionId: 'interaction:clock', result: 'no' }, { expectedRevision: 0 })), 'INVALID_COMMAND')
  assert.equal(actionById(paths, 'action:neither').status, 'open')
  assert.deepEqual(loadModel(paths).interactions, beforeInteractions)
  assert.equal(loadModel(paths).applicationAttempts[0].lifecycle_status, beforeLifecycle)
})

test('one cited interaction completes only the commanded action', t => {
  const { paths } = careerFixture(t)
  recordOutreachSent(paths, env({ channel: 'email', recipient: 'hiring', objective: 'shared evidence', occurredAt: EARLIER, companyId: 'company:acme', interactionId: 'interaction:shared' }))
  planAction(paths, env({ id: 'action:one', category: 'external_contact', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'First follow-up', expectedKind: 'outreach' }))
  planAction(paths, env({ id: 'action:two', category: 'external_contact', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Second follow-up', expectedKind: 'outreach' }))
  completeAction(paths, env({ id: 'action:one', completedAt: WHEN, interactionId: 'interaction:shared' }, { expectedRevision: 0 }))
  assert.equal(actionById(paths, 'action:one').status, 'completed')
  assert.equal(actionById(paths, 'action:two').status, 'open')
  assert.equal(actionById(paths, 'action:two').interaction_id, undefined)
})

test('completion matches own foreign keys and rejects uncovered links and kind mismatch', t => {
  const { paths } = careerFixture(t)
  recordInteraction(paths, env({ record: { id: 'interaction:attempt-only', kind: 'conversation', evidence_state: 'confirmed', occurred_at: WHEN, application_attempt_id: 'application-attempt:acme-lead', person_ids: [] } }))
  assert.ok(loadModel(paths).opportunities[0].interaction_ids.includes('interaction:attempt-only'))
  planAction(paths, env({ id: 'action:backlink', category: 'external_contact', subjects: [{ type: 'opportunity', id: 'opportunity:acme-lead' }], objective: 'Do not use the backlink', expectedKind: 'conversation' }))
  expectCode(() => completeAction(paths, env({ id: 'action:backlink', completedAt: WHEN, interactionId: 'interaction:attempt-only' }, { expectedRevision: 0 })), 'INVALID_COMMAND')
  assert.equal(actionById(paths, 'action:backlink').status, 'open')

  recordInteraction(paths, env({ record: { id: 'interaction:covered', kind: 'interview', evidence_state: 'confirmed', occurred_at: WHEN, company_id: 'company:acme', person_ids: ['person:pat'], opportunity_id: 'opportunity:acme-lead', application_attempt_id: 'application-attempt:acme-lead' } }))
  planAction(paths, env({ id: 'action:covered', category: 'external_contact', subjects: [{ type: 'company', id: 'company:acme' }, { type: 'person', id: 'person:pat' }, { type: 'opportunity', id: 'opportunity:acme-lead' }, { type: 'application_attempt', id: 'application-attempt:acme-lead' }], objective: 'Cover every subject', expectedKind: 'interview' }))
  assert.equal(completeAction(paths, env({ id: 'action:covered', completedAt: WHEN, interactionId: 'interaction:covered' }, { expectedRevision: 0 })).status, 'applied')

  planAction(paths, env({ id: 'action:extra', category: 'external_contact', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Extra foreign keys are allowed', expectedKind: 'interview' }))
  assert.equal(completeAction(paths, env({ id: 'action:extra', completedAt: WHEN, interactionId: 'interaction:covered' }, { expectedRevision: 0 })).status, 'applied')

  planAction(paths, env({ id: 'action:uncovered', category: 'external_contact', subjects: [{ type: 'company', id: 'company:acme' }, { type: 'person', id: 'person:pat' }], objective: 'Person must be on the interaction', expectedKind: 'conversation' }))
  recordInteraction(paths, env({ record: { id: 'interaction:company-only', kind: 'conversation', evidence_state: 'confirmed', occurred_at: WHEN, company_id: 'company:acme', person_ids: [] } }))
  expectCode(() => completeAction(paths, env({ id: 'action:uncovered', completedAt: WHEN, interactionId: 'interaction:company-only' }, { expectedRevision: 0 })), 'INVALID_COMMAND')
  planAction(paths, env({ id: 'action:mismatch', category: 'external_contact', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Kind must match', expectedKind: 'outreach' }))
  expectCode(() => completeAction(paths, env({ id: 'action:mismatch', completedAt: WHEN, interactionId: 'interaction:company-only' }, { expectedRevision: 0 })), 'INVALID_COMMAND')
  expectCode(() => completeAction(paths, env({ id: 'action:mismatch', completedAt: WHEN, interactionId: 'interaction:missing' }, { expectedRevision: 0 })), 'NOT_FOUND')
  recordInteraction(paths, env({ record: { id: 'interaction:planned-chat', kind: 'conversation', evidence_state: 'planned', company_id: 'company:acme', person_ids: [] } }))
  planAction(paths, env({ id: 'action:unconfirmed', category: 'external_contact', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Confirmed only', expectedKind: 'conversation' }))
  expectCode(() => completeAction(paths, env({ id: 'action:unconfirmed', completedAt: WHEN, interactionId: 'interaction:planned-chat' }, { expectedRevision: 0 })), 'INVALID_COMMAND')
})

test('unwait returns waiting to open and terminal states stay terminal', t => {
  const { paths } = careerFixture(t)
  planAction(paths, env({ id: 'action:pause', category: 'external_contact', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Pause this', expectedKind: 'screen', dueOn: '2024-02-29', note: 'Keep this note' }))
  waitAction(paths, env({ id: 'action:pause' }, { expectedRevision: 0 }))
  assert.equal(actionById(paths, 'action:pause').status, 'waiting')
  updateAction(paths, env({ id: 'action:pause', note: 'Still the note' }, { expectedRevision: 1 }))
  unwaitAction(paths, env({ id: 'action:pause' }, { expectedRevision: 2 }))
  const opened = actionById(paths, 'action:pause')
  assert.equal(opened.status, 'open')
  assert.equal(opened.due_on, '2024-02-29')
  assert.equal(opened.note, 'Still the note')
  assert.equal(opened.category, 'external_contact')
  assert.equal(opened.expected_kind, 'screen')
  assert.deepEqual(opened.subjects, [{ type: 'company', id: 'company:acme' }])
  assert.deepEqual(opened.history.map(item => item.command), ['action plan', 'action wait', 'action update', 'action unwait'])
  assert.equal(opened.updated_at > opened.created_at, true)
  rescheduleAction(paths, env({ id: 'action:pause', dueOn: null }, { expectedRevision: 3 }))
  assert.equal(Object.hasOwn(actionById(paths, 'action:pause'), 'due_on'), false)
  updateAction(paths, env({ id: 'action:pause', note: null }, { expectedRevision: 4 }))
  assert.equal(Object.hasOwn(actionById(paths, 'action:pause'), 'note'), false)
  assert.equal(actionById(paths, 'action:pause').objective, 'Pause this')

  planAction(paths, env({ id: 'action:done', category: 'internal', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Finish internally' }))
  waitAction(paths, env({ id: 'action:done' }, { expectedRevision: 0 }))
  completeAction(paths, env({ id: 'action:done', completedAt: WHEN, result: 'Finished' }, { expectedRevision: 1 }))
  const doneHash = fs.readFileSync(path.join(paths.recordsDir, RECORD_FILES.actions))
  for (const fn of [waitAction, unwaitAction, updateAction, rescheduleAction, cancelAction, completeAction]) {
    const payload = fn === completeAction ? { id: 'action:done', completedAt: WHEN, result: 'Again' } : fn === cancelAction ? { id: 'action:done', reason: 'no' } : fn === updateAction ? { id: 'action:done', objective: 'Changed' } : fn === rescheduleAction ? { id: 'action:done', dueOn: '2026-10-28' } : { id: 'action:done' }
    expectCode(() => fn(paths, env(payload, { expectedRevision: 2 })), 'INVALID_TRANSITION')
  }
  assert.equal(actionById(paths, 'action:done').status, 'completed')
  assert.deepEqual(fs.readFileSync(path.join(paths.recordsDir, RECORD_FILES.actions)), doneHash)

  planAction(paths, env({ id: 'action:stopped', category: 'internal', subjects: [{ type: 'person', id: 'person:pat' }], objective: 'Stop this' }))
  cancelAction(paths, env({ id: 'action:stopped', reason: 'No longer useful' }, { expectedRevision: 0 }))
  assert.equal(actionById(paths, 'action:stopped').status, 'cancelled')
  assert.equal(actionById(paths, 'action:stopped').reason, 'No longer useful')
  expectCode(() => unwaitAction(paths, env({ id: 'action:stopped' }, { expectedRevision: 1 })), 'INVALID_TRANSITION')
  expectCode(() => unwaitAction(paths, env({ id: 'action:pause' }, { expectedRevision: 5 })), 'INVALID_TRANSITION')
  assert.equal(actionById(paths, 'action:pause').status, 'open')
  assert.equal(actionById(paths, 'action:pause').source_revision, 5)
  expectCode(() => unwaitAction(paths, env({ id: 'action:open-miss' }, { expectedRevision: 0 })), 'NOT_FOUND')
})

test('direction is stored only for contact kinds and record-sent stays outbound', t => {
  const { paths } = careerFixture(t)
  const interactions = () => fs.readFileSync(path.join(paths.recordsDir, RECORD_FILES.interactions))
  const before = interactions()
  expectCode(() => recordOutreachSent(paths, env({ channel: 'email', recipient: 'person:pat', objective: 'no', occurredAt: EARLIER, companyId: 'company:acme', direction: 'inbound' })), 'INVALID_COMMAND')
  assert.deepEqual(interactions(), before)
  const explicit = recordOutreachSent(paths, env({ channel: 'email', recipient: 'person:pat', objective: 'yes', occurredAt: EARLIER, companyId: 'company:acme', interactionId: 'interaction:explicit-outbound', direction: 'outbound' }))
  assert.equal(explicit.status, 'applied')
  assert.equal(loadModel(paths).interactions.find(item => item.id === 'interaction:explicit-outbound').direction, 'outbound')
  const omitted = recordOutreachSent(paths, env({ channel: 'email', recipient: 'other', objective: 'yes', occurredAt: '2026-10-02T00:00:00.000Z', companyId: 'company:acme', interactionId: 'interaction:omitted-outbound' }))
  assert.equal(omitted.status, 'applied')
  assert.equal(loadModel(paths).interactions.find(item => item.id === 'interaction:omitted-outbound').kind, 'outreach')
  assert.equal(loadModel(paths).interactions.find(item => item.id === 'interaction:omitted-outbound').direction, 'outbound')

  const undirected = recordInteraction(paths, env({ channel: 'email', recipient: 'person:pat', objective: 'kind match', record: { id: 'interaction:kind-outreach', kind: 'outreach', evidence_state: 'confirmed', occurred_at: WHEN, company_id: 'company:acme', person_ids: [] } }))
  assert.equal(undirected.status, 'applied')
  const kindRow = loadModel(paths).interactions.find(item => item.id === 'interaction:kind-outreach')
  assert.equal(Object.hasOwn(kindRow, 'direction'), false)
  assert.equal(contactClock(kindRow), 'outbound')
  recordInteraction(paths, env({ channel: 'email', recipient: 'person:pat', objective: 'sent kind', direction: 'inbound', record: { id: 'interaction:kind-sent', kind: 'outreach_sent', evidence_state: 'confirmed', occurred_at: WHEN, company_id: 'company:acme', person_ids: [] } }))
  const sentRow = loadModel(paths).interactions.find(item => item.id === 'interaction:kind-sent')
  assert.equal(sentRow.direction, 'inbound')
  assert.equal(contactClock(sentRow), 'inbound')
  recordInteraction(paths, env({ direction: 'outbound', record: { id: 'interaction:planned-outreach', kind: 'outreach', evidence_state: 'planned', company_id: 'company:acme', person_ids: [] } }))
  assert.equal(contactClock(loadModel(paths).interactions.find(item => item.id === 'interaction:planned-outreach')), 'unknown')

  for (const kind of ['note', 'application_outcome', 'opportunity_decision', 'strategy_gate_decision', 'submission']) {
    const snap = interactions()
    expectCode(() => recordInteraction(paths, env({ direction: 'outbound', record: { id: `interaction:bad-${kind}`, kind, evidence_state: 'confirmed', occurred_at: WHEN, company_id: 'company:acme', person_ids: [] } })), 'INVALID_COMMAND')
    assert.deepEqual(interactions(), snap)
  }
  const submissionSnap = interactions()
  const lifecycle = loadModel(paths).applicationAttempts[0].lifecycle_status
  expectCode(() => recordSubmission(paths, env({ applicationAttemptId: 'application-attempt:acme-lead', channel: 'company_website', occurredOn: '2026-08-29', artifactSelection: { state: 'confirmed_none' }, direction: 'outbound' })), 'INVALID_COMMAND')
  assert.deepEqual(interactions(), submissionSnap)
  assert.equal(loadModel(paths).applicationAttempts[0].lifecycle_status, lifecycle)
  expectCode(() => recordOpportunityDecision(paths, env({ subjectId: 'opportunity:acme-lead', decision: 'pursue', decidedAt: WHEN, reasonCodes: ['fit'], direction: 'inbound' })), 'INVALID_COMMAND')
  expectCode(() => closeApplication(paths, env({ applicationAttemptId: 'application-attempt:acme-lead', lifecycleStatus: 'withdrawn', outcome: 'withdrawn', reason: 'stop', direction: 'outbound' }, { expectedRevision: 0 })), 'INVALID_COMMAND')
  assert.equal(loadModel(paths).applicationAttempts[0].lifecycle_status, lifecycle)
  assert.equal(loadModel(paths).interactions.some(item => item.kind === 'submission'), false)
})

test('historical outreach rows are not rewritten with direction', t => {
  const { paths } = syntheticVault(t, 5)
  const before = fs.readFileSync(path.join(paths.recordsDir, RECORD_FILES.interactions))
  const historical = loadModel(paths).interactions.find(item => item.id === SYNTHETIC.outreachId)
  assert.equal(Object.hasOwn(historical, 'direction'), false)
  assert.equal(contactClock(historical), 'outbound')
  planAction(paths, env({ id: 'action:historical', category: 'external_contact', subjects: [{ type: 'company', id: SYNTHETIC.companyId }], objective: 'Leave history alone', expectedKind: 'outreach' }))
  assert.deepEqual(fs.readFileSync(path.join(paths.recordsDir, RECORD_FILES.interactions)), before)
  assert.equal(Object.hasOwn(loadModel(paths).interactions.find(item => item.id === SYNTHETIC.outreachId), 'direction'), false)
})

test('invalid subjects, dates, categories, attribution, revisions, and upsert are rejected', t => {
  const { paths } = careerFixture(t)
  const actionsFile = path.join(paths.recordsDir, RECORD_FILES.actions)
  const before = fs.readFileSync(actionsFile)
  expectCode(() => planAction(paths, env({ category: 'external_contact', subjects: [{ type: 'company', id: 'company:acme' }, { type: 'company', id: 'company:acme' }], objective: 'Twice', expectedKind: 'outreach' })), 'INVALID_COMMAND')
  expectCode(() => planAction(paths, env({ category: 'external_contact', subjects: [{ type: 'company', id: 'company:missing' }], objective: 'Missing', expectedKind: 'outreach' })), 'NOT_FOUND')
  expectCode(() => planAction(paths, env({ category: 'external_contact', subjects: [], objective: 'Empty', expectedKind: 'outreach' })), 'INVALID_COMMAND')
  expectCode(() => planAction(paths, env({ category: 'external_contact', subjects: [{ type: 'company', id: 'company:acme' }], objective: '   ', expectedKind: 'outreach' })), 'INVALID_COMMAND')
  expectCode(() => planAction(paths, env({ category: 'internal', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'No kind', expectedKind: 'outreach' })), 'INVALID_COMMAND')
  expectCode(() => planAction(paths, env({ category: 'external_contact', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Needs kind' })), 'INVALID_COMMAND')
  expectCode(() => planAction(paths, env({ category: 'external_contact', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Bad date', expectedKind: 'outreach', dueOn: '2026-02-31' })), 'INVALID_COMMAND')
  expectCode(() => planAction(paths, env({ category: 'external_contact', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Bad day', expectedKind: 'outreach', dueOn: '2026-02-29' })), 'INVALID_COMMAND')
  expectCode(() => planAction(paths, env({ id: 'action:snake', category: 'external_contact', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Snake', expected_kind: 'outreach' })), 'INVALID_COMMAND')
  expectCode(() => planAction(paths, env({ id: 'action:rev', category: 'internal', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'No revision' }, { expectedRevision: 0 })), 'INVALID_COMMAND')
  assert.deepEqual(fs.readFileSync(actionsFile), before)

  planAction(paths, env({ id: 'action:dates', category: 'internal', subjects: [{ type: 'opportunity', id: 'opportunity:acme-lead' }], objective: 'Reschedule me' }))
  expectCode(() => rescheduleAction(paths, env({ id: 'action:dates', dueOn: '2026-04-31' }, { expectedRevision: 0 })), 'INVALID_COMMAND')
  expectCode(() => completeAction(paths, env({ id: 'action:dates', completedAt: '2026-02-31T00:00:00.000Z', result: 'no' }, { expectedRevision: 0 })), 'INVALID_COMMAND')
  expectCode(() => updateAction(paths, env({ id: 'action:dates', objective: ' ' }, { expectedRevision: 0 })), 'INVALID_COMMAND')
  expectCode(() => updateAction(paths, env({ id: 'action:dates' }, { expectedRevision: 0 })), 'INVALID_COMMAND')
  expectCode(() => cancelAction(paths, env({ id: 'action:dates', reason: ' ' }, { expectedRevision: 0 })), 'INVALID_COMMAND')
  assert.equal(actionById(paths, 'action:dates').status, 'open')
  assert.equal(actionById(paths, 'action:dates').objective, 'Reschedule me')

  createStrategy(paths, env({ record: { id: 'strategy:drafted', definition_id: 'strategy-definition:cold-apply', objective: 'Learn the channel', status: 'draft' } }))
  createStrategy(paths, env({ record: { id: 'strategy:other', definition_id: 'strategy-definition:cold-apply', objective: 'Another channel', status: 'draft' } }))
  createExperiment(paths, env({ record: { id: 'experiment:drafted', hypothesis: 'A short note gets a reply', strategy_ids: ['strategy:drafted'], cohorts: [{ id: 'cohort:north', name: 'North' }], metrics: ['outreach_response'], status: 'draft' } }))
  const attributed = planAction(paths, env({ id: 'action:attributed', category: 'internal', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Attribute only', strategyIds: ['strategy:drafted'], experimentId: 'experiment:drafted', cohortId: 'cohort:north' }))
  assert.equal(attributed.status, 'applied')
  assert.deepEqual(actionById(paths, 'action:attributed').strategy_ids, ['strategy:drafted'])
  assert.equal(actionById(paths, 'action:attributed').experiment_id, 'experiment:drafted')
  assert.equal(actionById(paths, 'action:attributed').cohort_id, 'cohort:north')
  assert.equal(loadModel(paths).strategies.find(item => item.id === 'strategy:drafted').status, 'draft')
  assert.equal(loadModel(paths).experiments.find(item => item.id === 'experiment:drafted').status, 'draft')
  assert.equal(loadModel(paths).interactions.length, 0)
  expectCode(() => planAction(paths, env({ category: 'internal', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Missing cohort', experimentId: 'experiment:drafted' })), 'INVALID_COMMAND')
  expectCode(() => planAction(paths, env({ category: 'internal', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Missing experiment', cohortId: 'cohort:north' })), 'INVALID_COMMAND')
  expectCode(() => planAction(paths, env({ category: 'internal', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Outside', strategyIds: ['strategy:other'], experimentId: 'experiment:drafted', cohortId: 'cohort:north' })), 'INVALID_COMMAND')
  expectCode(() => planAction(paths, env({ category: 'internal', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Unknown strategy', strategyIds: ['strategy:missing'] })), 'NOT_FOUND')
  planAction(paths, env({ id: 'action:strategy-only', category: 'internal', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Strategy only', strategyIds: ['strategy:other'] }))
  assert.deepEqual(actionById(paths, 'action:strategy-only').strategy_ids, ['strategy:other'])
  assert.equal(actionById(paths, 'action:strategy-only').experiment_id, undefined)

  const update = env({ id: 'action:dates', objective: 'Revised objective' }, { expectedRevision: 0, requestId: 'revise-dates', idempotencyKey: 'revise-dates' })
  const first = updateAction(paths, update)
  assert.equal(first.revision, 1)
  const replay = updateAction(paths, update)
  assert.equal(replay.replayed, true)
  assert.equal(replay.revision, 1)
  assert.equal(actionById(paths, 'action:dates').source_revision, 1)
  assert.equal(actionById(paths, 'action:dates').objective, 'Revised objective')
  const stale = expectCode(() => updateAction(paths, env({ id: 'action:dates', objective: 'Too old' }, { expectedRevision: 0 })), 'STALE_REVISION')
  assert.equal(stale.details.currentRevision, 1)
  assert.equal(actionById(paths, 'action:dates').objective, 'Revised objective')

  const dryBefore = fs.readFileSync(actionsFile)
  const dry = planAction({ ...paths, dryRun: true }, env({ id: 'action:dry', category: 'internal', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Do not write' }))
  assert.equal(dry.status, 'dry_run')
  assert.equal(dry.dryRun, true)
  assert.deepEqual(fs.readFileSync(actionsFile), dryBefore)
  assert.equal(actionsOf(paths).some(item => item.id === 'action:dry'), false)

  expectCode(() => planAction(paths, env({ id: 'action:dates', category: 'internal', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'Duplicate id' })), 'INVALID_COMMAND')
  expectCode(() => upsertEntity(paths, env({ type: 'action', record: { id: 'action:upserted', objective: 'no' } })), 'INVALID_COMMAND')
  assert.equal(actionsOf(paths).some(item => item.id === 'action:upserted'), false)
  expectCode(() => get(paths, 'action:dates'), 'NOT_FOUND')
  expectCode(() => completeAction(paths, env({ id: 'action:dates', completedAt: WHEN, artifactId: 'artifact:missing' }, { expectedRevision: 1 })), 'NOT_FOUND')
  expectCode(() => completeAction(paths, env({ id: 'action:dates', completedAt: WHEN, artifactId: 'artifact:pat-note' }, { expectedRevision: 1 })), 'INVALID_COMMAND')
})

test('validateModel reports a broken action and leaves a valid open action untouched', t => {
  const { paths } = careerFixture(t)
  const brokenModel = loadModel(paths)
  const broken = { id: 'action:broken', status: 'open', category: 'internal', expected_kind: 'outreach', subjects: [{ type: 'company', id: 'company:acme' }, { type: 'company', id: 'company:acme' }], objective: '', due_on: '2026-02-31' }
  brokenModel.actions = [broken]
  const errors = []
  validateActions(brokenModel, errors)
  assert.ok(errors.length > 0)
  assert.equal(broken.status, 'open')
  expectCode(() => validateModel(brokenModel), 'MODEL_INVALID')
  assert.equal(broken.status, 'open')

  const validModel = loadModel(paths)
  const valid = { id: 'action:valid', category: 'external_contact', subjects: [{ type: 'person', id: 'person:pat' }], objective: 'Stay open', expected_kind: 'conversation', status: 'open', actor: 'user', created_at: WHEN, updated_at: WHEN, source_revision: 0, history: [{ command: 'action plan', at: WHEN, source_revision: 0 }] }
  validModel.actions = [valid]
  const validErrors = []
  validateActions(validModel, validErrors)
  assert.deepEqual(validErrors, [])
  assert.equal(validateModel(validModel).valid, true)
  assert.equal(valid.status, 'open')
})

test('action list and action get are lock-free reads', async t => {
  const describedList = commandDescription('action list')
  const describedGet = commandDescription('action get')
  assert.equal(describedList.contract.mode, 'read-only')
  assert.deepEqual(Object.keys(describedList.contract.options).sort(), ['data-root', 'json'])
  assert.equal(describedGet.contract.mode, 'read-only')
  assert.deepEqual(Object.keys(describedGet.contract.options).sort(), ['data-root', 'id', 'json'])
  assert.equal(describedGet.contract.options.id.required, true)
  assert.equal(describedGet.contract.options.status, undefined)
  assert.equal(commandDescription('action plan').contract.examples[0].payload.expectedKind, 'outreach')
  assert.equal(commandDescription('action plan').contract.examples[0].payload.expected_kind, undefined)
  assert.deepEqual(commandDescription('interaction record').contract.payload.properties.direction.enum, ['outbound', 'inbound'])
  assert.deepEqual(commandDescription('outreach record-sent').contract.payload.properties.direction.enum, ['outbound', 'inbound'])
  assert.equal(commandDescription('application-attempt record-submission').contract.payload.properties.direction, undefined)
  assert.match(commandDescription('outreach record-sent').contract.invariants.join('\n'), /direction outbound/)
  assert.match(commandDescription('application-attempt record-submission').contract.invariants.join('\n'), /does not set direction/)
  assert.equal(routeNames().includes('init'), false)
  assert.equal(routeNames().includes('model init'), false)
  assert.ok(routeNames().includes('action list'))
  assert.ok(routeNames().includes('action get'))

  const { root, paths } = careerFixture(t)
  planAction(paths, env({ id: 'action:first', category: 'internal', subjects: [{ type: 'company', id: 'company:acme' }], objective: 'First' }))
  planAction(paths, env({ id: 'action:second', category: 'internal', subjects: [{ type: 'person', id: 'person:pat' }], objective: 'Second' }))
  const listed = listActions(paths)
  assert.equal(listed.schemaVersion, 1)
  assert.equal(listed.status, 'ok')
  assert.deepEqual(listed.actions.map(item => item.id), ['action:first', 'action:second'])
  const got = getAction(paths, 'action:second')
  assert.equal(got.schemaVersion, 1)
  assert.equal(got.status, 'ok')
  assert.equal(got.action.id, 'action:second')
  expectCode(() => getAction(paths, 'action:missing'), 'NOT_FOUND')
  expectCode(() => getAction(paths, ''), 'USAGE')

  const lockBody = holdLock(paths)
  assert.equal(listActions(paths).actions.length, 2)
  assert.equal(getAction(paths, 'action:first').action.objective, 'First')
  assert.equal(fs.readFileSync(paths.lockPath, 'utf8'), lockBody)
  fs.rmSync(paths.lockPath)

  let output = ''
  let error = ''
  const io = { out: { write: value => { output += value } }, err: { write: value => { error += value } }, cwd: root, env: process.env }
  output = ''
  assert.equal(await main(['action', 'list', '--data-root', root, '--json'], io), 0)
  assert.deepEqual(JSON.parse(output).actions.map(item => item.id), ['action:first', 'action:second'])
  output = ''
  assert.equal(await main(['action', 'get', '--data-root', root, '--id', 'action:first', '--json'], io), 0)
  assert.equal(JSON.parse(output).action.objective, 'First')
  error = ''
  assert.equal(await main(['action', 'get', '--data-root', root, '--json'], io), 64)
  assert.equal(JSON.parse(error).error.code, 'USAGE')
  error = ''
  assert.equal(await main(['action', 'list', '--data-root', root, '--status', 'open', '--json'], io), 64)
  assert.equal(JSON.parse(error).error.code, 'USAGE')
  output = ''
  assert.equal(await main(['--help'], io), 0)
  assert.match(output, /action list/)
  assert.match(output, /action get --id <action:id>/)
  assert.match(output, /action plan\|wait\|unwait\|update\|reschedule\|complete\|cancel --input -/)

  const product = path.resolve(import.meta.dirname, '..')
  error = ''
  assert.equal(await main(['action', 'list', '--json'], { ...io, cwd: product }), 1)
  assert.equal(JSON.parse(error).error.code, 'PRODUCT_TREE_NOT_DATA')

  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-actions-empty-'))
  t.after(() => fs.rmSync(empty, { recursive: true, force: true }))
  const emptyPaths = resolvePaths({ cwd: empty })
  assert.deepEqual(listActions(emptyPaths), { schemaVersion: 1, status: 'ok', actions: [] })
  expectCode(() => getAction(emptyPaths, 'action:missing'), 'NOT_FOUND')
  assert.equal(fs.readdirSync(empty).length, 0)
  output = ''
  error = ''
  assert.equal(await main(['action', 'list', '--json'], { ...io, cwd: empty }), 0)
  assert.deepEqual(JSON.parse(output).actions, [])
  assert.equal(await main(['action', 'get', '--id', 'action:missing', '--json'], { ...io, cwd: empty }), 1)
  assert.equal(JSON.parse(error).error.code, 'NOT_FOUND')
  assert.equal(fs.existsSync(path.join(empty, 'Candidatures')), false)
  assert.equal(fs.existsSync(path.join(empty, '.nextstep')), false)
})

test('v4 list and get reject upgrade and write nothing, including beside a ledger and journal', async t => {
  const { root, paths } = syntheticVault(t, 4)
  const before = freeze(root)
  const manifest = JSON.parse(fs.readFileSync(path.join(paths.recordsDir, 'manifest.json'), 'utf8'))
  assert.equal(fs.existsSync(paths.stateRoot), false)
  const listError = expectCode(() => listActions(paths), 'VAULT_UPGRADE_REQUIRED')
  assert.equal(listError.message, UPGRADE_MESSAGE)
  assert.deepEqual(listError.details, UPGRADE_DETAILS)
  assert.notEqual(listError.replayed, true)
  const getError = expectCode(() => getAction(paths, 'action:missing'), 'VAULT_UPGRADE_REQUIRED')
  assert.deepEqual(getError.details, UPGRADE_DETAILS)
  expectCode(() => planAction({ ...paths, dryRun: true }, env({ category: 'internal', subjects: [{ type: 'company', id: SYNTHETIC.companyId }], objective: 'No dry-run write' })), 'VAULT_UPGRADE_REQUIRED')
  expectCode(() => planAction(paths, env({ category: 'internal', subjects: [{ type: 'company', id: SYNTHETIC.companyId }], objective: 'No write' })), 'VAULT_UPGRADE_REQUIRED')
  assert.deepEqual(freeze(root), before)
  assert.equal(fs.existsSync(path.join(paths.recordsDir, RECORD_FILES.actions)), false)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(fs.existsSync(paths.lockPath), false)
  const afterManifest = JSON.parse(fs.readFileSync(path.join(paths.recordsDir, 'manifest.json'), 'utf8'))
  assert.deepEqual(afterManifest.counts, manifest.counts)
  assert.equal(Object.hasOwn(afterManifest.counts, 'actions'), false)

  const planted = plantJournal(paths)
  fs.mkdirSync(path.dirname(paths.ledgerPath), { recursive: true })
  const ledger = json({ schemaVersion: 1, entries: { 'action-key': { digest: 'abc', result: { schemaVersion: 1, status: 'ok', actions: [{ id: 'action:replayed' }] } } } })
  fs.writeFileSync(paths.ledgerPath, ledger)
  const withJournal = freeze(root, [planted.journalFile])
  expectCode(() => listActions(paths), 'VAULT_UPGRADE_REQUIRED')
  expectCode(() => getAction(paths, SYNTHETIC.companyId), 'VAULT_UPGRADE_REQUIRED')
  assert.deepEqual(freeze(root, [planted.journalFile]), withJournal)
  assert.equal(fs.readFileSync(planted.journalFile, 'utf8'), planted.body)
  assert.deepEqual(fs.readFileSync(planted.companies), planted.original)
  assert.deepEqual(fs.readFileSync(paths.ledgerPath), Buffer.from(ledger))
  assert.equal(fs.existsSync(path.join(paths.recordsDir, RECORD_FILES.actions)), false)

  const removed = syntheticVault(t, 5)
  fs.rmSync(path.join(removed.paths.recordsDir, RECORD_FILES.actions))
  const missing = expectCode(() => listActions(removed.paths), 'MODEL_INVALID')
  assert.equal(missing.details.reason, 'actions_missing')
  expectCode(() => getAction(removed.paths, 'action:any'), 'MODEL_INVALID')
  assert.equal(fs.existsSync(path.join(removed.paths.recordsDir, RECORD_FILES.actions)), false)

  let error = ''
  assert.equal(await main(['action', 'list', '--data-root', root, '--json'], { out: { write() {} }, err: { write: value => { error += value } }, cwd: root, env: process.env }), 1)
  const body = JSON.parse(error)
  assert.equal(body.error.code, 'VAULT_UPGRADE_REQUIRED')
  assert.equal(body.error.message, UPGRADE_MESSAGE)
  assert.deepEqual(body.error.details, UPGRADE_DETAILS)
})

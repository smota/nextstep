import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fixture } from './fixtures/career-vault.mjs'
import { applicationArtifact } from './fixtures/application-artifact.mjs'
import { loadModel, validateModel } from '../src/model.mjs'
import { adoptArtifact, createStrategy, pipelineStatus, recordSubmission, reconcileSubmission, submissionPlan } from '../src/commands.mjs'

const envelope = (id, payload, extra = {}) => ({ schemaVersion: 1, requestId: id, idempotencyKey: id, payload, ...extra })
const submission = extra => ({ applicationAttemptId: 'application-attempt:acme-lead', timeUnknown: true, channelUnknown: true, artifactSelection: { state: 'unknown' }, ...extra })
const event = paths => loadModel(paths).interactions.find(i => i.kind === 'submission')

test('unknown report records exactly once; later evidence preserves the original report and time precision', t => {
  const { paths } = fixture(t), raw = envelope('submit', submission())
  assert.equal(recordSubmission({ ...paths, dryRun: true }, raw).status, 'dry_run')
  assert.equal(loadModel(paths).interactions.length, 0)
  const recorded = recordSubmission(paths, raw)
  assert.equal(recorded.unresolvedEvidence.length, 3)
  assert.equal(recordSubmission(paths, raw).replayed, true)
  const first = event(paths)
  assert.equal(first.occurred_at, null); assert.equal(first.temporal_precision, 'unknown')
  assert.equal(pipelineStatus(paths).submissions.undatedConfirmed, 1)
  assert.equal(pipelineStatus(paths).subjects.find(s => s.type === 'applicationAttempt').daysSinceLastConfirmed, null)
  assert.throws(() => recordSubmission(paths, envelope('duplicate', submission())), e => e.code === 'INTERACTION_CONFLICT')
  reconcileSubmission(paths, envelope('resolve', { submissionId: first.id, occurredOn: '2026-09-29', channel: 'company_website', artifactSelection: { state: 'confirmed_none' }, evidenceSource: 'user follow-up' }, { expectedRevision: 0 }))
  const updated = event(paths)
  assert.deepEqual(updated.submission_bundle.original_report, first.submission_bundle.original_report)
  assert.equal(updated.id, first.id); assert.equal(updated.temporal_precision, 'date')
  assert.deepEqual(pipelineStatus(paths).submissions, { confirmed: 1, undatedConfirmed: 0 })
  assert.throws(() => reconcileSubmission(paths, envelope('overwrite', { submissionId: first.id, occurredOn: '2026-09-28' }, { expectedRevision: 1 })), e => e.code === 'INVALID_TRANSITION')
})
test('real dates, exclusive unknown declarations and date-time zones are validated', t => {
  const { paths } = fixture(t)
  for (const input of [{ occurredOn: '2026-09-29' }, { timeUnknown: false }, { timeUnknown: false, occurredOn: '2026-02-30' }, { timeUnknown: false, occurredAt: '2026-09-29T12:00:00' }, { channel: 'web' }]) assert.throws(() => recordSubmission(paths, envelope('invalid', submission(input))), e => e.code === 'INVALID_COMMAND')
  recordSubmission(paths, envelope('valid', submission({ timeUnknown: false, occurredAt: '2026-09-29T12:30:00+02:00' })))
  assert.equal(event(paths).occurred_at, '2026-09-29T12:30:00+02:00')
})
test('reconciliation selects exact historical bytes after a working-file revision', t => {
  const { paths } = fixture(t), file = applicationArtifact(paths)
  const original = loadModel(paths).artifacts.find(a => a.id === 'artifact:cv')
  recordSubmission(paths, envelope('submit', submission()))
  fs.writeFileSync(file, '# Candidate\n\nRevised after transmission.\n')
  adoptArtifact(paths, envelope('adopt', { artifactId: 'artifact:cv', authorship: 'user' }))
  const id = event(paths).id
  assert.throws(() => reconcileSubmission(paths, envelope('guess', { submissionId: id, artifactSelection: { state: 'confirmed', artifactIds: ['artifact:cv'] } }, { expectedRevision: 0 })), e => e.code === 'INVALID_ARTIFACT_SELECTION')
  reconcileSubmission(paths, envelope('exact', { submissionId: id, artifactSelection: { state: 'confirmed', revisions: [{ artifactId: 'artifact:cv', sha256: original.sha256 }] } }, { expectedRevision: 0 }))
  const item = event(paths).submission_bundle.items[0]
  assert.equal(item.sha256, original.sha256)
  assert.match(fs.readFileSync(path.join(paths.candidaturesDir, item.snapshot_path), 'utf8'), /Original evidence/)
  assert.notEqual(loadModel(paths).artifacts.find(a => a.id === 'artifact:cv').sha256, item.sha256)
})
test('retrospective reporting preserves gate deviations without changing pre-action readiness', t => {
  const { paths } = fixture(t)
  createStrategy(paths, envelope('strategy', { record: { id: 'strategy:gate', definition_id: 'strategy-definition:cold-apply', objective: 'Synthetic gate', status: 'active', scope: { subject_ids: ['application-attempt:acme-lead'] } } }))
  assert.throws(() => recordSubmission(paths, envelope('blocked', submission())), e => e.code === 'STRATEGY_REQUIREMENT_UNMET')
  recordSubmission(paths, envelope('reported', submission({ reportMode: 'retrospective', evidenceSource: 'applicant confirmed the earlier event' })))
  assert.equal(event(paths).submission_bundle.gate_deviations.length, 1)
  assert.equal(submissionPlan(paths, 'application-attempt:acme-lead').gates[0].blocked, true)
})
test('failed commit restores records and audit; corrupt evidence fails model validation', t => {
  const { paths } = fixture(t)
  const before = JSON.stringify(loadModel(paths)), rename = fs.renameSync
  let injected = false
  t.mock.method(fs, 'renameSync', (from, to) => {
    if (!injected && to === path.join(paths.recordsDir, 'interactions.json')) { injected = true; throw new Error('synthetic write failure') }
    return rename(from, to)
  })
  assert.throws(() => recordSubmission(paths, envelope('fail', submission())), /synthetic write failure/)
  assert.equal(JSON.stringify(loadModel(paths)), before); assert.equal(fs.existsSync(paths.auditPath), false)
  recordSubmission(paths, envelope('success', submission()))
  const model = loadModel(paths); model.interactions[0].occurred_at = '2026-09-29'
  assert.throws(() => validateModel(model), e => e.code === 'MODEL_INVALID')
})

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fixture } from './fixtures/career-vault.mjs'
import { guidance, recordGuidance } from '../src/guidance-commands.mjs'
import { loadModel } from '../src/model.mjs'
const source = { kind: 'user', reference: 'synthetic-confirmation' }
function input(scope = 'opportunity:acme-lead') { return { schemaVersion: 1, requestId: 'brief1', idempotencyKey: 'brief1', payload: { artifactId: 'artifact:brief', brief: { schemaVersion: 1, scope, answers: [{ id: 'pref1', criterion: 'presentation', scope, kind: 'preference', state: 'answered', value: 'domain table', source }] } } } }

test('explicit brief survives restart, preserves snapshots, and suppresses known questions', t => {
  const { paths } = fixture(t), raw = input()
  const first = recordGuidance(paths, raw)
  assert.equal(first.revision, 1); assert.equal(recordGuidance(paths, raw).replayed, true)
  const artifact = loadModel(paths).artifacts.find(a => a.id === 'artifact:brief')
  const brief = JSON.parse(fs.readFileSync(path.join(paths.candidaturesDir, artifact.path)))
  for (let i = 0; i < 3; i++) assert.equal(guidance(paths, { schemaVersion: 1, operation: 'draft', subject: raw.payload.brief.scope, observations: [{ criterion: 'presentation', state: 'unknown', source }] }).questions.length, 0)
  const update = { ...raw, requestId: 'brief2', idempotencyKey: 'brief2', expectedRevision: 1, payload: { ...raw.payload, brief: { ...brief, answers: [...brief.answers, { ...brief.answers[0], id: 'pref2', value: 'plain list', supersedes: 'pref1' }] } } }
  assert.equal(recordGuidance(paths, update).revision, 2)
  assert.throws(() => recordGuidance(paths, { ...update, requestId: 'stale', idempotencyKey: 'stale' }), e => e.code === 'STALE_REVISION')
  assert.equal(JSON.parse(fs.readFileSync(path.join(paths.candidaturesDir, artifact.revisions[0].snapshot_path))).answers[0].value, 'domain table')
})
test('dry-run writes no brief or audit; invalid scope and user drift fail safely', t => {
  const { paths } = fixture(t)
  assert.equal(recordGuidance({ ...paths, dryRun: true }, input()).status, 'dry_run')
  assert.equal(fs.existsSync(paths.auditPath), false)
  assert.equal(loadModel(paths).artifacts.length, 1)
  assert.throws(() => recordGuidance(paths, input('opportunity:missing')), e => e.code === 'NOT_FOUND')
  recordGuidance(paths, input())
  const artifact = loadModel(paths).artifacts.find(a => a.kind === 'guidance_brief')
  fs.appendFileSync(path.join(paths.candidaturesDir, artifact.path), ' ')
  assert.throws(() => guidance(paths, { schemaVersion: 1, operation: 'draft', subject: 'opportunity:acme-lead' }), e => e.code === 'STALE_ARTIFACT')
})
test('unrelated scopes do not leak and shared briefs require explicit inclusion', t => {
  const { paths } = fixture(t)
  recordGuidance(paths, input())
  assert.equal(guidance(paths, { schemaVersion: 1, operation: 'draft', subject: 'person:pat' }).effectiveAnswers.length, 0)
  assert.throws(() => guidance(paths, { schemaVersion: 1, operation: 'draft', subject: 'person:pat', briefIds: ['artifact:brief'] }), e => e.code === 'INVALID_COMMAND')
})

test('brief storage restores all preimages on a mid-commit failure', t => {
  const { paths } = fixture(t), before = JSON.stringify(loadModel(paths)), rename = fs.renameSync
  let injected = false
  t.mock.method(fs, 'renameSync', (from, to) => {
    if (!injected && to === path.join(paths.artifactsDir, 'guidance', 'brief.json')) { injected = true; throw new Error('synthetic brief failure') }
    return rename(from, to)
  })
  assert.throws(() => recordGuidance(paths, input()), /synthetic brief failure/)
  assert.equal(JSON.stringify(loadModel(paths)), before)
  assert.equal(fs.existsSync(paths.auditPath), false)
  assert.equal(fs.existsSync(path.join(paths.artifactsDir, 'guidance', 'brief.json')), false)
})

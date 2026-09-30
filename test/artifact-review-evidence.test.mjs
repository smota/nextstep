import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fixture } from './fixtures/career-vault.mjs'
import { applicationArtifact } from './fixtures/application-artifact.mjs'
import { loadModel, validateModel } from '../src/model.mjs'
import { recordArtifactReview, submissionPlan } from '../src/commands.mjs'
import { recordGuidance } from '../src/guidance-commands.mjs'

const finding = id => ({ id, status: 'passed', rationale: `Supported ${id} in the selected source.`, evidence: ['artifact:cv#opening'] })
function review(extra = {}) { return { schemaVersion: 2, templateId: 'workflow-template:applicant-review', status: 'passed', criteria: ['contribution', 'claim_grounding', 'channel_fit', 'preferences', 'uncertainty'].map(finding), lenses: ['candidate', 'reader'].map(finding), ...extra } }
const command = data => ({ schemaVersion: 1, requestId: 'review', idempotencyKey: 'review', payload: { artifactId: 'artifact:cv', review: data } })

test('detailed review requires grounded criteria and keeps distinct lenses', t => {
  const { paths } = fixture(t); applicationArtifact(paths)
  assert.throws(() => recordArtifactReview(paths, command({ schemaVersion: 1, templateId: 'workflow-template:applicant-review', status: 'passed' })), e => e.code === 'INVALID_COMMAND')
  assert.throws(() => recordArtifactReview(paths, command(review({ criteria: [finding('contribution')] }))), e => e.code === 'INVALID_COMMAND')
  const unsupported = review(); unsupported.criteria[0].evidence = []
  assert.throws(() => recordArtifactReview(paths, command(unsupported)), e => e.code === 'INVALID_COMMAND')
  const flagged = review(); flagged.criteria[0].status = 'flagged'
  assert.throws(() => recordArtifactReview(paths, command(flagged)), e => e.code === 'INVALID_COMMAND')
  recordArtifactReview(paths, command(review()))
  const stored = loadModel(paths).artifacts.find(a => a.id === 'artifact:cv').reviews['workflow-template:applicant-review']
  assert.deepEqual(stored.lenses.map(l => l.id), ['candidate', 'reader'])
  assert.equal(submissionPlan(paths, 'application-attempt:acme-lead').artifacts.find(a => a.id === 'artifact:cv').reviewStatus['workflow-template:applicant-review'], 'passed')
})
test('relevant brief drift invalidates review; unrelated record changes do not', t => {
  const { paths } = fixture(t); applicationArtifact(paths)
  recordGuidance(paths, { schemaVersion: 1, requestId: 'brief', idempotencyKey: 'brief', payload: { artifactId: 'artifact:review-brief', brief: { schemaVersion: 1, scope: 'opportunity:acme-lead', answers: [] } } })
  const brief = loadModel(paths).artifacts.find(a => a.id === 'artifact:review-brief')
  recordArtifactReview(paths, command(review({ dependencies: [{ artifactId: brief.id, sha256: brief.sha256 }] })))
  fs.appendFileSync(path.join(paths.artifactsDir, 'people', 'pat.md'), 'unrelated edit')
  const state = () => submissionPlan(paths, 'application-attempt:acme-lead').artifacts.find(a => a.id === 'artifact:cv').reviewStatus['workflow-template:applicant-review']
  assert.equal(state(), 'passed')
  fs.appendFileSync(path.join(paths.candidaturesDir, brief.path), ' ')
  assert.equal(state(), 'stale')
})
test('detailed model validation rejects tampered findings and dry-run writes no review', t => {
  const { paths } = fixture(t); applicationArtifact(paths)
  recordArtifactReview({ ...paths, dryRun: true }, command(review()))
  assert.equal(loadModel(paths).artifacts.find(a => a.id === 'artifact:cv').reviews, undefined)
  recordArtifactReview(paths, command(review()))
  const model = loadModel(paths), stored = model.artifacts.find(a => a.id === 'artifact:cv').reviews['workflow-template:applicant-review']
  stored.criteria[0].evidence = []
  assert.throws(() => validateModel(model), e => e.code === 'MODEL_INVALID')
})

test('review advisory degrades for removed templates and pending working-file revisions', t => {
  const { paths } = fixture(t), file = applicationArtifact(paths)
  recordArtifactReview(paths, command(review()))
  fs.appendFileSync(file, '\nUser revision')
  assert.equal(submissionPlan(paths, 'application-attempt:acme-lead').artifacts.find(a => a.id === 'artifact:cv').reviewStatus['workflow-template:applicant-review'], 'stale')
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('\nUser revision', ''))
  const model = loadModel(paths), artifact = model.artifacts.find(a => a.id === 'artifact:cv')
  artifact.document.contract.templates = ['workflow-template:removed']
  artifact.reviews = { 'workflow-template:removed': { schema_version: 1, template_id: 'workflow-template:removed', status: 'passed', artifact_sha256: artifact.sha256, recorded_at: new Date().toISOString() } }
  fs.writeFileSync(path.join(paths.recordsDir, 'artifacts.json'), JSON.stringify(model.artifacts))
  assert.equal(submissionPlan(paths, 'application-attempt:acme-lead').artifacts.find(a => a.id === 'artifact:cv').reviewStatus['workflow-template:removed'], 'unknown_template')
})

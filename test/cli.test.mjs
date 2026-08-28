import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { capabilities, recordInteraction, recordSubmission, adoptArtifact, artifactStatus, buildContext } from '../src/commands.mjs'
import { resolvePaths } from '../src/config.mjs'
import { main } from '../src/cli.mjs'
import { loadModel, validateModel } from '../src/model.mjs'

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-cli-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'Master'))
  fs.mkdirSync(path.join(root, 'Candidatures', 'records'), { recursive: true })
  fs.mkdirSync(path.join(root, 'Candidatures', 'artifacts', 'people'), { recursive: true })
  const model = {
    companies: [{ id: 'company:acme', name: 'Acme', vacancy_ids: ['vacancy:acme-lead'], person_ids: ['person:pat'] }],
    vacancies: [{ id: 'vacancy:acme-lead', company_id: 'company:acme', title: 'Lead', vacancy_state: 'open', application_ids: ['application:acme-lead'] }],
    applications: [{ id: 'application:acme-lead', vacancy_id: 'vacancy:acme-lead', lifecycle_status: 'identified', outcome: null, storage_scope: 'active', record_state: 'complete', people_relations: [], interaction_ids: [], artifact_ids: [], source_revision: 0 }],
    people: [{ id: 'person:pat', name: 'Pat', company_id: 'company:acme', application_ids: [], vacancy_ids: [], profile_artifact_ids: ['artifact:pat-note'] }],
    interactions: [],
    artifacts: [{ id: 'artifact:pat-note', kind: 'outreach_message', owner_type: 'person', owner_id: 'person:pat', path: 'artifacts/people/pat.md', sha256: '', size_bytes: 0, media_type: 'text/markdown', document: { role: 'outreach_message', representation: 'canonical_markdown', state: 'draft', version: 1, primary: true } }]
  }
  const file = path.join(root, 'Candidatures', 'artifacts', 'people', 'pat.md')
  fs.writeFileSync(file, 'hello\n')
  model.artifacts[0].sha256 = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); model.artifacts[0].size_bytes = 6
  for (const [name, value] of Object.entries(model)) fs.writeFileSync(path.join(root, 'Candidatures', 'records', `${name}.json`), `${JSON.stringify(value, null, 2)}\n`)
  fs.writeFileSync(path.join(root, 'Candidatures', 'records', 'manifest.json'), `${JSON.stringify({ schema_version: 1, counts: Object.fromEntries(Object.entries(model).map(([k, v]) => [k, v.length])) }, null, 2)}\n`)
  return { root, paths: resolvePaths({ dataRoot: root }), file }
}

test('capabilities expose a CLI without API or embedded agent runtime', () => {
  const value = capabilities()
  assert.equal(value.interface, 'local-cli')
  assert.equal(value.agentRuntime, 'external')
  assert.equal(JSON.stringify(value).includes('api'), false)
})

test('CLI rejects ambiguous commands and misspelled options', async () => {
  let output = ''
  const io = { out: { write: value => { output += value } }, err: { write: value => { output += value } } }
  assert.equal(await main(['capabilities', 'extra'], io), 64)
  assert.match(output, /Unknown Nextstep command/)
  output = ''
  assert.equal(await main(['capabilities', '--formt', 'json'], io), 64)
  assert.match(output, /Unsupported option/)
})

test('state root cannot escape through a directory junction', t => {
  const { root } = fixture(t), outside = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-outside-')), state = path.join(root, '.nextstep')
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }))
  try { fs.symlinkSync(outside, state, 'junction') } catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) return; throw error }
  assert.throws(() => resolvePaths({ dataRoot: root }), error => error.code === 'INVALID_STATE_ROOT')
  fs.unlinkSync(state)
})

test('outreach can be recorded for a person without an Application', t => {
  const { paths } = fixture(t)
  const command = { schemaVersion: 1, requestId: 'outreach-1', idempotencyKey: 'outreach-1', actor: 'test-agent', payload: { channel: 'LinkedIn', recipient: 'person:pat', objective: 'request a conversation', messageArtifactId: 'artifact:pat-note', record: { id: 'interaction:pat:coffee', person_ids: ['person:pat'], artifact_ids: [], kind: 'outreach', evidence_state: 'confirmed', occurred_at: '2026-08-28T10:00:00.000Z' } } }
  const result = recordInteraction(paths, command)
  assert.equal(result.status, 'applied')
  const interaction = JSON.parse(fs.readFileSync(path.join(paths.recordsDir, 'interactions.json')))[0]
  assert.equal(interaction.application_id, undefined)
  assert.equal(interaction.outreach.objective, 'request a conversation')
  assert.ok(interaction.transmission.snapshot_path)
  assert.equal(recordInteraction(paths, command).replayed, true)
})

test('a direct user edit becomes a tracked user revision', t => {
  const { paths, file } = fixture(t)
  fs.writeFileSync(file, 'fine tuned by user\n')
  assert.equal(artifactStatus(paths, { artifactId: 'artifact:pat-note' }).artifacts[0].state, 'user_revision_pending')
  const result = adoptArtifact(paths, { schemaVersion: 1, requestId: 'adopt-1', idempotencyKey: 'adopt-1', actor: 'samuel', payload: { artifactId: 'artifact:pat-note', authorship: 'user' } })
  assert.equal(result.status, 'applied')
  assert.equal(artifactStatus(paths, { artifactId: 'artifact:pat-note' }).artifacts[0].state, 'clean')
  const replay = adoptArtifact(paths, { schemaVersion: 1, requestId: 'adopt-1', idempotencyKey: 'adopt-1', actor: 'samuel', payload: { artifactId: 'artifact:pat-note', authorship: 'user' } })
  assert.equal(replay.status, 'applied')
  assert.equal(replay.replayed, true)
})

test('shared artifact adoption reports only typed changed entities', t => {
  const { paths, file } = fixture(t), artifactsFile = path.join(paths.recordsDir, 'artifacts.json')
  const artifacts = JSON.parse(fs.readFileSync(artifactsFile, 'utf8'))
  artifacts[0].owner_type = 'shared'; delete artifacts[0].owner_id
  fs.writeFileSync(artifactsFile, `${JSON.stringify(artifacts, null, 2)}\n`)
  fs.writeFileSync(file, 'shared governance revision\n')
  const result = adoptArtifact(paths, { schemaVersion: 1, requestId: 'adopt-shared', idempotencyKey: 'adopt-shared', payload: { artifactId: 'artifact:pat-note', authorship: 'mixed' } })
  assert.deepEqual(result.changedEntities, ['artifact:pat-note'])
})

test('read-only status does not create runtime state', t => {
  const { paths } = fixture(t)
  artifactStatus(paths, { artifactId: 'artifact:pat-note' })
  assert.equal(fs.existsSync(paths.stateRoot), false)
})

test('standard context is bounded and does not require a workflow stage', t => {
  const { paths, root } = fixture(t)
  const config = path.join(root, 'Candidatures', 'config')
  fs.mkdirSync(config, { recursive: true })
  fs.writeFileSync(path.join(config, 'executive-search-strategy.yaml'), 'strategy: focused\n'.repeat(1000))
  const result = buildContext(paths, { intent: 'outreach', subject: 'person:pat', budget: 'standard' })
  assert.ok(result.packet.strategy.content.length <= 2500)
  assert.equal(result.packet.strategy.truncated, true)
  assert.ok(result.packet.subject.documents.every(document => document.content.length <= 2200))
})

test('a short conflicting commit fails immediately instead of blocking a thread', t => {
  const { paths } = fixture(t)
  fs.mkdirSync(path.dirname(paths.lockPath), { recursive: true })
  fs.writeFileSync(paths.lockPath, JSON.stringify({ schemaVersion: 1, requestId: 'other', pid: 1, acquiredAt: new Date().toISOString() }))
  assert.throws(() => recordInteraction(paths, { schemaVersion: 1, requestId: 'outreach-busy', idempotencyKey: 'outreach-busy', payload: { record: { id: 'interaction:pat:busy', person_ids: ['person:pat'], artifact_ids: [], kind: 'outreach', evidence_state: 'planned' } } }), error => error.code === 'COMMIT_BUSY')
})

test('submission freezes exact transmitted bytes without visual rendering', t => {
  const { paths, root } = fixture(t), file = path.join(root, 'Candidatures', 'artifacts', 'applications', 'acme-lead', 'cv.docx')
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('[Content_Types].xml word/document.xml'), Buffer.from([0x50, 0x4b, 0x05, 0x06])]))
  const data = fs.readFileSync(file), hash = crypto.createHash('sha256').update(data).digest('hex'), artifactsFile = path.join(paths.recordsDir, 'artifacts.json')
  const artifacts = JSON.parse(fs.readFileSync(artifactsFile)); artifacts.push({ id: 'artifact:acme-cv-docx', kind: 'cv', owner_type: 'application', owner_id: 'application:acme-lead', path: 'artifacts/applications/acme-lead/cv.docx', sha256: hash, size_bytes: data.length, media_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', document: { role: 'cv', representation: 'user_edited_docx', state: 'final', version: 1, primary: true }, authorship: 'user' }); fs.writeFileSync(artifactsFile, `${JSON.stringify(artifacts, null, 2)}\n`)
  const result = recordSubmission(paths, { schemaVersion: 1, requestId: 'submit-1', idempotencyKey: 'submit-1', actor: 'samuel', expectedRevision: 0, payload: { applicationId: 'application:acme-lead', channel: 'company_website', occurredAt: '2026-08-28T12:00:00.000Z', artifactIds: ['artifact:acme-cv-docx'] } })
  assert.equal(result.status, 'applied')
  const interaction = JSON.parse(fs.readFileSync(path.join(paths.recordsDir, 'interactions.json'))).find(x => x.kind === 'submission')
  assert.ok(interaction.submission_bundle.items[0].snapshot_path)
  const snapshot = path.join(paths.candidaturesDir, interaction.submission_bundle.items[0].snapshot_path)
  assert.deepEqual(fs.readFileSync(snapshot), data)
  fs.writeFileSync(snapshot, Buffer.from('corrupted'))
  assert.throws(() => validateModel(loadModel(paths), { paths }), error => error.code === 'MODEL_INVALID' && error.details.errors.some(message => message.includes('invalid submission snapshot')))
})

import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { candidateProfileShow, candidateProfileUpsert, capabilities, checkArtifactContract, closeApplication, commandDescription, createExperiment, createStrategy, doctor, evaluateExperiment, evaluateStrategy, getStrategyDefinition, pipelineStatus, readiness, reconcileSubmission, recordArtifactQuality, recordArtifactReview, recordInteraction, recordOpportunityDecision, recordOutreachSent, recordRunManifest, recordSubmission, registerApplicationPackage, adoptArtifact, artifactStatus, buildContext, runList, setExperimentStatus, setStrategyStatus, strategyGuide, submissionPlan, upsertEntity, workflowTemplate, workflowTemplates } from '../src/commands.mjs'
import { resolvePaths } from '../src/config.mjs'
import { main, routeNames } from '../src/cli.mjs'
import { holoselfEnv } from '../src/holoself.mjs'
import { loadModel, rebuildBacklinks, RECORD_FILES, validateModel, validateScope } from '../src/model.mjs'
import { renderIndexes } from '../src/storage.mjs'

function fixtureRoot(t) { return fixture(t).root }

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-cli-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'Master'))
  fs.mkdirSync(path.join(root, 'Candidatures', 'records'), { recursive: true })
  fs.mkdirSync(path.join(root, 'Candidatures', 'artifacts', 'people'), { recursive: true })
  const model = {
    companies: [{ id: 'company:acme', name: 'Acme' }],
    opportunities: [{ id: 'opportunity:acme-lead', company_id: 'company:acme', title: 'Lead', posting_state: 'open', pursuit_status: 'preparing', people_relations: [], source_revision: 0 }],
    applicationAttempts: [{ id: 'application-attempt:acme-lead', opportunity_id: 'opportunity:acme-lead', lifecycle_status: 'preparing', outcome: null, storage_scope: 'active', record_state: 'complete', people_relations: [], source_revision: 0 }],
    people: [{ id: 'person:pat', name: 'Pat', company_id: 'company:acme' }],
    interactions: [],
    artifacts: [{ id: 'artifact:pat-note', kind: 'outreach_message', owner_type: 'person', owner_id: 'person:pat', path: 'artifacts/people/pat.md', sha256: '', size_bytes: 0, media_type: 'text/markdown', document: { role: 'outreach_message', representation: 'canonical_markdown', state: 'draft', version: 1, primary: true } }],
    strategies: [],
    experiments: []
  }
  const file = path.join(root, 'Candidatures', 'artifacts', 'people', 'pat.md')
  fs.writeFileSync(file, 'hello\n')
  model.artifacts[0].sha256 = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); model.artifacts[0].size_bytes = 6
  rebuildBacklinks(model)
  for (const [name, value] of Object.entries(model)) fs.writeFileSync(path.join(root, 'Candidatures', 'records', RECORD_FILES[name]), `${JSON.stringify(value, null, 2)}\n`)
  fs.writeFileSync(path.join(root, 'Candidatures', 'records', 'manifest.json'), `${JSON.stringify({ schema_version: 4, model: 'nextstep-opportunity-graph', counts: Object.fromEntries(Object.entries(model).map(([k, v]) => [k, v.length])) }, null, 2)}\n`)
  return { root, paths: resolvePaths({ dataRoot: root }), file }
}

test('capabilities expose a CLI without API or embedded agent runtime', () => {
  const value = capabilities()
  assert.equal(value.version, '2.1.0')
  assert.equal(value.interface, 'local-cli')
  assert.equal(value.agentRuntime, 'external')
  assert.equal(JSON.stringify(value).includes('api'), false)
  assert.equal(value.strategyDefinitions.length, 8)
  assert.ok(value.commands.includes('strategy guide'))
  assert.ok(value.commands.includes('readiness'))
  assert.ok(value.commands.includes('application-attempt register-package'))
})

test('every advertised command has a machine-readable contract', () => {
  assert.deepEqual([...capabilities().commands].sort(), routeNames().sort())
  for (const command of capabilities().commands) {
    const value = commandDescription(command)
    assert.equal(value.command, command)
    assert.ok(['read-only', 'mutation'].includes(value.contract.mode))
    assert.ok(value.errorTaxonomy.INVALID_COMMAND)
  }
})

test('v2 exposes no legacy collection, command, or workflow-template aliases', () => {
  assert.equal(routeNames().includes('strategy initialize'), false)
  assert.equal(routeNames().some(name => name.startsWith('vacancy ') || name.startsWith('application ')), false)
  assert.throws(() => workflowTemplate('workflow-template:vacancy-evidence'), error => error.code === 'NOT_FOUND')
  assert.equal(workflowTemplate('workflow-template:opportunity-evidence').template.label, 'Opportunity evidence')
  assert.deepEqual(Object.values(RECORD_FILES), ['companies.json', 'opportunities.json', 'application-attempts.json', 'people.json', 'interactions.json', 'artifacts.json', 'strategies.json', 'experiments.json'])
})

test('entity upsert accepts the canonical application-attempt ID prefix', t => {
  const { paths } = fixture(t)
  const attempt = loadModel(paths).applicationAttempts[0]
  const result = upsertEntity(paths, { schemaVersion: 1, requestId: 'attempt-upsert', idempotencyKey: 'attempt-upsert', expectedRevision: 0, payload: { type: 'application_attempt', record: { ...attempt, lifecycle_status: 'ready_to_apply' } } })
  assert.equal(result.status, 'applied')
  assert.equal(loadModel(paths).applicationAttempts[0].lifecycle_status, 'ready_to_apply')
})

test('graph backlinks and generated indexes make every related subject navigable', t => {
  const { paths } = fixture(t)
  const model = loadModel(paths)
  model.applicationAttempts[0].people_relations = [{ person_id: 'person:pat', relation: 'hiring_contact' }]
  model.interactions.push({ id: 'interaction:acme-conversation', application_attempt_id: 'application-attempt:acme-lead', opportunity_id: 'opportunity:acme-lead', person_ids: ['person:pat'], artifact_ids: ['artifact:pat-note'], kind: 'conversation', evidence_state: 'confirmed', occurred_at: '2026-08-28T10:00:00.000Z' })
  model.artifacts[0].subject_ids = ['company:acme', 'opportunity:acme-lead', 'application-attempt:acme-lead', 'person:pat']
  rebuildBacklinks(model)
  assert.deepEqual(model.companies[0].application_attempt_ids, ['application-attempt:acme-lead'])
  assert.deepEqual(model.opportunities[0].person_ids, ['person:pat'])
  assert.deepEqual(model.applicationAttempts[0].artifact_ids, ['artifact:pat-note'])
  assert.deepEqual(model.people[0].opportunity_ids, ['opportunity:acme-lead'])
  validateModel(model)

  const rendered = renderIndexes(model)
  const indexRoot = path.join(paths.candidaturesDir, 'indexes')
  for (const [name, content] of rendered) {
    const file = path.join(indexRoot, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
  }
  for (const [name, content] of rendered) {
    for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = decodeURI(match[1].split('#')[0])
      if (!target || /^[a-z]+:/i.test(target)) continue
      assert.equal(fs.existsSync(path.resolve(path.dirname(path.join(indexRoot, name)), target)), true, `${name} has broken link ${target}`)
    }
  }
  assert.match(rendered.get('companies/acme.md'), /\.\.\/opportunities\/acme-lead\.md/)
  assert.match(rendered.get('opportunities/acme-lead.md'), /\.\.\/people\/pat\.md/)
  assert.match(rendered.get('people/pat.md'), /\.\.\/application-attempts\/acme-lead\.md/)
  assert.match(rendered.get('artifacts/pat-note.md'), /\.\.\/opportunities\/acme-lead\.md/)
  assert.match(rendered.get('artifacts/pat-note.md'), /Open working file/)
})

test('workflow templates provide deterministic support and answer views', () => {
  const listed = workflowTemplates()
  assert.equal(listed.templates.length, 13)
  const brief = workflowTemplate('workflow-template:decision-brief').template
  assert.ok(brief.sections.includes('selection_viability'))
  assert.ok(brief.sections.includes('next_action'))
  assert.equal(workflowTemplates({ category: 'user-answer' }).templates.length, 3)
  assert.equal(workflowTemplates({ category: 'artifact-contract' }).templates.length, 4)
  assert.equal(workflowTemplate('workflow-template:executive-outreach').template.constraints.target_words, '90-140')
  assert.ok(workflowTemplate('workflow-template:executive-cv').template.constraints.candidate_owned_headline.includes('Never copy'))
  assert.equal(workflowTemplate('workflow-template:application-package').template.constraints.separate_confirmation.includes('submission'), true)
})

test('the strategy catalog exposes deterministic established instructions', () => {
  const value = getStrategyDefinition('strategy-definition:cold-apply')
  assert.equal(value.definition.category, 'application')
  assert.deepEqual(value.definition.phases.map(phase => phase.id), ['qualify', 'prepare', 'execute', 'measure'])
  assert.ok(value.definition.guardrails.some(rule => rule.includes('infer')))
  assert.equal(value.sources[0].id, 'eures-job-search')
})

test('portable skill routes every advertised command family', () => {
  const skillRoot = path.resolve('skills'), referenceRoot = path.join(skillRoot, 'references')
  const entrypoints = fs.readdirSync(skillRoot, { withFileTypes: true }).filter(item => item.isDirectory() && fs.existsSync(path.join(skillRoot, item.name, 'SKILL.md'))).map(item => fs.readFileSync(path.join(skillRoot, item.name, 'SKILL.md'), 'utf8'))
  const text = [...entrypoints, ...fs.readdirSync(referenceRoot).map(name => fs.readFileSync(path.join(referenceRoot, name), 'utf8'))].join('\n')
  for (const command of capabilities().commands) assert.ok(text.includes(command), `portable skill does not route ${command}`)
})

test('package command contract exposes an executable minimal record and artifact shape', () => {
  const contract = commandDescription('application-attempt register-package').contract
  assert.deepEqual(contract.payload.properties.records.properties.opportunity.required, ['id', 'company_id', 'title', 'posting_state', 'pursuit_status', 'people_relations'])
  assert.deepEqual(contract.payload.properties.records.properties.applicationAttempt.required, ['id', 'opportunity_id', 'lifecycle_status', 'outcome', 'storage_scope', 'record_state', 'people_relations'])
  assert.deepEqual(contract.payload.properties.artifacts.items.required, ['kind', 'owner_type', 'path', 'document'])
  assert.deepEqual(contract.payload.properties.artifacts.items.allOf[0].else.required, ['owner_id'])
  assert.equal(contract.payload.properties.artifacts.items.properties.id.description, 'Optional; generated when omitted.')
  assert.match(contract.payload.properties.artifacts.items.properties.path.description, /relative to the Candidatures directory/)
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

test('outreach can be recorded for a person without an ApplicationAttempt', t => {
  const { paths } = fixture(t)
  const command = { schemaVersion: 1, requestId: 'outreach-1', idempotencyKey: 'outreach-1', actor: 'test-agent', payload: { channel: 'LinkedIn', recipient: 'person:pat', objective: 'request a conversation', messageArtifactId: 'artifact:pat-note', record: { id: 'interaction:pat:coffee', person_ids: ['person:pat'], artifact_ids: [], kind: 'outreach', evidence_state: 'confirmed', occurred_at: '2026-08-28T10:00:00.000Z' } } }
  const result = recordInteraction(paths, command)
  assert.equal(result.status, 'applied')
  const interaction = JSON.parse(fs.readFileSync(path.join(paths.recordsDir, 'interactions.json')))[0]
  assert.equal(interaction.application_attempt_id, undefined)
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

test('artifact adoption invalidates quality evidence for the previous digest', t => {
  const { paths, file } = fixture(t), artifactsFile = path.join(paths.recordsDir, 'artifacts.json')
  const artifacts = JSON.parse(fs.readFileSync(artifactsFile, 'utf8'))
  const previousSha = artifacts[0].sha256
  artifacts[0].quality = {
    schema_version: 1,
    capability_id: 'documents-test',
    source_sha256: previousSha,
    artifact_sha256: previousSha,
    checks: { structural: 'passed', accessibility: 'passed', parity: 'passed', visual: 'passed' },
    status: 'visually_verified'
  }
  fs.writeFileSync(artifactsFile, `${JSON.stringify(artifacts, null, 2)}\n`)
  fs.writeFileSync(file, 'revision after quality review\n')

  const result = adoptArtifact(paths, { schemaVersion: 1, requestId: 'adopt-after-qa', idempotencyKey: 'adopt-after-qa', payload: { artifactId: 'artifact:pat-note', authorship: 'mixed', expectedSha256: previousSha } })

  assert.equal(result.status, 'applied')
  assert.equal(loadModel(paths).artifacts[0].quality, undefined)
})

test('public strategy definitions are available without a private data root', async () => {
  let output = ''
  const io = { out: { write: value => { output += value } }, err: { write: value => { output += value } } }
  assert.equal(await main(['strategy', 'definitions', '--json'], io), 0)
  assert.equal(JSON.parse(output).definitions.length, 8)
})

test('strategies are managed end to end through CLI routes', async t => {
  const { root } = fixture(t), inputFile = path.join(root, 'strategy-command.json')
  fs.writeFileSync(inputFile, JSON.stringify({ schemaVersion: 1, requestId: 'cli-strategy-create', idempotencyKey: 'cli-strategy-create', payload: { record: { id: 'strategy:cli-test', definition_id: 'strategy-definition:warm-introduction', objective: 'Test CLI management', scope: { subject_ids: ['person:pat'] }, success_criteria: [] } } }))
  let output = ''
  const io = { out: { write: value => { output += value } }, err: { write: value => { output += value } } }
  assert.equal(await main(['strategy', 'create', '--data-root', root, '--input', inputFile], io), 0)
  assert.equal(JSON.parse(output).status, 'applied')
  output = ''
  assert.equal(await main(['strategy', 'guide', '--data-root', root, '--id', 'strategy:cli-test', '--phase', 'qualify'], io), 0)
  assert.equal(JSON.parse(output).instructions[0].id, 'qualify')
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

test('standard context selects structured active strategy without requiring one', t => {
  const { paths } = fixture(t), strategiesFile = path.join(paths.recordsDir, 'strategies.json'), peopleFile = path.join(paths.recordsDir, 'people.json')
  const strategy = { id: 'strategy:acme-outreach', definition_id: 'strategy-definition:hiring-leader-outreach', status: 'active', objective: 'Calibrate the Acme mandate', scope: { subject_ids: ['person:pat'] }, success_criteria: [], source_revision: 0 }
  fs.writeFileSync(strategiesFile, `${JSON.stringify([strategy], null, 2)}\n`)
  const people = JSON.parse(fs.readFileSync(peopleFile)); people[0].strategy_ids = [strategy.id]; fs.writeFileSync(peopleFile, `${JSON.stringify(people, null, 2)}\n`)
  const result = buildContext(paths, { intent: 'outreach', subject: 'person:pat', budget: 'standard' })
  assert.equal(result.packet.strategy.selectionMode, 'subject-active')
  assert.equal(result.packet.strategy.items[0].instance.id, strategy.id)
  assert.equal(result.packet.strategy.items[0].definition.id, strategy.definition_id)
  assert.ok(result.packet.subject.documents.every(document => document.content.length <= 2200))
  const unscoped = buildContext(paths, { intent: 'analyze', budget: 'small' })
  assert.deepEqual(unscoped.packet.strategy.items, [])
})

test('an incomplete model fails closed without compatibility initialization', t => {
  const { paths } = fixture(t)
  fs.rmSync(path.join(paths.recordsDir, 'strategies.json')); fs.rmSync(path.join(paths.recordsDir, 'experiments.json'))
  assert.throws(() => loadModel(paths), error => error.code === 'MODEL_INCOMPLETE' && error.details.missingCollection === 'strategies')
})

test('strategy lifecycle, guide, experiment, and confirmed-event evaluation are governed', t => {
  const { paths } = fixture(t)
  const strategyCommand = { schemaVersion: 1, requestId: 'strategy-create', idempotencyKey: 'strategy-create', payload: { record: { id: 'strategy:acme-cold-apply', definition_id: 'strategy-definition:cold-apply', objective: 'Test selected Acme opportunities', scope: { subject_ids: ['application-attempt:acme-lead'] }, success_criteria: [{ metric: 'human_response', operator: '>=', value: 1 }] } } }
  assert.equal(createStrategy(paths, strategyCommand).status, 'applied')
  assert.equal(strategyGuide(paths, { id: 'strategy:acme-cold-apply', phase: 'qualify', subject: 'application-attempt:acme-lead' }).instructions.length, 1)
  assert.throws(() => recordInteraction(paths, { schemaVersion: 1, requestId: 'inactive-event', idempotencyKey: 'inactive-event', payload: { strategyIds: ['strategy:acme-cold-apply'], record: { id: 'interaction:acme:inactive', application_attempt_id: 'application-attempt:acme-lead', person_ids: [], artifact_ids: [], kind: 'human_response', evidence_state: 'confirmed', occurred_at: '2026-08-29T09:00:00.000Z' } } }), error => error.code === 'STRATEGY_NOT_ACTIVE')
  assert.equal(setStrategyStatus(paths, { schemaVersion: 1, requestId: 'strategy-activate', idempotencyKey: 'strategy-activate', expectedRevision: 0, payload: { strategyId: 'strategy:acme-cold-apply', status: 'active' } }).revision, 1)
  const experimentCommand = { schemaVersion: 1, requestId: 'experiment-create', idempotencyKey: 'experiment-create', payload: { record: { id: 'experiment:acme-gate-first', strategy_ids: ['strategy:acme-cold-apply'], hypothesis: 'Gate-first selection improves response.', cohorts: [{ id: 'gate-first', selection_rule: 'all configured gates resolved' }], metrics: ['human_response'] } } }
  assert.equal(createExperiment(paths, experimentCommand).status, 'applied')
  assert.throws(() => recordInteraction(paths, { schemaVersion: 1, requestId: 'draft-experiment-event', idempotencyKey: 'draft-experiment-event', payload: { strategyIds: ['strategy:acme-cold-apply'], experimentId: 'experiment:acme-gate-first', cohortId: 'gate-first', record: { id: 'interaction:acme:draft-experiment', application_attempt_id: 'application-attempt:acme-lead', person_ids: [], artifact_ids: [], kind: 'human_response', evidence_state: 'confirmed', occurred_at: '2026-08-29T09:30:00.000Z' } } }), error => error.code === 'EXPERIMENT_NOT_RUNNING')
  assert.equal(setExperimentStatus(paths, { schemaVersion: 1, requestId: 'experiment-start', idempotencyKey: 'experiment-start', expectedRevision: 0, payload: { experimentId: 'experiment:acme-gate-first', status: 'running' } }).revision, 1)
  recordInteraction(paths, { schemaVersion: 1, requestId: 'response-1', idempotencyKey: 'response-1', payload: { strategyIds: ['strategy:acme-cold-apply'], experimentId: 'experiment:acme-gate-first', cohortId: 'gate-first', record: { id: 'interaction:acme:response', application_attempt_id: 'application-attempt:acme-lead', person_ids: [], artifact_ids: [], kind: 'human_response', evidence_state: 'confirmed', occurred_at: '2026-08-29T10:00:00.000Z' } } })
  recordInteraction(paths, { schemaVersion: 1, requestId: 'draft-1', idempotencyKey: 'draft-1', payload: { strategyIds: ['strategy:acme-cold-apply'], experimentId: 'experiment:acme-gate-first', cohortId: 'gate-first', record: { id: 'interaction:acme:draft', application_attempt_id: 'application-attempt:acme-lead', person_ids: [], artifact_ids: [], kind: 'human_response', evidence_state: 'planned' } } })
  const evaluation = evaluateStrategy(paths, 'strategy:acme-cold-apply')
  assert.equal(evaluation.observed.attributed_interactions, 2)
  assert.equal(evaluation.observed.human_response, 1)
  assert.equal(evaluation.criteria[0].status, 'met')
  assert.equal(evaluateExperiment(paths, 'experiment:acme-gate-first').cohorts['gate-first'].confirmed_events, 1)
  assert.throws(() => setStrategyStatus(paths, { schemaVersion: 1, requestId: 'bad-close', idempotencyKey: 'bad-close', expectedRevision: 1, payload: { strategyId: 'strategy:acme-cold-apply', status: 'completed' } }), error => error.code === 'INVALID_COMMAND')
})

test('a short conflicting commit fails immediately instead of blocking a thread', t => {
  const { paths } = fixture(t)
  fs.mkdirSync(path.dirname(paths.lockPath), { recursive: true })
  fs.writeFileSync(paths.lockPath, JSON.stringify({ schemaVersion: 1, requestId: 'other', pid: 1, acquiredAt: new Date().toISOString() }))
  assert.throws(() => recordInteraction(paths, { schemaVersion: 1, requestId: 'outreach-busy', idempotencyKey: 'outreach-busy', payload: { record: { id: 'interaction:pat:busy', person_ids: ['person:pat'], artifact_ids: [], kind: 'outreach', evidence_state: 'planned' } } }), error => error.code === 'COMMIT_BUSY')
})

test('submission freezes exact transmitted bytes without visual rendering', t => {
  const { paths, root } = fixture(t), file = path.join(root, 'Candidatures', 'artifacts', 'opportunities', 'acme-lead', 'cv.docx')
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('[Content_Types].xml word/document.xml'), Buffer.from([0x50, 0x4b, 0x05, 0x06])]))
  const data = fs.readFileSync(file), hash = crypto.createHash('sha256').update(data).digest('hex'), artifactsFile = path.join(paths.recordsDir, 'artifacts.json')
  const artifacts = JSON.parse(fs.readFileSync(artifactsFile)); artifacts.push({ id: 'artifact:acme-cv-docx', kind: 'cv', owner_type: 'application_attempt', owner_id: 'application-attempt:acme-lead', path: 'artifacts/opportunities/acme-lead/cv.docx', sha256: hash, size_bytes: data.length, media_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', document: { role: 'cv', representation: 'user_edited_docx', state: 'final', version: 1, primary: true }, authorship: 'user' }); fs.writeFileSync(artifactsFile, `${JSON.stringify(artifacts, null, 2)}\n`)
  createStrategy(paths, { schemaVersion: 1, requestId: 'submission-strategy', idempotencyKey: 'submission-strategy', payload: { record: { id: 'strategy:acme-submission', definition_id: 'strategy-definition:cold-apply', objective: 'Submit selected Acme role', scope: { subject_ids: ['application-attempt:acme-lead'] }, parameters: { maximum_unresolved_hard_gaps: 1 }, success_criteria: [] } } })
  setStrategyStatus(paths, { schemaVersion: 1, requestId: 'submission-strategy-activate', idempotencyKey: 'submission-strategy-activate', expectedRevision: 0, payload: { strategyId: 'strategy:acme-submission', status: 'active' } })
  assert.throws(() => recordSubmission(paths, { schemaVersion: 1, requestId: 'submit-without-gate', idempotencyKey: 'submit-without-gate', expectedRevision: 0, payload: { applicationAttemptId: 'application-attempt:acme-lead', channel: 'company_website', occurredAt: '2026-08-28T11:00:00.000Z', artifactSelection: { state: 'confirmed', artifactIds: ['artifact:acme-cv-docx'] }, strategyIds: ['strategy:acme-submission'] } }), error => error.code === 'STRATEGY_REQUIREMENT_UNMET')
  recordInteraction(paths, { schemaVersion: 1, requestId: 'gate-1', idempotencyKey: 'gate-1', payload: { strategyIds: ['strategy:acme-submission'], record: { id: 'interaction:acme:gate', application_attempt_id: 'application-attempt:acme-lead', opportunity_id: 'opportunity:acme-lead', person_ids: [], artifact_ids: [], kind: 'strategy_gate_decision', evidence_state: 'confirmed', occurred_at: '2026-08-28T11:30:00.000Z', gate_decision: { decision: 'mitigate', checked_at: '2026-08-28', unresolved_gap_count: 1, evidence_or_mitigation: 'Validate level in the first human conversation.' } } } })
  const result = recordSubmission(paths, { schemaVersion: 1, requestId: 'submit-1', idempotencyKey: 'submit-1', actor: 'samuel', expectedRevision: 0, payload: { applicationAttemptId: 'application-attempt:acme-lead', channel: 'company_website', occurredAt: '2026-08-28T12:00:00.000Z', artifactSelection: { state: 'confirmed', artifactIds: ['artifact:acme-cv-docx'] }, strategyIds: ['strategy:acme-submission'] } })
  assert.equal(result.status, 'applied')
  const interaction = JSON.parse(fs.readFileSync(path.join(paths.recordsDir, 'interactions.json'))).find(x => x.kind === 'submission')
  assert.deepEqual(interaction.strategy_ids, ['strategy:acme-submission'])
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(paths.recordsDir, 'application-attempts.json')))[0].strategy_ids, ['strategy:acme-submission'])
  assert.ok(interaction.submission_bundle.items[0].snapshot_path)
  const snapshot = path.join(paths.candidaturesDir, interaction.submission_bundle.items[0].snapshot_path)
  assert.deepEqual(fs.readFileSync(snapshot), data)
  fs.writeFileSync(snapshot, Buffer.from('corrupted'))
  assert.throws(() => validateModel(loadModel(paths), { paths }), error => error.code === 'MODEL_INVALID' && error.details.errors.some(message => message.includes('invalid submission snapshot')))
})

test('opportunity decisions preserve STOP overrides without creating ApplicationAttempts', t => {
  const { paths } = fixture(t)
  const before = loadModel(paths).applicationAttempts.length
  const result = recordOpportunityDecision(paths, { schemaVersion: 1, requestId: 'decision-1', idempotencyKey: 'decision-1', payload: { subjectId: 'opportunity:acme-lead', decision: 'pursue', decidedAt: '2026-08-29T12:00:00.000Z', reasonCodes: ['user_choice'], decisionSource: 'user_directed_exception', originalRecommendation: 'stop', rationale: 'Test a differentiated mandate thesis.' } })
  assert.equal(result.status, 'applied')
  const model = loadModel(paths), decision = model.interactions.find(item => item.kind === 'opportunity_decision')
  assert.equal(model.applicationAttempts.length, before)
  assert.equal(decision.opportunity_decision.original_recommendation, 'stop')
  assert.throws(() => recordOpportunityDecision(paths, { schemaVersion: 1, requestId: 'bad-decision', idempotencyKey: 'bad-decision', payload: { subjectId: 'opportunity:acme-lead', decision: 'pursue', decidedAt: '2026-08-29T12:00:00.000Z', reasonCodes: ['user_choice'], decisionSource: 'user_directed_exception' } }), error => error.code === 'INVALID_COMMAND')
})

test('package registration is atomic and records external files without drafting', t => {
  const { paths, root } = fixture(t)
  const file = path.join(root, 'Candidatures', 'artifacts', 'opportunities', 'globex-director', 'fit-analysis.md')
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, '# Synthetic fit analysis\n')
  const command = { schemaVersion: 1, requestId: 'package-1', idempotencyKey: 'package-1', payload: { records: { company: { id: 'company:globex', name: 'Globex' }, opportunity: { id: 'opportunity:globex-director', company_id: 'company:globex', title: 'Director', posting_state: 'open', pursuit_status: 'ready_to_apply', people_relations: [] }, applicationAttempt: { id: 'application-attempt:globex-director', opportunity_id: 'opportunity:globex-director', lifecycle_status: 'ready_to_apply', outcome: null, storage_scope: 'active', record_state: 'complete', people_relations: [] } }, artifacts: [{ id: 'artifact:globex-fit', kind: 'fit_analysis', owner_type: 'application_attempt', owner_id: 'application-attempt:globex-director', path: 'artifacts/opportunities/globex-director/fit-analysis.md', document: { role: 'fit_analysis', representation: 'canonical_markdown', state: 'final', version: 1, primary: true } }] } }
  const result = registerApplicationPackage(paths, command)
  assert.equal(result.status, 'applied')
  const model = loadModel(paths)
  assert.ok(model.companies.some(item => item.id === 'company:globex'))
  assert.deepEqual(model.applicationAttempts.find(item => item.id === 'application-attempt:globex-director').artifact_ids, ['artifact:globex-fit'])
  assert.equal(submissionPlan(paths, 'application-attempt:globex-director').artifacts[0].eligible, true)
  const invalidFile = path.join(root, 'Candidatures', 'artifacts', 'opportunities', 'broken', 'missing.md')
  assert.equal(fs.existsSync(invalidFile), false)
  assert.throws(() => registerApplicationPackage(paths, { schemaVersion: 1, requestId: 'package-bad', idempotencyKey: 'package-bad', payload: { records: { company: { id: 'company:broken', name: 'Broken' } }, artifacts: [{ id: 'artifact:broken', kind: 'cv', owner_type: 'shared', path: 'artifacts/opportunities/broken/missing.md' }] } }), error => error.code === 'NOT_FOUND')
  assert.equal(loadModel(paths).companies.some(item => item.id === 'company:broken'), false)
})

test('derived artifact QA distinguishes structural from visual verification', t => {
  const { paths } = fixture(t), artifact = loadModel(paths).artifacts[0]
  const structural = recordArtifactQuality(paths, { schemaVersion: 1, requestId: 'qa-1', idempotencyKey: 'qa-1', payload: { artifactId: artifact.id, expectedSha256: artifact.sha256, manifest: { schemaVersion: 1, capabilityId: 'document-renderer:test', rendererVersion: '1', templateId: 'executive-note', templateVersion: '1', sourceSha256: artifact.sha256, artifactSha256: artifact.sha256, checks: { structural: 'passed', accessibility: 'passed', parity: 'passed', visual: 'not_run' } } } })
  assert.equal(structural.status, 'applied')
  assert.equal(loadModel(paths).artifacts[0].quality.status, 'structurally_verified')
  recordArtifactQuality(paths, { schemaVersion: 1, requestId: 'qa-2', idempotencyKey: 'qa-2', payload: { artifactId: artifact.id, manifest: { schemaVersion: 1, capabilityId: 'document-renderer:test', sourceSha256: artifact.sha256, artifactSha256: artifact.sha256, checks: { structural: 'passed', accessibility: 'passed', parity: 'passed', visual: 'passed' } } } })
  assert.equal(loadModel(paths).artifacts[0].quality.status, 'visually_verified')
})

test('semantic outreach and application-attempt closure avoid low-level record assembly', t => {
  const { paths } = fixture(t)
  const outreach = recordOutreachSent(paths, { schemaVersion: 1, requestId: 'sent-1', idempotencyKey: 'sent-1', payload: { channel: 'LinkedIn', recipient: 'person:pat', objective: 'calibrate mandate', occurredAt: '2026-08-29T13:00:00.000Z', messageArtifactId: 'artifact:pat-note' } })
  assert.equal(outreach.status, 'applied')
  const close = closeApplication(paths, { schemaVersion: 1, requestId: 'close-1', idempotencyKey: 'close-1', expectedRevision: 0, payload: { applicationAttemptId: 'application-attempt:acme-lead', lifecycleStatus: 'rejected', outcome: 'rejected', stage: 'application_screening', reason: 'Not selected at screening.' } })
  assert.deepEqual(close.unresolvedEvidence, ['Outcome date was not supplied and was not inferred.'])
  const model = loadModel(paths), applicationAttempt = model.applicationAttempts[0]
  assert.equal(applicationAttempt.storage_scope, 'archive')
  assert.equal(applicationAttempt.closure.occurred_at, null)
  assert.equal(model.interactions.filter(item => item.kind === 'application_outcome').length, 0)
})

test('submission planning and readiness expose ambiguity, gates, and visual status', t => {
  const { paths, root } = fixture(t), file = path.join(root, 'Candidatures', 'artifacts', 'opportunities', 'acme-lead', 'cv.md')
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, '# CV\n')
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), artifactsFile = path.join(paths.recordsDir, 'artifacts.json')
  const artifacts = JSON.parse(fs.readFileSync(artifactsFile)); artifacts.push({ id: 'artifact:acme-cv', kind: 'cv', owner_type: 'application_attempt', owner_id: 'application-attempt:acme-lead', path: 'artifacts/opportunities/acme-lead/cv.md', sha256: hash, size_bytes: 5, media_type: 'text/markdown', document: { role: 'cv', representation: 'canonical_markdown', state: 'final', version: 1, primary: true } }); fs.writeFileSync(artifactsFile, `${JSON.stringify(artifacts, null, 2)}\n`)
  const plan = submissionPlan(paths, 'application-attempt:acme-lead')
  assert.equal(plan.artifacts.find(item => item.id === 'artifact:acme-cv').eligible, true)
  assert.equal(plan.artifacts.find(item => item.id === 'artifact:acme-cv').uploadReady, false)
  assert.equal(readiness(paths, { intent: 'submit', subject: 'application-attempt:acme-lead' }).ready, true)
  assert.equal(readiness(paths, { intent: 'close', subject: 'application-attempt:acme-lead' }).requiredInput.includes('reason'), true)
})

test('artifact record-review attaches a workflow-template review and submission-plan surfaces its status as advisory', t => {
  const { paths, root } = fixture(t), file = path.join(root, 'Candidatures', 'artifacts', 'opportunities', 'acme-lead', 'cv.md')
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, '# CV\n')
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), artifactsFile = path.join(paths.recordsDir, 'artifacts.json')
  const artifacts = JSON.parse(fs.readFileSync(artifactsFile))
  artifacts.push({ id: 'artifact:acme-cv', kind: 'cv', owner_type: 'application_attempt', owner_id: 'application-attempt:acme-lead', path: 'artifacts/opportunities/acme-lead/cv.md', sha256: hash, size_bytes: 5, media_type: 'text/markdown', document: { role: 'cv', representation: 'canonical_markdown', state: 'final', version: 1, primary: true, contract: { templates: ['workflow-template:recruiter-scan'] } } })
  fs.writeFileSync(artifactsFile, `${JSON.stringify(artifacts, null, 2)}\n`)
  const cvArtifact = plan => plan.artifacts.find(item => item.id === 'artifact:acme-cv')

  let plan = submissionPlan(paths, 'application-attempt:acme-lead')
  assert.deepEqual(cvArtifact(plan).reviewStatus, { 'workflow-template:recruiter-scan': 'missing' })
  assert.ok(plan.unresolvedEvidence.some(line => line.includes('workflow-template review')))
  assert.equal(cvArtifact(plan).eligible, true)

  const recorded = recordArtifactReview(paths, { schemaVersion: 1, requestId: 'review-1', idempotencyKey: 'review-1', payload: { artifactId: 'artifact:acme-cv', review: { schemaVersion: 1, templateId: 'workflow-template:recruiter-scan', status: 'passed', lens: 'recruiter-scan' } } })
  assert.equal(recorded.status, 'applied')

  plan = submissionPlan(paths, 'application-attempt:acme-lead')
  assert.equal(cvArtifact(plan).reviewStatus['workflow-template:recruiter-scan'], 'passed')
  assert.ok(!plan.unresolvedEvidence.some(line => line.includes('workflow-template review')))
  assert.equal(cvArtifact(plan).eligible, true)

  // Drift the file directly (as a real user edit would, before `artifact adopt` re-records the new sha256).
  fs.writeFileSync(file, '# CV revised\n')
  const revisedHash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  const drifted = JSON.parse(fs.readFileSync(artifactsFile))
  drifted.find(item => item.id === 'artifact:acme-cv').sha256 = revisedHash
  fs.writeFileSync(artifactsFile, `${JSON.stringify(drifted, null, 2)}\n`)

  plan = submissionPlan(paths, 'application-attempt:acme-lead')
  assert.equal(cvArtifact(plan).reviewStatus['workflow-template:recruiter-scan'], 'stale')
  assert.ok(plan.unresolvedEvidence.some(line => line.includes('workflow-template review')))
})

test('artifact record-review rejects an invalid review record and dry-run leaves the model untouched', t => {
  const { paths, root } = fixture(t), file = path.join(root, 'Candidatures', 'artifacts', 'opportunities', 'acme-lead', 'cv.md')
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, '# CV\n')
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), artifactsFile = path.join(paths.recordsDir, 'artifacts.json')
  const artifacts = JSON.parse(fs.readFileSync(artifactsFile))
  artifacts.push({ id: 'artifact:acme-cv', kind: 'cv', owner_type: 'application_attempt', owner_id: 'application-attempt:acme-lead', path: 'artifacts/opportunities/acme-lead/cv.md', sha256: hash, size_bytes: 5, media_type: 'text/markdown', document: { role: 'cv', representation: 'canonical_markdown', state: 'final', version: 1, primary: true } })
  fs.writeFileSync(artifactsFile, `${JSON.stringify(artifacts, null, 2)}\n`)
  const before = fs.readFileSync(artifactsFile, 'utf8')

  assert.throws(() => recordArtifactReview(paths, { schemaVersion: 1, requestId: 'review-bad', idempotencyKey: 'review-bad', payload: { artifactId: 'artifact:acme-cv', review: { schemaVersion: 1, templateId: 'workflow-template:recruiter-scan', status: 'excellent' } } }), error => error.code === 'INVALID_COMMAND')
  assert.equal(fs.readFileSync(artifactsFile, 'utf8'), before)

  paths.dryRun = true
  const dryRun = recordArtifactReview(paths, { schemaVersion: 1, requestId: 'review-dry', idempotencyKey: 'review-dry', payload: { artifactId: 'artifact:acme-cv', review: { schemaVersion: 1, templateId: 'workflow-template:recruiter-scan', status: 'passed' } } })
  assert.equal(dryRun.status, 'dry_run')
  assert.equal(fs.readFileSync(artifactsFile, 'utf8'), before)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
})

test('date-only submission preserves unknown artifacts and reconciles exact bytes later', t => {
  const { paths, root } = fixture(t)
  const file = path.join(root, 'Candidatures', 'artifacts', 'opportunities', 'acme-lead', 'cv.md')
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, '# Candidate\n\n## Technology Director | Platform Leadership\n\n## Selected Leadership Evidence\n\nProof.\n\n## Core Capabilities\n\nPlatforms.\n\n## Professional Experience\n\nExperience.\n\n## Education & Certifications\n\nInternational modules: Alpha.\n\n## Languages\n\nEnglish.\n')
  const data = fs.readFileSync(file), hash = crypto.createHash('sha256').update(data).digest('hex'), artifactsFile = path.join(paths.recordsDir, 'artifacts.json')
  const artifacts = JSON.parse(fs.readFileSync(artifactsFile)); artifacts.push({ id: 'artifact:acme-cv', kind: 'cv', owner_type: 'application_attempt', owner_id: 'application-attempt:acme-lead', path: 'artifacts/opportunities/acme-lead/cv.md', sha256: hash, size_bytes: data.length, media_type: 'text/markdown', document: { role: 'cv', representation: 'canonical_markdown', state: 'final', version: 1, primary: true, contract: { template_id: 'workflow-template:executive-cv', required_phrases: ['International modules: Alpha.'] } } }); fs.writeFileSync(artifactsFile, `${JSON.stringify(artifacts, null, 2)}\n`)
  const result = recordSubmission(paths, { schemaVersion: 1, requestId: 'unknown-submit', idempotencyKey: 'unknown-submit', expectedRevision: 0, payload: { applicationAttemptId: 'application-attempt:acme-lead', channel: 'company_website', occurredOn: '2026-08-29', artifactSelection: { state: 'unknown' } } })
  assert.deepEqual(result.unresolvedEvidence, ['Transmitted artifacts remain unknown.'])
  let interaction = loadModel(paths).interactions[0]
  assert.equal(interaction.occurred_at, '2026-08-29')
  assert.equal(interaction.temporal_precision, 'date')
  assert.equal(interaction.submission_bundle.artifact_selection_state, 'unknown')
  const reconciled = reconcileSubmission(paths, { schemaVersion: 1, requestId: 'reconcile-submit', idempotencyKey: 'reconcile-submit', expectedRevision: 0, payload: { submissionId: interaction.id, artifactSelection: { state: 'confirmed', artifactIds: ['artifact:acme-cv'] } } })
  assert.equal(reconciled.revision, 1)
  interaction = loadModel(paths).interactions[0]
  assert.equal(interaction.submission_bundle.artifact_selection_state, 'confirmed')
  assert.ok(interaction.submission_bundle.items[0].snapshot_path)
  assert.equal(checkArtifactContract(paths, { artifactId: 'artifact:acme-cv', templateId: 'workflow-template:executive-cv' }).status, 'passed')
})

test('submission rejects unadopted artifact drift and preserves confirmed-none evidence', t => {
  const { paths, root } = fixture(t), file = path.join(root, 'Candidatures', 'artifacts', 'opportunities', 'acme-lead', 'cv.md')
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, '# Original\n')
  const data = fs.readFileSync(file), hash = crypto.createHash('sha256').update(data).digest('hex'), artifactsFile = path.join(paths.recordsDir, 'artifacts.json')
  const artifacts = JSON.parse(fs.readFileSync(artifactsFile)); artifacts.push({ id: 'artifact:acme-cv', kind: 'cv', owner_type: 'application_attempt', owner_id: 'application-attempt:acme-lead', path: 'artifacts/opportunities/acme-lead/cv.md', sha256: hash, size_bytes: data.length, document: { role: 'cv', representation: 'canonical_markdown', state: 'final', version: 1, primary: true } }); fs.writeFileSync(artifactsFile, `${JSON.stringify(artifacts, null, 2)}\n`)
  fs.writeFileSync(file, '# User revision\n')
  assert.throws(() => recordSubmission(paths, { schemaVersion: 1, requestId: 'drift-submit', idempotencyKey: 'drift-submit', expectedRevision: 0, payload: { applicationAttemptId: 'application-attempt:acme-lead', channel: 'company_website', occurredOn: '2026-08-29', artifactSelection: { state: 'confirmed', artifactIds: ['artifact:acme-cv'] } } }), error => error.code === 'STALE_ARTIFACT')
  const none = recordSubmission(paths, { schemaVersion: 1, requestId: 'none-submit', idempotencyKey: 'none-submit', expectedRevision: 0, payload: { applicationAttemptId: 'application-attempt:acme-lead', channel: 'company_website', occurredOn: '2026-08-29', artifactSelection: { state: 'confirmed_none' } } })
  assert.deepEqual(none.unresolvedEvidence, [])
  assert.equal(loadModel(paths).interactions[0].submission_bundle.artifact_selection_state, 'confirmed_none')
})

test('CV contract check rejects opportunity-title mirroring and missing canonical facts', t => {
  const { paths, root } = fixture(t), file = path.join(root, 'Candidatures', 'artifacts', 'opportunities', 'acme-lead', 'cv.md')
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, '# Candidate\n\n## Lead | Technology Executive\n\n## Professional Experience\n')
  const data = fs.readFileSync(file), hash = crypto.createHash('sha256').update(data).digest('hex'), artifactsFile = path.join(paths.recordsDir, 'artifacts.json')
  const artifacts = JSON.parse(fs.readFileSync(artifactsFile)); artifacts.push({ id: 'artifact:acme-cv', kind: 'cv', owner_type: 'application_attempt', owner_id: 'application-attempt:acme-lead', path: 'artifacts/opportunities/acme-lead/cv.md', sha256: hash, size_bytes: data.length, document: { role: 'cv', representation: 'canonical_markdown', state: 'final', version: 1, primary: true, contract: { required_phrases: ['International modules: Alpha.'] } } }); fs.writeFileSync(artifactsFile, `${JSON.stringify(artifacts, null, 2)}\n`)
  const check = checkArtifactContract(paths, { artifactId: 'artifact:acme-cv', templateId: 'workflow-template:executive-cv' })
  assert.equal(check.status, 'failed')
  assert.ok(check.violations.some(item => item.code === 'OPPORTUNITY_TITLE_MIRROR'))
  assert.ok(check.violations.some(item => item.code === 'MISSING_CANONICAL_FACT'))
})

test('privacy-safe run manifests reject content and remain disposable', t => {
  const { paths } = fixture(t), digest = 'a'.repeat(64)
  const command = { schemaVersion: 1, requestId: 'run-1', idempotencyKey: 'run-1', payload: { run: { schemaVersion: 1, runId: 'golden-acme', startedAt: '2026-08-29T10:00:00.000Z', completedAt: '2026-08-29T10:00:02.000Z', intent: 'analyze', subjectId: 'opportunity:acme-lead', sourceDigests: [digest], contextDigests: [digest], stages: [{ id: 'analyze', durationMs: 2000, toolFamily: 'browser', cacheHit: false, retries: 0 }] } } }
  assert.equal(recordRunManifest(paths, command).status, 'recorded')
  assert.equal(recordRunManifest(paths, command).status, 'unchanged')
  assert.equal(runList(paths).runs[0].runId, 'golden-acme')
  assert.throws(() => recordRunManifest(paths, { schemaVersion: 1, requestId: 'run-bad', idempotencyKey: 'run-bad', payload: { run: { ...command.payload.run, runId: 'bad', prompt: 'private text' } } }), error => error.code === 'SENSITIVE_RUN_FIELD')
})

test('CLI exposes command contracts, workflow templates, and readiness', async t => {
  const { root } = fixture(t)
  let output = ''
  const io = { out: { write: value => { output += value } }, err: { write: value => { output += value } } }
  assert.equal(await main(['command', 'describe', '--command', 'application-attempt close', '--json'], io), 0)
  assert.equal(JSON.parse(output).contract.mode, 'mutation')
  output = ''
  assert.equal(await main(['workflow', 'template', '--id', 'workflow-template:decision-brief', '--json'], io), 0)
  assert.ok(JSON.parse(output).template.sections.includes('decision'))
  output = ''
  assert.equal(await main(['readiness', '--data-root', root, '--intent', 'analyze', '--subject', 'opportunity:acme-lead', '--json'], io), 0)
  assert.equal(JSON.parse(output).advisory, true)
  assert.ok(JSON.parse(output).workflow.templates.length)
})

test('golden replay covers all eight reviewed workflow patterns', t => {
  const { paths, root } = fixture(t), records = ['companies.json', 'opportunities.json', 'application-attempts.json', 'people.json', 'interactions.json', 'artifacts.json', 'strategies.json', 'experiments.json'].map(name => path.join(paths.recordsDir, name))
  const beforeStops = records.map(file => fs.readFileSync(file, 'utf8'))

  // ABB and Cognizant: STOP analysis remains read-only.
  assert.equal(readiness(paths, { intent: 'analyze', subject: 'opportunity:acme-lead' }).advisory, true)
  assert.equal(readiness(paths, { intent: 'analyze', subject: 'opportunity:acme-lead' }).advisory, true)
  assert.deepEqual(records.map(file => fs.readFileSync(file, 'utf8')), beforeStops)
  assert.equal(fs.existsSync(paths.stateRoot), false)

  // Muto: a durable not-pursued decision does not create another ApplicationAttempt.
  recordOpportunityDecision(paths, { schemaVersion: 1, requestId: 'golden-muto', idempotencyKey: 'golden-muto', payload: { subjectId: 'opportunity:acme-lead', decision: 'not_pursued', decidedAt: '2026-08-29T09:00:00.000Z', reasonCodes: ['role_altitude'] } })
  assert.equal(loadModel(paths).applicationAttempts.length, 1)

  // Sonaar: semantic outreach freezes the exact message without requiring an ApplicationAttempt relation.
  recordOutreachSent(paths, { schemaVersion: 1, requestId: 'golden-sonaar', idempotencyKey: 'golden-sonaar', payload: { channel: 'LinkedIn', recipient: 'person:pat', objective: 'calibrate founder mandate', occurredAt: '2026-08-29T09:30:00.000Z', messageArtifactId: 'artifact:pat-note' } })
  assert.ok(loadModel(paths).interactions.find(item => item.kind === 'outreach').transmission.snapshot_path)

  // Form-only channel: the actual manifest receives a bounded answer and no letter.
  const motivation = path.join(root, 'Candidatures', 'artifacts', 'opportunities', 'formco', 'motivation.md')
  fs.mkdirSync(path.dirname(motivation), { recursive: true }); fs.writeFileSync(motivation, 'Synthetic motivation under the form limit.\n')
  registerApplicationPackage(paths, { schemaVersion: 1, requestId: 'golden-form-only', idempotencyKey: 'golden-form-only', payload: { records: { company: { id: 'company:formco', name: 'FormCo' }, opportunity: { id: 'opportunity:formco-director', company_id: 'company:formco', title: 'Director', posting_state: 'open', pursuit_status: 'ready_to_apply', people_relations: [] }, applicationAttempt: { id: 'application-attempt:formco-director', opportunity_id: 'opportunity:formco-director', lifecycle_status: 'ready_to_apply', outcome: null, storage_scope: 'active', record_state: 'complete', people_relations: [] } }, artifacts: [{ id: 'artifact:formco-motivation', kind: 'application_form_answer', owner_type: 'application_attempt', owner_id: 'application-attempt:formco-director', path: 'artifacts/opportunities/formco/motivation.md', document: { role: 'application_form_answer', representation: 'canonical_markdown', state: 'final', version: 1, primary: true } }] } })
  const formPlan = submissionPlan(paths, 'application-attempt:formco-director')
  assert.deepEqual(formPlan.artifacts.map(item => item.role), ['application_form_answer'])

  // User-directed exception: the original STOP recommendation remains visible.
  recordOpportunityDecision(paths, { schemaVersion: 1, requestId: 'golden-exception', idempotencyKey: 'golden-exception', payload: { subjectId: 'opportunity:formco-director', decision: 'pursue', decidedAt: '2026-08-29T10:00:00.000Z', reasonCodes: ['user_choice'], decisionSource: 'user_directed_exception', originalRecommendation: 'stop', rationale: 'Test a strategic partner thesis.' } })
  assert.equal(loadModel(paths).interactions.find(item => item.opportunity_decision?.decision_source === 'user_directed_exception').opportunity_decision.original_recommendation, 'stop')

  // Hard-gate case: an active cold-apply strategy without a gate blocks readiness before submission.
  createStrategy(paths, { schemaVersion: 1, requestId: 'golden-gate-strategy', idempotencyKey: 'golden-gate-strategy', payload: { record: { id: 'strategy:golden-gate', definition_id: 'strategy-definition:cold-apply', objective: 'Test eligibility before submission', scope: { subject_ids: ['application-attempt:formco-director'] }, parameters: { maximum_unresolved_hard_gaps: 0 }, success_criteria: [] } } })
  setStrategyStatus(paths, { schemaVersion: 1, requestId: 'golden-gate-active', idempotencyKey: 'golden-gate-active', expectedRevision: 0, payload: { strategyId: 'strategy:golden-gate', status: 'active' } })
  const gateReadiness = readiness(paths, { intent: 'submit', subject: 'application-attempt:formco-director' })
  assert.equal(gateReadiness.ready, false)
  assert.equal(gateReadiness.submissionPlan.gates[0].blocked, true)

  // Outcome close: preserve the rejection without inventing an event date.
  const undatedClose = closeApplication(paths, { schemaVersion: 1, requestId: 'golden-undated-close', idempotencyKey: 'golden-undated-close', expectedRevision: 0, payload: { applicationAttemptId: 'application-attempt:acme-lead', lifecycleStatus: 'rejected', outcome: 'rejected', reason: 'Not selected at application-attempt screening.', stage: 'application_screening' } })
  assert.equal(undatedClose.unresolvedEvidence.length, 1)
  assert.equal(loadModel(paths).applicationAttempts.find(item => item.id === 'application-attempt:acme-lead').closure.occurred_at, null)
})

test('dry-run validates a mutation without writing records, ledger or audit', t => {
  const { root, paths } = fixture(t)
  const before = fs.readFileSync(path.join(root, 'Candidatures', 'records', RECORD_FILES.interactions), 'utf8')
  const envelope = { schemaVersion: 1, requestId: 'dry-1', idempotencyKey: 'dry-1', payload: { subjectId: 'opportunity:acme-lead', decision: 'pursue', decidedAt: '2026-08-29T12:00:00.000Z', reasonCodes: ['user_choice'] } }
  const result = recordOpportunityDecision({ ...paths, dryRun: true }, envelope)
  assert.equal(result.status, 'dry_run')
  assert.equal(result.dryRun, true)
  assert.ok(result.changedEntities.length)
  assert.equal(fs.readFileSync(path.join(root, 'Candidatures', 'records', RECORD_FILES.interactions), 'utf8'), before)
  assert.equal(fs.existsSync(paths.ledgerPath), false)
  assert.equal(fs.existsSync(paths.lockPath), false)
  assert.throws(() => recordOpportunityDecision({ ...paths, dryRun: true }, { ...envelope, payload: { ...envelope.payload, decision: 'bogus' } }), error => error.code === 'INVALID_COMMAND')
})

test('validate --scope all warns about dangling Master provenance without failing', t => {
  const { root, paths } = fixture(t)
  fs.writeFileSync(path.join(root, 'Master', 'Present.md'), 'x\n')
  const file = path.join(root, 'Candidatures', 'records', RECORD_FILES.opportunities)
  const opportunities = JSON.parse(fs.readFileSync(file, 'utf8'))
  opportunities[0].provenance = ['Master/Present.md#a', 'Master/Gone.md']
  fs.writeFileSync(file, `${JSON.stringify(opportunities, null, 2)}\n`)
  const result = validateScope(loadModel(paths), 'all', paths)
  const warning = result.warnings.find(item => item.code === 'DANGLING_MASTER_REFERENCE')
  assert.deepEqual(warning.references.map(item => item.reference), ['Master/Gone.md'])
})

test('validateModel rejects a corrupted workflow review record', t => {
  const { root, paths } = fixture(t), file = path.join(root, 'Candidatures', 'artifacts', 'opportunities', 'acme-lead', 'cv.md')
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, '# CV\n')
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), artifactsFile = path.join(paths.recordsDir, 'artifacts.json')
  const artifacts = JSON.parse(fs.readFileSync(artifactsFile))
  artifacts.push({ id: 'artifact:acme-cv', kind: 'cv', owner_type: 'application_attempt', owner_id: 'application-attempt:acme-lead', path: 'artifacts/opportunities/acme-lead/cv.md', sha256: hash, size_bytes: 5, media_type: 'text/markdown', document: { role: 'cv', representation: 'canonical_markdown', state: 'final', version: 1, primary: true }, reviews: { 'workflow-template:recruiter-scan': { schema_version: 1, template_id: 'workflow-template:recruiter-scan', status: 'excellent', artifact_sha256: hash, recorded_at: '2026-08-29T10:00:00.000Z' } } })
  fs.writeFileSync(artifactsFile, `${JSON.stringify(artifacts, null, 2)}\n`)
  assert.throws(() => validateModel(loadModel(paths), { paths }), error => error.code === 'MODEL_INVALID' && error.details.errors.some(message => message.includes('invalid review record')))
})

test('describe suggests near command names and Holoself home is passed as HOLOSELF_HOME', t => {
  assert.throws(() => commandDescription('record-decision'), error => error.code === 'NOT_FOUND' && error.details.suggestions.includes('opportunity record-decision'))
  assert.equal(holoselfEnv({ holoselfHome: 'X:\synthetic-holoself' }, { A: '1' }).HOLOSELF_HOME, 'X:\synthetic-holoself')
  assert.equal(holoselfEnv({ holoselfHome: null }, { A: '1' }).HOLOSELF_HOME, undefined)
  // resolvePaths no longer derives a Holoself home from the environment (the removed NEXTSTEP_HOLOSELF_HOME is ignored).
  assert.equal('holoselfHome' in resolvePaths({ dataRoot: fixtureRoot(t), env: { NEXTSTEP_HOLOSELF_HOME: 'X:\synthetic-holoself' } }), false)
})

function pipelineFixture(t, { opportunities, applicationAttempts, people = [], interactions = [] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-pipeline-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'Master'))
  fs.mkdirSync(path.join(root, 'Candidatures', 'records'), { recursive: true })
  const model = { companies: [{ id: 'company:acme', name: 'Acme' }], opportunities, applicationAttempts, people, interactions, artifacts: [], strategies: [], experiments: [] }
  rebuildBacklinks(model)
  for (const [name, value] of Object.entries(model)) fs.writeFileSync(path.join(root, 'Candidatures', 'records', RECORD_FILES[name]), `${JSON.stringify(value, null, 2)}\n`)
  fs.writeFileSync(path.join(root, 'Candidatures', 'records', 'manifest.json'), `${JSON.stringify({ schema_version: 4, model: 'nextstep-opportunity-graph', counts: Object.fromEntries(Object.entries(model).map(([k, v]) => [k, v.length])) }, null, 2)}\n`)
  return { root, paths: resolvePaths({ dataRoot: root }) }
}

test('pipeline status aggregates by status, scopes staleness through the graph, and pins the null/boundary/clamp policy', t => {
  const opportunity = (id, pursuit_status) => ({ id, company_id: 'company:acme', title: 'Role', posting_state: 'open', pursuit_status, people_relations: [], source_revision: 0 })
  const attempt = (id, opportunity_id, lifecycle_status) => ({ id, opportunity_id, lifecycle_status, outcome: null, storage_scope: 'active', record_state: 'complete', people_relations: [], source_revision: 0 })
  const confirmed = (id, fields) => ({ id, kind: 'note', evidence_state: 'confirmed', person_ids: [], ...fields })
  // Each attempt gets its own dedicated host opportunity (o5/o6/o7) so an attempt's interaction never
  // contaminates the opportunity-level assertions for o1-o4, which each test one scenario in isolation
  // (o1-o3 age purely through their own interaction; o4 ages purely through an attempt-only interaction,
  // via the same opportunity.interaction_ids backlink o5-o7 exercise for their own hosted attempt).
  const { paths } = pipelineFixture(t, {
    opportunities: [
      opportunity('opportunity:o1', 'pursuing'),   // aged 20d via its own interaction -> stale (default threshold 14)
      opportunity('opportunity:o2', 'identified'), // touched only by a planned (unconfirmed) interaction and an unrelated person-only outreach -> never aged
      opportunity('opportunity:o3', 'rejected'),   // closed; aged 30d but must never be stale
      opportunity('opportunity:o4', 'evaluating'), // aged only via an attempt-only interaction -> backlink must still age it
      opportunity('opportunity:o5', 'pursuing'),   // hosts a1 only; ages exactly at the threshold via the backlink
      opportunity('opportunity:o6', 'pursuing'),   // hosts a2 only; ages via a future-dated interaction, clamps to 0
      opportunity('opportunity:o7', 'rejected')    // hosts a3 only; closed, ages 50d but must never be stale
    ],
    applicationAttempts: [
      attempt('application-attempt:a1', 'opportunity:o5', 'applied'),  // aged exactly at the threshold -> boundary, not stale
      attempt('application-attempt:a2', 'opportunity:o6', 'interview'),// aged by a future-dated interaction -> clamps to 0, not stale
      attempt('application-attempt:a3', 'opportunity:o7', 'closed'),   // closed; aged 50d but must never be stale
      attempt('application-attempt:a4', 'opportunity:o4', 'preparing') // ages both itself and opportunity:o4 via the same interaction
    ],
    people: [{ id: 'person:pat', name: 'Pat', company_id: 'company:acme' }],
    interactions: [
      confirmed('interaction:i1', { kind: 'note', opportunity_id: 'opportunity:o1', occurred_at: '2026-09-07' }), // date-only precision, 20 days before generatedAt
      { id: 'interaction:i2', kind: 'note', evidence_state: 'planned', person_ids: [], opportunity_id: 'opportunity:o2' }, // no occurred_at; must be ignored
      confirmed('interaction:i3', { kind: 'outreach', person_ids: ['person:pat'], occurred_at: '2026-08-18T09:00:00.000Z' }), // person-only, must not age opportunity:o2
      confirmed('interaction:i4', { kind: 'note', opportunity_id: 'opportunity:o3', occurred_at: '2026-08-28T09:00:00.000Z' }), // 30 days before, closed
      confirmed('interaction:i5', { kind: 'note', application_attempt_id: 'application-attempt:a4', occurred_at: '2026-09-22T09:00:00.000Z' }), // attempt-only, 5 days before; ages o4 too
      confirmed('interaction:i6', { kind: 'note', application_attempt_id: 'application-attempt:a1', occurred_at: '2026-09-13T12:00:00.000Z' }), // exactly 14 days before generatedAt
      confirmed('interaction:i7', { kind: 'note', application_attempt_id: 'application-attempt:a2', occurred_at: '2026-09-29T12:00:00.000Z' }), // 2 days after generatedAt (future)
      confirmed('interaction:i8', { kind: 'note', application_attempt_id: 'application-attempt:a3', occurred_at: '2026-08-08T09:00:00.000Z' })  // 50 days before, closed
    ]
  })
  const now = () => '2026-09-27T12:00:00.000Z'
  const result = pipelineStatus(paths, { now })
  assert.equal(result.status, 'ok')
  assert.equal(result.advisory, true)
  assert.equal(result.evidenceBoundary, 'confirmed-events-only')
  assert.equal(result.generatedAt, now())
  assert.equal(result.staleAfterDays, 14)

  assert.deepEqual(result.opportunities.byStatus, { pursuing: 3, identified: 1, rejected: 2, evaluating: 1 })
  assert.equal(result.opportunities.activeTotal, 5)
  assert.deepEqual(result.opportunities.closedByStatus, { rejected: 2 })
  assert.equal(result.opportunities.closedTotal, 2)
  assert.deepEqual(result.applicationAttempts.closedByStatus, { closed: 1 })

  const byId = Object.fromEntries(result.subjects.map(item => [item.id, item]))
  assert.equal(byId['opportunity:o1'].daysSinceLastConfirmed, 20)
  assert.equal(byId['opportunity:o1'].stale, true)
  assert.equal(byId['opportunity:o2'].daysSinceLastConfirmed, null) // planned + person-only outreach never age it
  assert.equal(byId['opportunity:o2'].stale, false)
  assert.equal(byId['opportunity:o3'].daysSinceLastConfirmed, 30)
  assert.equal(byId['opportunity:o3'].stale, false) // closed subjects are never stale
  assert.equal(byId['opportunity:o4'].daysSinceLastConfirmed, 5) // aged via the attempt-only interaction's backlink
  assert.equal(byId['application-attempt:a4'].daysSinceLastConfirmed, 5)
  assert.equal(byId['application-attempt:a4'].opportunityId, 'opportunity:o4')
  assert.equal(byId['opportunity:o5'].daysSinceLastConfirmed, 14) // the host opportunity inherits a1's own days via the same backlink
  assert.equal(byId['application-attempt:a1'].daysSinceLastConfirmed, 14)
  assert.equal(byId['application-attempt:a1'].stale, false) // exactly at threshold: only ">" is stale
  assert.equal(byId['application-attempt:a2'].daysSinceLastConfirmed, 0) // future date clamps to 0, never negative
  assert.equal(byId['application-attempt:a2'].stale, false)
  assert.equal(byId['application-attempt:a3'].daysSinceLastConfirmed, 50)
  assert.equal(byId['application-attempt:a3'].stale, false) // closed, aged, still never stale
  assert.equal(byId['opportunity:o7'].daysSinceLastConfirmed, 50)
  assert.equal(byId['opportunity:o7'].stale, false) // closed host, never stale even though aged

  // documented sort: daysSinceLastConfirmed desc, nulls last, then id
  const staleFirst = result.subjects.filter(item => item.type === 'opportunity').map(item => item.id)
  assert.deepEqual(staleFirst, ['opportunity:o7', 'opportunity:o3', 'opportunity:o1', 'opportunity:o5', 'opportunity:o4', 'opportunity:o6', 'opportunity:o2'])

  assert.throws(() => pipelineStatus(paths, { staleAfterDays: -1 }), error => error.code === 'INVALID_COMMAND')
  assert.throws(() => pipelineStatus(paths, { staleAfterDays: 1.5 }), error => error.code === 'INVALID_COMMAND')
  assert.deepEqual(pipelineStatus(paths, { staleAfterDays: 0, now }).subjects.find(item => item.id === 'application-attempt:a1'), { id: 'application-attempt:a1', type: 'applicationAttempt', opportunityId: 'opportunity:o5', status: 'applied', lastConfirmedAt: '2026-09-13T12:00:00.000Z', lastConfirmedInteractionId: 'interaction:i6', daysSinceLastConfirmed: 14, stale: true })
})

test('pipeline status is lock-free, mutates nothing, and is wired through the CLI/catalog contract', async t => {
  const { root, paths } = pipelineFixture(t, { opportunities: [], applicationAttempts: [] })
  const before = pipelineStatus(paths)
  assert.equal(fs.existsSync(paths.stateRoot), false)
  assert.deepEqual(before.subjects, [])
  assert.deepEqual(before.opportunities, { byStatus: {}, activeTotal: 0, closedByStatus: {}, closedTotal: 0 })

  assert.ok(capabilities().commands.includes('pipeline status'))
  assert.ok(routeNames().includes('pipeline status'))
  const contract = commandDescription('pipeline status')
  assert.equal(contract.contract.mode, 'read-only')

  let output = ''
  const io = { out: { write: value => { output += value } }, err: { write: value => { output += value } } }
  assert.equal(await main(['pipeline', 'status', '--data-root', root, '--json'], io), 0)
  const viaCli = JSON.parse(output)
  assert.ok(!Number.isNaN(Date.parse(viaCli.generatedAt)))
  assert.deepEqual({ ...viaCli, generatedAt: undefined }, { ...before, generatedAt: undefined })
  output = ''
  assert.equal(await main(['pipeline', 'status', '--data-root', root, '--stale-after-days', 'abc', '--json'], io), 1)
  assert.equal(JSON.parse(output).error.code, 'INVALID_COMMAND')
})

function fakeHoloself(t, mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-fake-holoself-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'holoself.mjs')
  const body = mode === 'success'
    ? "process.stdout.write(JSON.stringify({ lens: 'career', validation: { status: 'ok' }, warnings: [], self: { documents: [{ path: 'profile/identity.md', content: 'Fake identity.' }, { path: 'context/career.md', content: 'Fake career.' }] } })); process.exit(0)"
    : 'process.exit(1)'
  fs.writeFileSync(file, `${body}\n`)
  return file
}

function unavailableHoloself() { return path.join(os.tmpdir(), `nextstep-no-holoself-${crypto.randomUUID()}`, 'holoself') }

function stubHoloselfExecutable(t) {
  const original = process.env.HOLOSELF_EXECUTABLE
  t.after(() => { if (original === undefined) delete process.env.HOLOSELF_EXECUTABLE; else process.env.HOLOSELF_EXECUTABLE = original })
  return value => { process.env.HOLOSELF_EXECUTABLE = value }
}

function upsertCard(paths, fields, expectedRevision) {
  return candidateProfileUpsert(paths, { schemaVersion: 1, requestId: `card-${crypto.randomUUID()}`, idempotencyKey: `card-${crypto.randomUUID()}`, ...(expectedRevision == null ? {} : { expectedRevision }), payload: { record: fields } })
}

test('candidate-profile upsert validates fields, applies an optimistic revision, and dry-run writes nothing', t => {
  const { paths } = fixture(t), file = path.join(paths.recordsDir, 'candidate-profile.json')
  assert.deepEqual(candidateProfileShow(paths).profile, null)

  assert.throws(() => upsertCard(paths, { target_roles: ['CTO'], positioning: 'x' }), error => error.code === 'INVALID_COMMAND') // missing display_name
  assert.throws(() => upsertCard(paths, { display_name: 'Sam', target_roles: [], positioning: 'x' }), error => error.code === 'INVALID_COMMAND') // empty target_roles
  assert.throws(() => upsertCard(paths, { display_name: 'Sam', target_roles: ['CTO'], positioning: '' }), error => error.code === 'INVALID_COMMAND') // empty positioning
  assert.throws(() => upsertCard(paths, { display_name: 'Sam', target_roles: ['CTO'], positioning: 'x', source_preference: 'holoself' }), error => error.code === 'INVALID_COMMAND') // not a supported preference

  const card = { display_name: 'Sam', target_roles: ['CTO', 'VP Engineering'], positioning: 'Scales engineering orgs through platform investment.', flagship_facts: ['Grew a 40-person org to 150.'] }
  const applied = upsertCard(paths, card)
  assert.equal(applied.status, 'applied')
  assert.equal(applied.revision, 0)
  const stored = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.equal(stored.id, 'candidate-profile:self')
  assert.equal(stored.source_preference, 'auto')
  assert.equal(stored.source_revision, 0)
  assert.deepEqual(candidateProfileShow(paths).profile, stored)

  assert.throws(() => upsertCard(paths, card), error => error.code === 'INVALID_COMMAND') // existing record requires expectedRevision
  assert.throws(() => upsertCard(paths, card, 5), error => error.code === 'STALE_REVISION')
  const updated = upsertCard(paths, { ...card, source_preference: 'native' }, 0)
  assert.equal(updated.revision, 1)
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).source_preference, 'native')

  const before = fs.readFileSync(file, 'utf8')
  paths.dryRun = true
  const dryRun = upsertCard(paths, { ...card, display_name: 'Should not persist' }, 1)
  assert.equal(dryRun.status, 'dry_run')
  assert.equal(fs.readFileSync(file, 'utf8'), before)
})

test('buildContext resolves self via native preference, Holoself success/unavailable/failure, matching the documented resolution order', t => {
  const { paths } = fixture(t)
  const setHoloself = stubHoloselfExecutable(t)
  const successScript = fakeHoloself(t, 'success'), failScript = fakeHoloself(t, 'fail')
  const card = { display_name: 'Sam', target_roles: ['CTO'], positioning: 'Scales engineering orgs.', flagship_facts: ['Grew a team 4x.'] }

  // Branch 4: Holoself unavailable and no card -> unchanged degraded behavior.
  setHoloself(unavailableHoloself())
  let result = buildContext(paths, { intent: 'analyze', budget: 'small' })
  assert.equal(result.status, 'degraded')
  assert.equal(result.packet.self, null)
  assert.equal(result.warnings[0].code, 'HOLOSELF_UNAVAILABLE')

  upsertCard(paths, card)

  // Branch 3: Holoself unavailable and a card exists -> native, ok, no invented documents.
  result = buildContext(paths, { intent: 'analyze', budget: 'small' })
  assert.equal(result.status, 'ok')
  assert.equal(result.packet.self.source, 'native')
  assert.deepEqual(result.packet.self.documents, [])
  assert.equal(result.packet.self.displayName, 'Sam')
  assert.deepEqual(result.packet.self.targetRoles, ['CTO'])

  // Branch 2: Holoself success always wins over an auto card. Nothing is copied into a Nextstep record.
  setHoloself(successScript)
  result = buildContext(paths, { intent: 'analyze', budget: 'small' })
  assert.equal(result.status, 'ok')
  assert.equal(result.packet.self.source, 'holoself')
  assert.ok(result.packet.self.documents.some(document => document.path === 'profile/identity.md'))

  // Branch 5: any other Holoself failure stays degraded even with a card on disk; never silently substitutes.
  setHoloself(failScript)
  result = buildContext(paths, { intent: 'analyze', budget: 'small' })
  assert.equal(result.status, 'degraded')
  assert.equal(result.packet.self, null)
  assert.equal(result.warnings[0].code, 'HOLOSELF_FAILED')

  // Branch 1: an explicit native preference opts out and short-circuits before Holoself is called at all, even while it is still failing.
  const currentRevision = candidateProfileShow(paths).profile.source_revision
  upsertCard(paths, { ...card, source_preference: 'native' }, currentRevision)
  result = buildContext(paths, { intent: 'analyze', budget: 'small' })
  assert.equal(result.status, 'ok')
  assert.equal(result.packet.self.source, 'native')
})

test('doctor treats a native card as healthy without Holoself, but keeps Holoself mandatory when an explicit Holoself home is supplied', t => {
  const { root } = fixture(t)
  const paths = resolvePaths({ dataRoot: root, env: {} })
  stubHoloselfExecutable(t)(unavailableHoloself())

  let report = doctor(paths)
  assert.equal(report.checks.candidateProfile.activeSource, 'absent')
  assert.equal(report.checks.holoself.ok, false)
  assert.equal(report.status, 'degraded')

  upsertCard(paths, { display_name: 'Sam', target_roles: ['CTO'], positioning: 'x' })
  report = doctor(paths)
  assert.equal(report.checks.candidateProfile.activeSource, 'native')
  assert.equal(report.checks.candidateProfile.nativePresent, true)
  assert.equal(report.checks.holoself.ok, true)
  assert.ok(report.checks.holoself.note)
  assert.equal(report.status, 'healthy')

  const withHome = { ...paths, holoselfHome: root } // only programmatic callers can supply a home; resolvePaths never does
  const reportWithHome = doctor(withHome)
  assert.equal(reportWithHome.checks.holoself.ok, false)
  assert.equal(reportWithHome.checks.candidateProfile.activeSource, 'native')
  assert.equal(reportWithHome.status, 'degraded')
})

test('candidate-profile is wired through the CLI/catalog contract and routes show/upsert', async t => {
  const { root } = fixture(t)
  assert.ok(capabilities().commands.includes('candidate-profile show'))
  assert.ok(capabilities().commands.includes('candidate-profile upsert'))
  assert.ok(routeNames().includes('candidate-profile show'))
  assert.ok(routeNames().includes('candidate-profile upsert'))
  assert.equal(commandDescription('candidate-profile show').contract.mode, 'read-only')
  assert.equal(commandDescription('candidate-profile upsert').contract.mode, 'mutation')

  let output = ''
  const io = { out: { write: value => { output += value } }, err: { write: value => { output += value } } }
  assert.equal(await main(['candidate-profile', 'show', '--data-root', root, '--json'], io), 0)
  assert.deepEqual(JSON.parse(output).profile, null)

  const inputFile = path.join(root, 'candidate-profile-command.json')
  fs.writeFileSync(inputFile, JSON.stringify({ schemaVersion: 1, requestId: 'cli-card', idempotencyKey: 'cli-card', payload: { record: { display_name: 'Sam', target_roles: ['CTO'], positioning: 'Scales engineering orgs.' } } }))
  output = ''
  assert.equal(await main(['candidate-profile', 'upsert', '--data-root', root, '--input', inputFile, '--json'], io), 0)
  assert.equal(JSON.parse(output).status, 'applied')

  output = ''
  assert.equal(await main(['candidate-profile', 'show', '--data-root', root, '--json'], io), 0)
  assert.equal(JSON.parse(output).profile.display_name, 'Sam')
})

import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { capabilities, closeApplication, commandDescription, createExperiment, createStrategy, evaluateExperiment, evaluateStrategy, getStrategyDefinition, initializeStrategies, readiness, recordArtifactQuality, recordInteraction, recordOpportunityDecision, recordOutreachSent, recordRunManifest, recordSubmission, registerApplicationPackage, adoptArtifact, artifactStatus, buildContext, runList, setExperimentStatus, setStrategyStatus, strategyGuide, submissionPlan, workflowTemplate, workflowTemplates } from '../src/commands.mjs'
import { resolvePaths } from '../src/config.mjs'
import { main, routeNames } from '../src/cli.mjs'
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
    artifacts: [{ id: 'artifact:pat-note', kind: 'outreach_message', owner_type: 'person', owner_id: 'person:pat', path: 'artifacts/people/pat.md', sha256: '', size_bytes: 0, media_type: 'text/markdown', document: { role: 'outreach_message', representation: 'canonical_markdown', state: 'draft', version: 1, primary: true } }],
    strategies: [],
    experiments: []
  }
  const file = path.join(root, 'Candidatures', 'artifacts', 'people', 'pat.md')
  fs.writeFileSync(file, 'hello\n')
  model.artifacts[0].sha256 = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); model.artifacts[0].size_bytes = 6
  for (const [name, value] of Object.entries(model)) fs.writeFileSync(path.join(root, 'Candidatures', 'records', `${name}.json`), `${JSON.stringify(value, null, 2)}\n`)
  fs.writeFileSync(path.join(root, 'Candidatures', 'records', 'manifest.json'), `${JSON.stringify({ schema_version: 3, counts: Object.fromEntries(Object.entries(model).map(([k, v]) => [k, v.length])) }, null, 2)}\n`)
  return { root, paths: resolvePaths({ dataRoot: root }), file }
}

test('capabilities expose a CLI without API or embedded agent runtime', () => {
  const value = capabilities()
  assert.equal(value.version, '1.2.0')
  assert.equal(value.interface, 'local-cli')
  assert.equal(value.agentRuntime, 'external')
  assert.equal(JSON.stringify(value).includes('api'), false)
  assert.equal(value.strategyDefinitions.length, 8)
  assert.ok(value.commands.includes('strategy guide'))
  assert.ok(value.commands.includes('readiness'))
  assert.ok(value.commands.includes('application register-package'))
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

test('workflow templates provide deterministic support and answer views', () => {
  const listed = workflowTemplates()
  assert.equal(listed.templates.length, 10)
  const brief = workflowTemplate('workflow-template:decision-brief').template
  assert.ok(brief.sections.includes('selection_viability'))
  assert.ok(brief.sections.includes('next_action'))
  assert.equal(workflowTemplates({ category: 'user-answer' }).templates.length, 3)
  assert.equal(workflowTemplates({ category: 'artifact-contract' }).templates.length, 4)
  assert.equal(workflowTemplate('workflow-template:executive-outreach').template.constraints.target_words, '90-140')
})

test('the strategy catalog exposes deterministic established instructions', () => {
  const value = getStrategyDefinition('strategy-definition:cold-apply')
  assert.equal(value.definition.category, 'application')
  assert.deepEqual(value.definition.phases.map(phase => phase.id), ['qualify', 'prepare', 'execute', 'measure'])
  assert.ok(value.definition.guardrails.some(rule => rule.includes('infer')))
  assert.equal(value.sources[0].id, 'eures-job-search')
})

test('portable skill routes every advertised command family', () => {
  const skillRoot = path.resolve('skills', 'nextstep')
  const referenceRoot = path.join(skillRoot, 'references')
  const text = [fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8'), ...fs.readdirSync(referenceRoot).map(name => fs.readFileSync(path.join(referenceRoot, name), 'utf8'))].join('\n')
  for (const command of capabilities().commands) assert.ok(text.includes(command), `portable skill does not route ${command}`)
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

test('strategy initialization is an explicit idempotent migration', t => {
  const { paths } = fixture(t)
  fs.rmSync(path.join(paths.recordsDir, 'strategies.json')); fs.rmSync(path.join(paths.recordsDir, 'experiments.json'))
  assert.throws(() => loadModel(paths), error => error.code === 'MODEL_INCOMPLETE' && error.details.migrationCommand === 'strategy initialize')
  const command = { schemaVersion: 1, requestId: 'strategy-init', idempotencyKey: 'strategy-init', payload: {} }
  assert.equal(initializeStrategies(paths, command).status, 'applied')
  assert.deepEqual(loadModel(paths).strategies, [])
  assert.equal(initializeStrategies(paths, command).replayed, true)
})

test('strategy lifecycle, guide, experiment, and confirmed-event evaluation are governed', t => {
  const { paths } = fixture(t)
  const strategyCommand = { schemaVersion: 1, requestId: 'strategy-create', idempotencyKey: 'strategy-create', payload: { record: { id: 'strategy:acme-cold-apply', definition_id: 'strategy-definition:cold-apply', objective: 'Test selected Acme opportunities', scope: { subject_ids: ['application:acme-lead'] }, success_criteria: [{ metric: 'human_response', operator: '>=', value: 1 }] } } }
  assert.equal(createStrategy(paths, strategyCommand).status, 'applied')
  assert.equal(strategyGuide(paths, { id: 'strategy:acme-cold-apply', phase: 'qualify', subject: 'application:acme-lead' }).instructions.length, 1)
  assert.throws(() => recordInteraction(paths, { schemaVersion: 1, requestId: 'inactive-event', idempotencyKey: 'inactive-event', payload: { strategyIds: ['strategy:acme-cold-apply'], record: { id: 'interaction:acme:inactive', application_id: 'application:acme-lead', person_ids: [], artifact_ids: [], kind: 'human_response', evidence_state: 'confirmed', occurred_at: '2026-08-29T09:00:00.000Z' } } }), error => error.code === 'STRATEGY_NOT_ACTIVE')
  assert.equal(setStrategyStatus(paths, { schemaVersion: 1, requestId: 'strategy-activate', idempotencyKey: 'strategy-activate', expectedRevision: 0, payload: { strategyId: 'strategy:acme-cold-apply', status: 'active' } }).revision, 1)
  const experimentCommand = { schemaVersion: 1, requestId: 'experiment-create', idempotencyKey: 'experiment-create', payload: { record: { id: 'experiment:acme-gate-first', strategy_ids: ['strategy:acme-cold-apply'], hypothesis: 'Gate-first selection improves response.', cohorts: [{ id: 'gate-first', selection_rule: 'all configured gates resolved' }], metrics: ['human_response'] } } }
  assert.equal(createExperiment(paths, experimentCommand).status, 'applied')
  assert.throws(() => recordInteraction(paths, { schemaVersion: 1, requestId: 'draft-experiment-event', idempotencyKey: 'draft-experiment-event', payload: { strategyIds: ['strategy:acme-cold-apply'], experimentId: 'experiment:acme-gate-first', cohortId: 'gate-first', record: { id: 'interaction:acme:draft-experiment', application_id: 'application:acme-lead', person_ids: [], artifact_ids: [], kind: 'human_response', evidence_state: 'confirmed', occurred_at: '2026-08-29T09:30:00.000Z' } } }), error => error.code === 'EXPERIMENT_NOT_RUNNING')
  assert.equal(setExperimentStatus(paths, { schemaVersion: 1, requestId: 'experiment-start', idempotencyKey: 'experiment-start', expectedRevision: 0, payload: { experimentId: 'experiment:acme-gate-first', status: 'running' } }).revision, 1)
  recordInteraction(paths, { schemaVersion: 1, requestId: 'response-1', idempotencyKey: 'response-1', payload: { strategyIds: ['strategy:acme-cold-apply'], experimentId: 'experiment:acme-gate-first', cohortId: 'gate-first', record: { id: 'interaction:acme:response', application_id: 'application:acme-lead', person_ids: [], artifact_ids: [], kind: 'human_response', evidence_state: 'confirmed', occurred_at: '2026-08-29T10:00:00.000Z' } } })
  recordInteraction(paths, { schemaVersion: 1, requestId: 'draft-1', idempotencyKey: 'draft-1', payload: { strategyIds: ['strategy:acme-cold-apply'], experimentId: 'experiment:acme-gate-first', cohortId: 'gate-first', record: { id: 'interaction:acme:draft', application_id: 'application:acme-lead', person_ids: [], artifact_ids: [], kind: 'human_response', evidence_state: 'planned' } } })
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
  const { paths, root } = fixture(t), file = path.join(root, 'Candidatures', 'artifacts', 'applications', 'acme-lead', 'cv.docx')
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('[Content_Types].xml word/document.xml'), Buffer.from([0x50, 0x4b, 0x05, 0x06])]))
  const data = fs.readFileSync(file), hash = crypto.createHash('sha256').update(data).digest('hex'), artifactsFile = path.join(paths.recordsDir, 'artifacts.json')
  const artifacts = JSON.parse(fs.readFileSync(artifactsFile)); artifacts.push({ id: 'artifact:acme-cv-docx', kind: 'cv', owner_type: 'application', owner_id: 'application:acme-lead', path: 'artifacts/applications/acme-lead/cv.docx', sha256: hash, size_bytes: data.length, media_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', document: { role: 'cv', representation: 'user_edited_docx', state: 'final', version: 1, primary: true }, authorship: 'user' }); fs.writeFileSync(artifactsFile, `${JSON.stringify(artifacts, null, 2)}\n`)
  createStrategy(paths, { schemaVersion: 1, requestId: 'submission-strategy', idempotencyKey: 'submission-strategy', payload: { record: { id: 'strategy:acme-submission', definition_id: 'strategy-definition:cold-apply', objective: 'Submit selected Acme role', scope: { subject_ids: ['application:acme-lead'] }, parameters: { maximum_unresolved_hard_gaps: 1 }, success_criteria: [] } } })
  setStrategyStatus(paths, { schemaVersion: 1, requestId: 'submission-strategy-activate', idempotencyKey: 'submission-strategy-activate', expectedRevision: 0, payload: { strategyId: 'strategy:acme-submission', status: 'active' } })
  assert.throws(() => recordSubmission(paths, { schemaVersion: 1, requestId: 'submit-without-gate', idempotencyKey: 'submit-without-gate', expectedRevision: 0, payload: { applicationId: 'application:acme-lead', channel: 'company_website', occurredAt: '2026-08-28T11:00:00.000Z', artifactIds: ['artifact:acme-cv-docx'], strategyIds: ['strategy:acme-submission'] } }), error => error.code === 'STRATEGY_REQUIREMENT_UNMET')
  recordInteraction(paths, { schemaVersion: 1, requestId: 'gate-1', idempotencyKey: 'gate-1', payload: { strategyIds: ['strategy:acme-submission'], record: { id: 'interaction:acme:gate', application_id: 'application:acme-lead', vacancy_id: 'vacancy:acme-lead', person_ids: [], artifact_ids: [], kind: 'strategy_gate_decision', evidence_state: 'confirmed', occurred_at: '2026-08-28T11:30:00.000Z', gate_decision: { decision: 'mitigate', checked_at: '2026-08-28', unresolved_gap_count: 1, evidence_or_mitigation: 'Validate level in the first human conversation.' } } } })
  const result = recordSubmission(paths, { schemaVersion: 1, requestId: 'submit-1', idempotencyKey: 'submit-1', actor: 'samuel', expectedRevision: 0, payload: { applicationId: 'application:acme-lead', channel: 'company_website', occurredAt: '2026-08-28T12:00:00.000Z', artifactIds: ['artifact:acme-cv-docx'], strategyIds: ['strategy:acme-submission'] } })
  assert.equal(result.status, 'applied')
  const interaction = JSON.parse(fs.readFileSync(path.join(paths.recordsDir, 'interactions.json'))).find(x => x.kind === 'submission')
  assert.deepEqual(interaction.strategy_ids, ['strategy:acme-submission'])
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(paths.recordsDir, 'applications.json')))[0].strategy_ids, ['strategy:acme-submission'])
  assert.ok(interaction.submission_bundle.items[0].snapshot_path)
  const snapshot = path.join(paths.candidaturesDir, interaction.submission_bundle.items[0].snapshot_path)
  assert.deepEqual(fs.readFileSync(snapshot), data)
  fs.writeFileSync(snapshot, Buffer.from('corrupted'))
  assert.throws(() => validateModel(loadModel(paths), { paths }), error => error.code === 'MODEL_INVALID' && error.details.errors.some(message => message.includes('invalid submission snapshot')))
})

test('opportunity decisions preserve STOP overrides without creating Applications', t => {
  const { paths } = fixture(t)
  const before = loadModel(paths).applications.length
  const result = recordOpportunityDecision(paths, { schemaVersion: 1, requestId: 'decision-1', idempotencyKey: 'decision-1', payload: { subjectId: 'vacancy:acme-lead', decision: 'pursue', decidedAt: '2026-08-29T12:00:00.000Z', reasonCodes: ['user_choice'], decisionSource: 'user_directed_exception', originalRecommendation: 'stop', rationale: 'Test a differentiated mandate thesis.' } })
  assert.equal(result.status, 'applied')
  const model = loadModel(paths), decision = model.interactions.find(item => item.kind === 'opportunity_decision')
  assert.equal(model.applications.length, before)
  assert.equal(decision.opportunity_decision.original_recommendation, 'stop')
  assert.throws(() => recordOpportunityDecision(paths, { schemaVersion: 1, requestId: 'bad-decision', idempotencyKey: 'bad-decision', payload: { subjectId: 'vacancy:acme-lead', decision: 'pursue', decidedAt: '2026-08-29T12:00:00.000Z', reasonCodes: ['user_choice'], decisionSource: 'user_directed_exception' } }), error => error.code === 'INVALID_COMMAND')
})

test('package registration is atomic and records external files without drafting', t => {
  const { paths, root } = fixture(t)
  const file = path.join(root, 'Candidatures', 'artifacts', 'applications', 'globex-director', 'fit-analysis.md')
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, '# Synthetic fit analysis\n')
  const command = { schemaVersion: 1, requestId: 'package-1', idempotencyKey: 'package-1', payload: { records: { company: { id: 'company:globex', name: 'Globex', vacancy_ids: [], person_ids: [] }, vacancy: { id: 'vacancy:globex-director', company_id: 'company:globex', title: 'Director', vacancy_state: 'open', application_ids: [] }, application: { id: 'application:globex-director', vacancy_id: 'vacancy:globex-director', lifecycle_status: 'to_apply', outcome: null, storage_scope: 'active', record_state: 'complete', people_relations: [], interaction_ids: [], artifact_ids: [] } }, artifacts: [{ id: 'artifact:globex-fit', kind: 'fit_analysis', owner_type: 'application', owner_id: 'application:globex-director', path: 'artifacts/applications/globex-director/fit-analysis.md', document: { role: 'fit_analysis', representation: 'canonical_markdown', state: 'final', version: 1, primary: true } }] } }
  const result = registerApplicationPackage(paths, command)
  assert.equal(result.status, 'applied')
  const model = loadModel(paths)
  assert.ok(model.companies.some(item => item.id === 'company:globex'))
  assert.deepEqual(model.applications.find(item => item.id === 'application:globex-director').artifact_ids, ['artifact:globex-fit'])
  assert.equal(submissionPlan(paths, 'application:globex-director').artifacts[0].eligible, true)
  const invalidFile = path.join(root, 'Candidatures', 'artifacts', 'applications', 'broken', 'missing.md')
  assert.equal(fs.existsSync(invalidFile), false)
  assert.throws(() => registerApplicationPackage(paths, { schemaVersion: 1, requestId: 'package-bad', idempotencyKey: 'package-bad', payload: { records: { company: { id: 'company:broken', name: 'Broken' } }, artifacts: [{ id: 'artifact:broken', kind: 'cv', owner_type: 'shared', path: 'artifacts/applications/broken/missing.md' }] } }), error => error.code === 'NOT_FOUND')
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

test('semantic outreach and application closure avoid low-level record assembly', t => {
  const { paths } = fixture(t)
  const outreach = recordOutreachSent(paths, { schemaVersion: 1, requestId: 'sent-1', idempotencyKey: 'sent-1', payload: { channel: 'LinkedIn', recipient: 'person:pat', objective: 'calibrate mandate', occurredAt: '2026-08-29T13:00:00.000Z', messageArtifactId: 'artifact:pat-note' } })
  assert.equal(outreach.status, 'applied')
  const close = closeApplication(paths, { schemaVersion: 1, requestId: 'close-1', idempotencyKey: 'close-1', expectedRevision: 0, payload: { applicationId: 'application:acme-lead', lifecycleStatus: 'rejected', outcome: 'rejected', stage: 'application_screening', reason: 'Not selected at screening.' } })
  assert.deepEqual(close.unresolvedEvidence, ['Outcome date was not supplied and was not inferred.'])
  const model = loadModel(paths), application = model.applications[0]
  assert.equal(application.storage_scope, 'archive')
  assert.equal(application.closure.occurred_at, null)
  assert.equal(model.interactions.filter(item => item.kind === 'application_outcome').length, 0)
})

test('submission planning and readiness expose ambiguity, gates, and visual status', t => {
  const { paths, root } = fixture(t), file = path.join(root, 'Candidatures', 'artifacts', 'applications', 'acme-lead', 'cv.md')
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, '# CV\n')
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), artifactsFile = path.join(paths.recordsDir, 'artifacts.json')
  const artifacts = JSON.parse(fs.readFileSync(artifactsFile)); artifacts.push({ id: 'artifact:acme-cv', kind: 'cv', owner_type: 'application', owner_id: 'application:acme-lead', path: 'artifacts/applications/acme-lead/cv.md', sha256: hash, size_bytes: 5, media_type: 'text/markdown', document: { role: 'cv', representation: 'canonical_markdown', state: 'final', version: 1, primary: true } }); fs.writeFileSync(artifactsFile, `${JSON.stringify(artifacts, null, 2)}\n`)
  const plan = submissionPlan(paths, 'application:acme-lead')
  assert.equal(plan.artifacts.find(item => item.id === 'artifact:acme-cv').eligible, true)
  assert.equal(plan.artifacts.find(item => item.id === 'artifact:acme-cv').uploadReady, false)
  assert.equal(readiness(paths, { intent: 'submit', subject: 'application:acme-lead' }).ready, true)
  assert.equal(readiness(paths, { intent: 'close', subject: 'application:acme-lead' }).requiredInput.includes('reason'), true)
})

test('explicit empty submission selection is preserved as unresolved evidence', t => {
  const { paths } = fixture(t)
  const result = recordSubmission(paths, { schemaVersion: 1, requestId: 'empty-submit', idempotencyKey: 'empty-submit', expectedRevision: 0, payload: { applicationId: 'application:acme-lead', channel: 'company_website', occurredAt: '2026-08-29T14:00:00.000Z', artifactIds: [] } })
  assert.deepEqual(result.unresolvedEvidence, ['No transmitted artifacts were asserted.'])
  assert.equal(loadModel(paths).interactions[0].submission_bundle.items.length, 0)
})

test('privacy-safe run manifests reject content and remain disposable', t => {
  const { paths } = fixture(t), digest = 'a'.repeat(64)
  const command = { schemaVersion: 1, requestId: 'run-1', idempotencyKey: 'run-1', payload: { run: { schemaVersion: 1, runId: 'golden-acme', startedAt: '2026-08-29T10:00:00.000Z', completedAt: '2026-08-29T10:00:02.000Z', intent: 'analyze', subjectId: 'vacancy:acme-lead', sourceDigests: [digest], contextDigests: [digest], stages: [{ id: 'analyze', durationMs: 2000, toolFamily: 'browser', cacheHit: false, retries: 0 }] } } }
  assert.equal(recordRunManifest(paths, command).status, 'recorded')
  assert.equal(recordRunManifest(paths, command).status, 'unchanged')
  assert.equal(runList(paths).runs[0].runId, 'golden-acme')
  assert.throws(() => recordRunManifest(paths, { schemaVersion: 1, requestId: 'run-bad', idempotencyKey: 'run-bad', payload: { run: { ...command.payload.run, runId: 'bad', prompt: 'private text' } } }), error => error.code === 'SENSITIVE_RUN_FIELD')
})

test('CLI exposes command contracts, workflow templates, and readiness', async t => {
  const { root } = fixture(t)
  let output = ''
  const io = { out: { write: value => { output += value } }, err: { write: value => { output += value } } }
  assert.equal(await main(['command', 'describe', '--command', 'application close', '--json'], io), 0)
  assert.equal(JSON.parse(output).contract.mode, 'mutation')
  output = ''
  assert.equal(await main(['workflow', 'template', '--id', 'workflow-template:decision-brief', '--json'], io), 0)
  assert.ok(JSON.parse(output).template.sections.includes('decision'))
  output = ''
  assert.equal(await main(['readiness', '--data-root', root, '--intent', 'analyze', '--subject', 'vacancy:acme-lead', '--json'], io), 0)
  assert.equal(JSON.parse(output).advisory, true)
})

test('golden replay covers all eight reviewed workflow patterns', t => {
  const { paths, root } = fixture(t), records = ['companies', 'vacancies', 'applications', 'people', 'interactions', 'artifacts', 'strategies', 'experiments'].map(name => path.join(paths.recordsDir, `${name}.json`))
  const beforeStops = records.map(file => fs.readFileSync(file, 'utf8'))

  // ABB and Cognizant: STOP analysis remains read-only.
  assert.equal(readiness(paths, { intent: 'analyze', subject: 'vacancy:acme-lead' }).advisory, true)
  assert.equal(readiness(paths, { intent: 'analyze', subject: 'vacancy:acme-lead' }).advisory, true)
  assert.deepEqual(records.map(file => fs.readFileSync(file, 'utf8')), beforeStops)
  assert.equal(fs.existsSync(paths.stateRoot), false)

  // Muto: a durable not-pursued decision does not create another Application.
  recordOpportunityDecision(paths, { schemaVersion: 1, requestId: 'golden-muto', idempotencyKey: 'golden-muto', payload: { subjectId: 'vacancy:acme-lead', decision: 'not_pursued', decidedAt: '2026-08-29T09:00:00.000Z', reasonCodes: ['role_altitude'] } })
  assert.equal(loadModel(paths).applications.length, 1)

  // Sonaar: semantic outreach freezes the exact message without requiring an Application relation.
  recordOutreachSent(paths, { schemaVersion: 1, requestId: 'golden-sonaar', idempotencyKey: 'golden-sonaar', payload: { channel: 'LinkedIn', recipient: 'person:pat', objective: 'calibrate founder mandate', occurredAt: '2026-08-29T09:30:00.000Z', messageArtifactId: 'artifact:pat-note' } })
  assert.ok(loadModel(paths).interactions.find(item => item.kind === 'outreach').transmission.snapshot_path)

  // Form-only channel: the actual manifest receives a bounded answer and no letter.
  const motivation = path.join(root, 'Candidatures', 'artifacts', 'applications', 'formco', 'motivation.md')
  fs.mkdirSync(path.dirname(motivation), { recursive: true }); fs.writeFileSync(motivation, 'Synthetic motivation under the form limit.\n')
  registerApplicationPackage(paths, { schemaVersion: 1, requestId: 'golden-form-only', idempotencyKey: 'golden-form-only', payload: { records: { company: { id: 'company:formco', name: 'FormCo' }, vacancy: { id: 'vacancy:formco-director', company_id: 'company:formco', title: 'Director', vacancy_state: 'open' }, application: { id: 'application:formco-director', vacancy_id: 'vacancy:formco-director', lifecycle_status: 'to_apply', outcome: null, storage_scope: 'active', record_state: 'complete', people_relations: [] } }, artifacts: [{ id: 'artifact:formco-motivation', kind: 'application_form_answer', owner_type: 'application', owner_id: 'application:formco-director', path: 'artifacts/applications/formco/motivation.md', document: { role: 'application_form_answer', representation: 'canonical_markdown', state: 'final', version: 1, primary: true } }] } })
  const formPlan = submissionPlan(paths, 'application:formco-director')
  assert.deepEqual(formPlan.artifacts.map(item => item.role), ['application_form_answer'])

  // User-directed exception: the original STOP recommendation remains visible.
  recordOpportunityDecision(paths, { schemaVersion: 1, requestId: 'golden-exception', idempotencyKey: 'golden-exception', payload: { subjectId: 'vacancy:formco-director', decision: 'pursue', decidedAt: '2026-08-29T10:00:00.000Z', reasonCodes: ['user_choice'], decisionSource: 'user_directed_exception', originalRecommendation: 'stop', rationale: 'Test a strategic partner thesis.' } })
  assert.equal(loadModel(paths).interactions.find(item => item.opportunity_decision?.decision_source === 'user_directed_exception').opportunity_decision.original_recommendation, 'stop')

  // Hard-gate case: an active cold-apply strategy without a gate blocks readiness before submission.
  createStrategy(paths, { schemaVersion: 1, requestId: 'golden-gate-strategy', idempotencyKey: 'golden-gate-strategy', payload: { record: { id: 'strategy:golden-gate', definition_id: 'strategy-definition:cold-apply', objective: 'Test eligibility before submission', scope: { subject_ids: ['application:formco-director'] }, parameters: { maximum_unresolved_hard_gaps: 0 }, success_criteria: [] } } })
  setStrategyStatus(paths, { schemaVersion: 1, requestId: 'golden-gate-active', idempotencyKey: 'golden-gate-active', expectedRevision: 0, payload: { strategyId: 'strategy:golden-gate', status: 'active' } })
  const gateReadiness = readiness(paths, { intent: 'submit', subject: 'application:formco-director' })
  assert.equal(gateReadiness.ready, false)
  assert.equal(gateReadiness.submissionPlan.gates[0].blocked, true)

  // Outcome close: preserve the rejection without inventing an event date.
  const undatedClose = closeApplication(paths, { schemaVersion: 1, requestId: 'golden-undated-close', idempotencyKey: 'golden-undated-close', expectedRevision: 0, payload: { applicationId: 'application:acme-lead', lifecycleStatus: 'rejected', outcome: 'rejected', reason: 'Not selected at application screening.', stage: 'application_screening' } })
  assert.equal(undatedClose.unresolvedEvidence.length, 1)
  assert.equal(loadModel(paths).applications.find(item => item.id === 'application:acme-lead').closure.occurred_at, null)
})

const mutationEnvelope = {
  type: 'object',
  required: ['schemaVersion', 'requestId', 'idempotencyKey', 'payload'],
  properties: {
    schemaVersion: { const: 1 },
    requestId: { type: 'string', minLength: 1 },
    idempotencyKey: { type: 'string', minLength: 1 },
    actor: { type: 'string' },
    expectedRevision: { type: 'integer', minimum: 0 },
    payload: { type: 'object' }
  }
}

const derivedArtifactQaManifest = {
  type: 'object',
  required: ['schemaVersion', 'capabilityId', 'sourceSha256', 'artifactSha256', 'checks'],
  additionalProperties: false,
  properties: {
    schemaVersion: { const: 1 },
    capabilityId: { type: 'string', minLength: 1 },
    rendererVersion: { type: 'string' },
    templateId: { type: 'string' },
    templateVersion: { type: 'string' },
    sourceSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    artifactSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    checks: { type: 'object', required: ['structural', 'accessibility', 'parity', 'visual'], additionalProperties: false, properties: Object.fromEntries(['structural', 'accessibility', 'parity', 'visual'].map(name => [name, { enum: ['passed', 'failed', 'not_run'] }])) }
  }
}

const packageCompany = {
  type: 'object',
  required: ['id', 'name'],
  properties: {
    id: { type: 'string', pattern: '^company:' },
    name: { type: 'string', minLength: 1 }
  }
}

const packageOpportunity = {
  type: 'object',
  required: ['id', 'company_id', 'title', 'posting_state', 'pursuit_status', 'people_relations'],
  properties: {
    id: { type: 'string', pattern: '^opportunity:' },
    company_id: { type: 'string', pattern: '^company:' },
    title: { type: 'string', minLength: 1 },
    posting_state: { type: 'string' },
    pursuit_status: { enum: ['identified', 'evaluating', 'pursuing', 'preparing', 'ready_to_apply', 'applied', 'recruiter_screen', 'interview', 'offer', 'not_pursued', 'withdrawn', 'rejected', 'closed'] },
    people_relations: { type: 'array' }
  }
}

const packageApplicationAttempt = {
  type: 'object',
  required: ['id', 'opportunity_id', 'lifecycle_status', 'outcome', 'storage_scope', 'record_state', 'people_relations'],
  properties: {
    id: { type: 'string', pattern: '^application-attempt:' },
    opportunity_id: { type: 'string', pattern: '^opportunity:' },
    lifecycle_status: { enum: ['preparing', 'ready_to_apply', 'applied', 'recruiter_screen', 'interview', 'offer', 'rejected', 'withdrawn', 'closed'] },
    outcome: { type: ['string', 'null'] },
    storage_scope: { enum: ['active', 'archive'] },
    record_state: { enum: ['complete', 'incomplete'] },
    people_relations: { type: 'array' }
  }
}

const packageArtifact = {
  type: 'object',
  required: ['kind', 'owner_type', 'path', 'document'],
  allOf: [{
    if: { properties: { owner_type: { const: 'shared' } } },
    then: {},
    else: { required: ['owner_id'] }
  }],
  properties: {
    id: { type: 'string', pattern: '^artifact:', description: 'Optional; generated when omitted.' },
    kind: { type: 'string', minLength: 1 },
    owner_type: { enum: ['application_attempt', 'opportunity', 'company', 'person', 'shared'] },
    owner_id: { type: 'typed-id', description: 'Required unless owner_type is shared.' },
    path: { type: 'string', description: 'Path relative to the Candidatures directory, for example artifacts/opportunities/example/file.md.' },
    document: {
      type: 'object',
      required: ['role', 'representation', 'state', 'version', 'primary'],
      properties: {
        role: { type: 'string', minLength: 1 },
        representation: { enum: ['canonical_markdown', 'generated_docx', 'user_edited_docx'] },
        state: { type: 'string', minLength: 1 },
        version: { type: 'integer', minimum: 1 },
        primary: { type: 'boolean' }
      }
    }
  }
}

const runManifest = {
  type: 'object',
  required: ['schemaVersion', 'runId', 'startedAt', 'completedAt', 'intent', 'stages'],
  additionalProperties: false,
  properties: {
    schemaVersion: { const: 1 }, runId: { type: 'string' }, startedAt: { type: 'string', format: 'date-time' }, completedAt: { type: 'string', format: 'date-time' }, intent: { type: 'string' }, subjectId: { type: 'string' }, sourceDigests: { type: 'array', items: { type: 'string', pattern: '^[a-f0-9]{64}$' } }, contextDigests: { type: 'array', items: { type: 'string', pattern: '^[a-f0-9]{64}$' } }, stages: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'durationMs'], properties: { id: { type: 'string' }, durationMs: { type: 'number', minimum: 0 }, toolFamily: { type: 'string' }, command: { type: 'string' }, errorCode: { type: 'string' }, retries: { type: 'integer', minimum: 0 }, cacheHit: { type: 'boolean' }, validationScope: { type: 'string' }, qaStatus: { type: 'string' } } } }
  }
}

const read = (options = {}, invariants = []) => ({ mode: 'read-only', options, invariants })
const localMutation = (options = {}, invariants = []) => ({ mode: 'mutation', options, invariants })
const dryRunInvariant = '--dry-run validates the envelope and returns the would-be result (status dry_run) without lock, write, audit, or ledger change.'
const mutation = (required, properties, invariants = [], { dryRun = true } = {}) => ({ mode: 'mutation', envelope: mutationEnvelope, payload: { type: 'object', required, properties }, invariants: dryRun ? [...invariants, dryRunInvariant] : invariants })

export const ERROR_TAXONOMY = Object.freeze({
  USAGE: 'Unknown command, positional, or option.',
  INVALID_JSON: 'Input is not valid JSON.',
  INVALID_ENVELOPE: 'Mutation envelope is missing or unsupported.',
  INVALID_COMMAND: 'Payload does not satisfy the command contract.',
  NOT_FOUND: 'A referenced typed entity does not exist.',
  STALE_REVISION: 'Optimistic revision or artifact digest changed.',
  COMMIT_BUSY: 'Another short commit currently owns the transaction lock.',
  IDEMPOTENCY_CONFLICT: 'An idempotency key was reused for different input.',
  MODEL_INVALID: 'The resulting relational model violates an invariant.',
  STALE_ARTIFACT: 'A selected artifact has an unadopted file revision.',
  INVALID_TRANSITION: 'The requested lifecycle or evidence transition is not allowed.',
  STRATEGY_REQUIREMENT_UNMET: 'A selected strategy blocks the requested action.',
  UNSAFE_PATH: 'A path escapes the configured vault boundary.',
  INTEGRATION_UNSUPPORTED: 'The platform, runtime, filesystem, or link type is unsupported.',
  INVALID_PRODUCT_ROOT: 'The selected product tree is missing or invalid.',
  INVALID_PROFILE_ROOT: 'The integration profile root is unsafe or invalid.',
  INVALID_WORKSPACE_ROOT: 'The workspace root is unsafe or invalid.',
  INTEGRATION_CONFLICT: 'Integration metadata or destination is unknown or incompatible.',
  INTEGRATION_DRIFT: 'A managed link points to an unexpected target.',
  INTEGRATION_BROKEN: 'A managed link or its target is missing.',
  INTEGRATION_BUSY: 'Another integration operation owns the profile lock.',
  INTEGRATION_RECOVERY_REQUIRED: 'An interrupted integration cannot be reconciled automatically.',
  INVALID_INSTANCE_CONFIG: 'The nearest nextstep.yaml marker is invalid.'
})

export const COMMAND_CONTRACTS = Object.freeze({
  capabilities: read({ json: { type: 'boolean' } }),
  'command describe': read({ command: { type: 'string', required: true }, json: { type: 'boolean' } }),
  'integration plan': read({ 'product-root': { type: 'absolute-path', required: true }, 'profile-root': { type: 'absolute-path', required: true }, 'workspace-root': { type: 'absolute-path' }, 'manage-user-path': { type: 'boolean' }, json: { type: 'boolean' } }, ['Read-only preview; never creates links or metadata.']),
  'integration link': localMutation({ 'product-root': { type: 'absolute-path', required: true }, 'profile-root': { type: 'absolute-path', required: true }, 'workspace-root': { type: 'absolute-path' }, 'manage-user-path': { type: 'boolean' }, json: { type: 'boolean' } }, ['Creates only managed integration metadata and directory junctions; never copies product files.']),
  'integration status': read({ 'profile-root': { type: 'absolute-path', required: true }, 'workspace-root': { type: 'absolute-path' }, json: { type: 'boolean' } }),
  'integration unlink': localMutation({ 'profile-root': { type: 'absolute-path', required: true }, 'workspace-root': { type: 'absolute-path' }, scope: { type: 'enum', values: ['skills'] }, 'dry-run': { type: 'boolean' }, json: { type: 'boolean' } }, ['Use --scope skills --dry-run to preview removal of registered workspace skills only; preserves CLI, PATH, project and data.']),
  'integration restore-skills': localMutation({ 'profile-root': { type: 'absolute-path', required: true }, 'dry-run': { type: 'boolean' }, json: { type: 'boolean' } }, ['Explicit rollback of the last workspace skill migration; never replaces conflicting destinations.']),
  'project plan': read({ 'data-root': { type: 'absolute-path', required: true }, 'instance-id': { type: 'string', required: true }, 'profile-root': { type: 'absolute-path', required: true }, json: { type: 'boolean' } }),
  'project link': localMutation({ 'data-root': { type: 'absolute-path', required: true }, 'instance-id': { type: 'string', required: true }, 'profile-root': { type: 'absolute-path', required: true }, json: { type: 'boolean' } }, ['Creates only nextstep.yaml and its ownership record.']),
  'project status': read({ 'data-root': { type: 'absolute-path' }, 'profile-root': { type: 'absolute-path', required: true }, json: { type: 'boolean' } }),
  'project unlink': localMutation({ 'data-root': { type: 'absolute-path', required: true }, 'profile-root': { type: 'absolute-path', required: true }, json: { type: 'boolean' } }, ['Removes only an unchanged marker owned by this installation.']),
  doctor: read({ 'data-root': { type: 'absolute-path' }, integration: { type: 'boolean' }, 'profile-root': { type: 'absolute-path' }, 'workspace-root': { type: 'absolute-path' }, json: { type: 'boolean' } }),
  'workflow templates': read({ category: { type: 'string' }, json: { type: 'boolean' } }),
  'workflow template': read({ id: { type: 'string', required: true }, json: { type: 'boolean' } }),
  'context build': read({ 'data-root': { type: 'absolute-path' }, intent: { enum: ['analyze', 'outreach', 'drafting', 'application', 'interview'], required: true }, subject: { type: 'typed-id' }, task: { type: 'string' }, budget: { enum: ['small', 'standard', 'deep'] }, strategy: { type: 'typed-id' } }, ['Read-only; assembles context for the intent without mutating state.', 'Intent package is not accepted here; use readiness --intent package and application-attempt submission-plan for package work.']),
  get: read({ 'data-root': { type: 'absolute-path' }, id: { type: 'typed-id', required: true } }),
  validate: read({ 'data-root': { type: 'absolute-path' }, scope: { type: 'string' } }),
  readiness: read({ 'data-root': { type: 'absolute-path' }, intent: { enum: ['analyze', 'outreach', 'package', 'submit', 'close'], required: true }, subject: { type: 'typed-id', required: true } }, ['Advisory only; it never selects a strategy or authorizes a mutation.']),
  'entity upsert': mutation(['type', 'record'], { type: { enum: ['company', 'opportunity', 'application_attempt', 'person', 'interaction'] }, record: { type: 'object' } }),
  'strategy definitions': read({ category: { type: 'string' } }),
  'strategy definition': read({ id: { type: 'typed-id', required: true } }),
  'strategy list': read({ 'data-root': { type: 'absolute-path' }, status: { type: 'string' }, definition: { type: 'typed-id' }, subject: { type: 'typed-id' } }),
  'strategy get': read({ 'data-root': { type: 'absolute-path' }, id: { type: 'typed-id', required: true } }),
  'strategy guide': read({ 'data-root': { type: 'absolute-path' }, id: { type: 'typed-id', required: true }, phase: { type: 'string' }, subject: { type: 'typed-id' } }),
  'strategy evaluate': read({ 'data-root': { type: 'absolute-path' }, id: { type: 'typed-id', required: true } }),
  'strategy create': mutation(['record'], { record: { type: 'object' } }),
  'strategy update': mutation(['strategyId', 'changes'], { strategyId: { type: 'typed-id' }, changes: { type: 'object' } }, ['Envelope expectedRevision is required.']),
  'strategy set-status': mutation(['strategyId', 'status'], { strategyId: { type: 'typed-id' }, status: { enum: ['active', 'paused', 'completed', 'abandoned'] }, conclusion: { type: 'string' }, closedAt: { type: 'date-time' } }, ['Envelope expectedRevision is required.']),
  'experiment list': read({ 'data-root': { type: 'absolute-path' }, status: { type: 'string' }, strategy: { type: 'typed-id' } }),
  'experiment get': read({ 'data-root': { type: 'absolute-path' }, id: { type: 'typed-id', required: true } }),
  'experiment evaluate': read({ 'data-root': { type: 'absolute-path' }, id: { type: 'typed-id', required: true } }),
  'experiment create': mutation(['record'], { record: { type: 'object' } }),
  'experiment update': mutation(['experimentId', 'changes'], { experimentId: { type: 'typed-id' }, changes: { type: 'object' } }, ['Envelope expectedRevision is required.']),
  'experiment set-status': mutation(['experimentId', 'status'], { experimentId: { type: 'typed-id' }, status: { enum: ['running', 'paused', 'completed', 'abandoned'] }, conclusion: { type: 'string' }, closedAt: { type: 'date-time' } }, ['Envelope expectedRevision is required.']),
  'artifact status': read({ 'data-root': { type: 'absolute-path' }, artifact: { type: 'typed-id' }, 'application-attempt': { type: 'typed-id' }, all: { type: 'boolean' } }, ['Exactly one scope is required.']),
  'artifact contract-check': read({ 'data-root': { type: 'absolute-path' }, artifact: { type: 'typed-id', required: true }, template: { type: 'typed-id', required: true } }, ['Read-only; checks the registered artifact against a workflow template contract and never edits the file.', 'List template ids with workflow templates.']),
  'artifact register': mutation(['record'], { record: { type: 'object' } }),
  'artifact adopt': mutation(['artifactId', 'authorship'], { artifactId: { type: 'typed-id' }, authorship: { enum: ['user', 'ai', 'mixed'] }, expectedSha256: { type: 'sha256' } }),
  'artifact remove': mutation(['artifactId', 'reason'], { artifactId: { type: 'typed-id' }, reason: { type: 'string' } }, ['Removes only the record of an artifact whose file is already missing, with no preserved revisions and no interaction references.']),
  'artifact record-qa': mutation(['artifactId', 'manifest'], { artifactId: { type: 'typed-id' }, expectedSha256: { type: 'sha256' }, manifest: derivedArtifactQaManifest }, ['QA evidence is metadata; rendering remains external.']),
  'artifact bootstrap-snapshots': mutation([], {}),
  'interaction record': mutation(['record'], { record: { type: 'object' }, channel: { type: 'string' }, recipient: { type: 'typed-id' }, objective: { type: 'string' }, messageArtifactId: { type: 'typed-id' }, strategyIds: { type: 'array' }, experimentId: { type: 'typed-id' }, cohortId: { type: 'string' } }),
  'opportunity record-decision': mutation(['subjectId', 'decision', 'decidedAt', 'reasonCodes'], { subjectId: { type: 'typed-id' }, decision: { enum: ['pursue', 'calibrate', 'not_pursued', 'closed', 'ineligible'] }, decidedAt: { type: 'date-time' }, reasonCodes: { type: 'array', items: { type: 'string' }, minItems: 1 }, note: { type: 'string' }, decisionSource: { enum: ['user', 'agent_recommendation', 'user_directed_exception'] }, originalRecommendation: { enum: ['go', 'calibrate_first', 'stop'] }, rationale: { type: 'string' } }, ['A user_directed_exception requires originalRecommendation and rationale.']),
  'outreach record-sent': mutation(['channel', 'recipient', 'objective', 'occurredAt'], { channel: { type: 'string' }, recipient: { type: 'typed-id' }, objective: { type: 'string' }, occurredAt: { type: 'date-time' }, personIds: { type: 'array' }, companyId: { type: 'typed-id' }, opportunityId: { type: 'typed-id' }, applicationAttemptId: { type: 'typed-id' }, messageArtifactId: { type: 'typed-id' }, interactionId: { type: 'typed-id' }, strategyIds: { type: 'array' }, experimentId: { type: 'typed-id' }, cohortId: { type: 'string' } }),
  'application-attempt register-package': mutation([], { records: { type: 'object', properties: { company: packageCompany, opportunity: packageOpportunity, applicationAttempt: packageApplicationAttempt } }, artifacts: { type: 'array', items: packageArtifact } }, ['At least one record or artifact is required.', 'Creates only missing records and registers existing files contained by the vault atomically; drafting remains external.', 'Artifact paths are relative to the Candidatures directory.']),
  'application-attempt submission-plan': read({ 'data-root': { type: 'absolute-path' }, id: { type: 'typed-id', required: true } }, ['Advisory only; the caller must explicitly state whether transmitted artifacts are unknown, confirmed absent, or confirmed by ID.']),
  'application-attempt record-submission': mutation(['applicationAttemptId', 'channel', 'artifactSelection'], { applicationAttemptId: { type: 'typed-id' }, channel: { type: 'string' }, occurredAt: { type: 'date-time' }, occurredOn: { type: 'date' }, artifactSelection: { type: 'object', required: ['state'], properties: { state: { enum: ['unknown', 'confirmed_none', 'confirmed'] }, artifactIds: { type: 'array', items: { type: 'typed-id' } } } }, interactionId: { type: 'typed-id' }, note: { type: 'string' }, strategyIds: { type: 'array' }, experimentId: { type: 'typed-id' }, cohortId: { type: 'string' } }, ['Supply exactly one of occurredAt or occurredOn. Artifact IDs are required only for a confirmed selection.']),
  'application-attempt reconcile-submission': mutation(['submissionId', 'artifactSelection'], { submissionId: { type: 'typed-id' }, artifactSelection: { type: 'object', required: ['state'], properties: { state: { enum: ['confirmed_none', 'confirmed'] }, artifactIds: { type: 'array', items: { type: 'typed-id' } } } } }, ['Envelope expectedRevision is required. Only an unknown artifact selection can be reconciled.']),
  'application-attempt close': mutation(['applicationAttemptId', 'lifecycleStatus', 'outcome', 'reason'], { applicationAttemptId: { type: 'typed-id' }, lifecycleStatus: { enum: ['rejected', 'withdrawn', 'closed'] }, outcome: { type: 'string' }, reason: { type: 'string' }, stage: { type: 'string' }, occurredAt: { type: 'date-time' }, evidenceSource: { type: 'string' } }, ['Envelope expectedRevision is required; occurredAt is optional and is never inferred.']),
  'run record': mutation(['run'], { run: runManifest }, ['Writes disposable operational state only and rejects content-bearing fields.'], { dryRun: false }),
  'run list': read({ 'data-root': { type: 'absolute-path' }, limit: { type: 'integer', minimum: 1, maximum: 100 } })
})

export function commandNames() { return Object.keys(COMMAND_CONTRACTS) }

export function describeCommand(name) {
  const contract = COMMAND_CONTRACTS[name]
  if (!contract) {
    const near = commandNames().filter(item => item.includes(String(name)) || String(name).includes(item) || item.split(' ').some(part => String(name).split(' ').includes(part))).slice(0, 5)
    throw Object.assign(new Error(`Command not found: ${name}${near.length ? `. Did you mean: ${near.join(', ')}?` : ''}`), { code: 'NOT_FOUND', details: near.length ? { suggestions: near } : undefined })
  }
  return { schemaVersion: 1, status: 'ok', command: name, contract, errorTaxonomy: ERROR_TAXONOMY }
}

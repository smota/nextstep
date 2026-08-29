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

const runManifest = {
  type: 'object',
  required: ['schemaVersion', 'runId', 'startedAt', 'completedAt', 'intent', 'stages'],
  additionalProperties: false,
  properties: {
    schemaVersion: { const: 1 }, runId: { type: 'string' }, startedAt: { type: 'string', format: 'date-time' }, completedAt: { type: 'string', format: 'date-time' }, intent: { type: 'string' }, subjectId: { type: 'string' }, sourceDigests: { type: 'array', items: { type: 'string', pattern: '^[a-f0-9]{64}$' } }, contextDigests: { type: 'array', items: { type: 'string', pattern: '^[a-f0-9]{64}$' } }, stages: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'durationMs'], properties: { id: { type: 'string' }, durationMs: { type: 'number', minimum: 0 }, toolFamily: { type: 'string' }, command: { type: 'string' }, errorCode: { type: 'string' }, retries: { type: 'integer', minimum: 0 }, cacheHit: { type: 'boolean' }, validationScope: { type: 'string' }, qaStatus: { type: 'string' } } } }
  }
}

const read = (options = {}, invariants = []) => ({ mode: 'read-only', options, invariants })
const mutation = (required, properties, invariants = []) => ({ mode: 'mutation', envelope: mutationEnvelope, payload: { type: 'object', required, properties }, invariants })

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
  STRATEGY_REQUIREMENT_UNMET: 'A selected strategy blocks the requested action.',
  UNSAFE_PATH: 'A path escapes the configured vault boundary.'
})

export const COMMAND_CONTRACTS = Object.freeze({
  capabilities: read({ json: { type: 'boolean' } }),
  'command describe': read({ command: { type: 'string', required: true }, json: { type: 'boolean' } }),
  doctor: read({ 'data-root': { type: 'absolute-path' }, json: { type: 'boolean' } }),
  'workflow templates': read({ category: { type: 'string' }, json: { type: 'boolean' } }),
  'workflow template': read({ id: { type: 'string', required: true }, json: { type: 'boolean' } }),
  'context build': read({ 'data-root': { type: 'absolute-path' }, intent: { enum: ['analyze', 'outreach', 'drafting', 'application', 'interview'], required: true }, subject: { type: 'typed-id' }, task: { type: 'string' }, budget: { enum: ['small', 'standard', 'deep'] }, strategy: { type: 'typed-id' } }),
  get: read({ 'data-root': { type: 'absolute-path' }, id: { type: 'typed-id', required: true } }),
  validate: read({ 'data-root': { type: 'absolute-path' }, scope: { type: 'string' } }),
  readiness: read({ 'data-root': { type: 'absolute-path' }, intent: { enum: ['analyze', 'outreach', 'package', 'submit', 'close'], required: true }, subject: { type: 'typed-id', required: true } }, ['Advisory only; it never selects a strategy or authorizes a mutation.']),
  'entity upsert': mutation(['type', 'record'], { type: { enum: ['company', 'vacancy', 'application', 'person', 'interaction'] }, record: { type: 'object' } }),
  'strategy definitions': read({ category: { type: 'string' } }),
  'strategy definition': read({ id: { type: 'typed-id', required: true } }),
  'strategy list': read({ 'data-root': { type: 'absolute-path' }, status: { type: 'string' }, definition: { type: 'typed-id' }, subject: { type: 'typed-id' } }),
  'strategy get': read({ 'data-root': { type: 'absolute-path' }, id: { type: 'typed-id', required: true } }),
  'strategy guide': read({ 'data-root': { type: 'absolute-path' }, id: { type: 'typed-id', required: true }, phase: { type: 'string' }, subject: { type: 'typed-id' } }),
  'strategy evaluate': read({ 'data-root': { type: 'absolute-path' }, id: { type: 'typed-id', required: true } }),
  'strategy initialize': mutation([], {}),
  'strategy create': mutation(['record'], { record: { type: 'object' } }),
  'strategy update': mutation(['strategyId', 'changes'], { strategyId: { type: 'typed-id' }, changes: { type: 'object' } }, ['Envelope expectedRevision is required.']),
  'strategy set-status': mutation(['strategyId', 'status'], { strategyId: { type: 'typed-id' }, status: { enum: ['active', 'paused', 'completed', 'abandoned'] }, conclusion: { type: 'string' }, closedAt: { type: 'date-time' } }, ['Envelope expectedRevision is required.']),
  'experiment list': read({ 'data-root': { type: 'absolute-path' }, status: { type: 'string' }, strategy: { type: 'typed-id' } }),
  'experiment get': read({ 'data-root': { type: 'absolute-path' }, id: { type: 'typed-id', required: true } }),
  'experiment evaluate': read({ 'data-root': { type: 'absolute-path' }, id: { type: 'typed-id', required: true } }),
  'experiment create': mutation(['record'], { record: { type: 'object' } }),
  'experiment update': mutation(['experimentId', 'changes'], { experimentId: { type: 'typed-id' }, changes: { type: 'object' } }, ['Envelope expectedRevision is required.']),
  'experiment set-status': mutation(['experimentId', 'status'], { experimentId: { type: 'typed-id' }, status: { enum: ['running', 'paused', 'completed', 'abandoned'] }, conclusion: { type: 'string' }, closedAt: { type: 'date-time' } }, ['Envelope expectedRevision is required.']),
  'artifact status': read({ 'data-root': { type: 'absolute-path' }, artifact: { type: 'typed-id' }, application: { type: 'typed-id' }, all: { type: 'boolean' } }, ['Exactly one scope is required.']),
  'artifact register': mutation(['record'], { record: { type: 'object' } }),
  'artifact adopt': mutation(['artifactId', 'authorship'], { artifactId: { type: 'typed-id' }, authorship: { enum: ['user', 'ai', 'mixed'] }, expectedSha256: { type: 'sha256' } }),
  'artifact record-qa': mutation(['artifactId', 'manifest'], { artifactId: { type: 'typed-id' }, expectedSha256: { type: 'sha256' }, manifest: derivedArtifactQaManifest }, ['QA evidence is metadata; rendering remains external.']),
  'artifact bootstrap-snapshots': mutation([], {}),
  'interaction record': mutation(['record'], { record: { type: 'object' }, channel: { type: 'string' }, recipient: { type: 'typed-id' }, objective: { type: 'string' }, messageArtifactId: { type: 'typed-id' }, strategyIds: { type: 'array' }, experimentId: { type: 'typed-id' }, cohortId: { type: 'string' } }),
  'opportunity record-decision': mutation(['subjectId', 'decision', 'decidedAt', 'reasonCodes'], { subjectId: { type: 'typed-id' }, decision: { enum: ['pursue', 'calibrate', 'not_pursued', 'closed', 'ineligible'] }, decidedAt: { type: 'date-time' }, reasonCodes: { type: 'array', items: { type: 'string' }, minItems: 1 }, note: { type: 'string' }, decisionSource: { enum: ['user', 'agent_recommendation', 'user_directed_exception'] }, originalRecommendation: { enum: ['go', 'calibrate_first', 'stop'] }, rationale: { type: 'string' } }, ['A user_directed_exception requires originalRecommendation and rationale.']),
  'outreach record-sent': mutation(['channel', 'recipient', 'objective', 'occurredAt'], { channel: { type: 'string' }, recipient: { type: 'typed-id' }, objective: { type: 'string' }, occurredAt: { type: 'date-time' }, personIds: { type: 'array' }, companyId: { type: 'typed-id' }, vacancyId: { type: 'typed-id' }, applicationId: { type: 'typed-id' }, messageArtifactId: { type: 'typed-id' }, interactionId: { type: 'typed-id' }, strategyIds: { type: 'array' }, experimentId: { type: 'typed-id' }, cohortId: { type: 'string' } }),
  'application register-package': mutation([], { records: { type: 'object', properties: { company: { type: 'object' }, vacancy: { type: 'object' }, application: { type: 'object' } } }, artifacts: { type: 'array', items: { type: 'object' } } }, ['Creates only missing records and registers existing contained files atomically; drafting remains external.']),
  'application submission-plan': read({ 'data-root': { type: 'absolute-path' }, id: { type: 'typed-id', required: true } }, ['Advisory only; explicit artifact IDs remain required for submission.']),
  'application record-submission': mutation(['applicationId', 'channel', 'occurredAt', 'artifactIds'], { applicationId: { type: 'typed-id' }, channel: { type: 'string' }, occurredAt: { type: 'date-time' }, artifactIds: { type: 'array', items: { type: 'typed-id' } }, interactionId: { type: 'typed-id' }, note: { type: 'string' }, strategyIds: { type: 'array' }, experimentId: { type: 'typed-id' }, cohortId: { type: 'string' } }),
  'application close': mutation(['applicationId', 'lifecycleStatus', 'outcome', 'reason'], { applicationId: { type: 'typed-id' }, lifecycleStatus: { enum: ['rejected', 'withdrawn', 'archived'] }, outcome: { type: 'string' }, reason: { type: 'string' }, stage: { type: 'string' }, occurredAt: { type: 'date-time' }, evidenceSource: { type: 'string' } }, ['Envelope expectedRevision is required; occurredAt is optional and is never inferred.']),
  'run record': mutation(['run'], { run: runManifest }, ['Writes disposable operational state only and rejects content-bearing fields.']),
  'run list': read({ 'data-root': { type: 'absolute-path' }, limit: { type: 'integer', minimum: 1, maximum: 100 } })
})

export function commandNames() { return Object.keys(COMMAND_CONTRACTS) }

export function describeCommand(name) {
  const contract = COMMAND_CONTRACTS[name]
  if (!contract) throw Object.assign(new Error(`Command not found: ${name}`), { code: 'NOT_FOUND' })
  return { schemaVersion: 1, status: 'ok', command: name, contract, errorTaxonomy: ERROR_TAXONOMY }
}

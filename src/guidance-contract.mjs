import { GUIDANCE_OPERATIONS, GUIDANCE_RULES } from './guidance.mjs'
const text = maxLength => ({ type: 'string', minLength: 1, maxLength })
const object = (properties, required) => ({ type: 'object', additionalProperties: false, required, properties })
const criterion = { enum: Object.keys(GUIDANCE_RULES) }
const scope = { type: 'string', pattern: '^(shared|conversation|(?:company|opportunity|application-attempt|person|artifact):[a-zA-Z0-9][a-zA-Z0-9._-]*)$' }
const source = object({ kind: { enum: ['user', 'agent', 'external'] }, reference: text(512) }, ['kind', 'reference'])
const dependencies = { type: 'object', maxProperties: 24, propertyNames: text(256), additionalProperties: { type: 'string', pattern: '^[a-f0-9]{64}$' } }
export const answerSchema = object({ id: text(256), criterion, scope, kind: { enum: ['fact', 'preference', 'hypothesis', 'decision'] }, state: { enum: ['answered', 'unknown', 'deferred', 'declined'] }, value: text(4096), source, dependencies, recordedAt: { type: 'string', format: 'date-time' }, supersedes: text(256) }, ['id', 'criterion', 'scope', 'kind', 'state', 'source'])
export const guidanceRequestSchema = object({
  schemaVersion: { const: 1 }, operation: { enum: GUIDANCE_OPERATIONS }, subject: { type: 'typed-id' },
  observations: { type: 'array', maxItems: 128, items: object({ criterion, state: { enum: ['known', 'unknown', 'conflict'] }, source, dependencies, required: { type: 'boolean' }, value: text(4096) }, ['criterion', 'state', 'source']) },
  answers: { type: 'array', maxItems: 128, items: answerSchema }, briefIds: { type: 'array', maxItems: 128, items: { type: 'string', pattern: '^artifact:' } },
  essentialOnly: { type: 'boolean' }, optionalRounds: { type: 'integer', minimum: 0 }, deepen: { type: 'boolean' }, maxQuestions: { type: 'integer', minimum: 0, maximum: 3 }
}, ['schemaVersion', 'operation'])
export const guidanceBriefSchema = object({ schemaVersion: { const: 1 }, scope: { ...scope, not: { const: 'conversation' } }, answers: { type: 'array', maxItems: 128, items: { ...answerSchema, properties: { ...answerSchema.properties, id: text(128) } } } }, ['schemaVersion', 'scope', 'answers'])

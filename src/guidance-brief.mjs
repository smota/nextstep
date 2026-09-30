import { bounded, fields, invalid, isScope, validateAnswer, GUIDANCE_LIMITS } from './guidance.mjs'

export function normalizeGuidanceBrief(brief) {
  bounded(brief)
  fields(brief, ['schemaVersion', 'scope', 'answers'], 'brief')
  if (brief.schemaVersion !== 1 || !isScope(brief.scope) || brief.scope === 'conversation') invalid('A durable brief requires schemaVersion 1 and an explicit shared or entity scope')
  if (!Array.isArray(brief.answers) || brief.answers.length > GUIDANCE_LIMITS.entries) invalid('A brief supports at most 128 answers')
  const ids = new Set()
  for (const answer of brief.answers) {
    validateAnswer(answer)
    if (answer.scope !== brief.scope || ids.has(answer.id)) invalid('Brief answers must have its scope and unique IDs')
    if (answer.id.length > 128) invalid('Persisted answer IDs must be at most 128 characters')
    if (answer.supersedes && !ids.has(answer.supersedes)) invalid('supersedes must refer to an earlier answer in the brief')
    if (answer.supersedes && brief.answers.find(a => a.id === answer.supersedes).criterion !== answer.criterion) invalid('Supersession must retain its criterion')
    ids.add(answer.id)
  }
  return structuredClone(brief)
}

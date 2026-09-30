export const GUIDANCE_LIMITS = Object.freeze({ bytes: 131072, entries: 128, valueChars: 4096 })
export const GUIDANCE_OPERATIONS = ['evaluate', 'draft', 'review', 'submit', 'follow_up', 'interview', 'decide', 'reflect']
export const GUIDANCE_RULES = Object.freeze({
  intent: { answerer: 'applicant', question: 'What would you like this work to achieve?', consequence: 'Select relevant evidence and the next useful action.' },
  mandate: { answerer: 'researcher', question: 'What decisions and resources does the role own?', consequence: 'Clarify employer scope before judging career fit.' },
  career_tradeoff: { answerer: 'applicant', question: 'Would this move still interest you with this scope?', consequence: 'Respect a deliberate career choice rather than infer a mismatch.' },
  channel: { answerer: 'researcher', question: 'What format and limits does the actual application channel require?', consequence: 'Prepare the right deliverable.' },
  contribution: { answerer: 'applicant', question: 'What should the reader understand about your contribution?', consequence: 'Refine the opening in the applicant’s chosen style.' },
  claim: { answerer: 'applicant', question: 'What did you personally do, and what changed?', consequence: 'Distinguish individual work, team outcomes and unmeasured benefits.' },
  relationship: { answerer: 'applicant', question: 'How do you know this person, and what would you like to achieve?', consequence: 'Adapt language, warmth and request.' },
  hiring_authority: { answerer: 'researcher', question: 'Is the contact’s role in hiring established?', consequence: 'Avoid assuming hiring or referral authority.' },
  presentation: { answerer: 'applicant', question: 'Is there a presentation preference that matters for this deliverable?', consequence: 'Apply a scoped preference within channel requirements.' },
  decision: { answerer: 'applicant', question: 'Has this opportunity met the conditions that matter to you?', consequence: 'Support the applicant’s own decision criteria.' },
  context: { answerer: 'maintainer', question: 'Which retrieval diagnostic must be resolved to restore the available context?', consequence: 'Repair context retrieval before asking the applicant to repeat known information.' }
})

export function invalid(message, code = 'INVALID_COMMAND') { throw Object.assign(new Error(message), { code }) }
export function fields(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${label} must be an object`)
  for (const key of Object.keys(value)) if (!allowed.includes(key)) invalid(`${label}: unknown field ${key}`)
}
export function bounded(value) {
  if (new TextEncoder().encode(JSON.stringify(value)).length > GUIDANCE_LIMITS.bytes) invalid('Guidance input exceeds 128 KiB')
}
const text = (value, max = 4096) => typeof value === 'string' && value.trim().length > 0 && value.length <= max
export const isScope = value => value === 'shared' || value === 'conversation' || /^(?:company|opportunity|application-attempt|person|artifact):[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value || '')
export function validateSource(source) {
  fields(source, ['kind', 'reference'], 'source')
  if (!['user', 'agent', 'external'].includes(source.kind) || !text(source.reference, 512)) invalid('Source requires kind and a bounded reference')
}
export function validateDependencies(value = {}) {
  fields(value, value && typeof value === 'object' ? Object.keys(value) : [], 'dependencies')
  if (Object.keys(value).length > 24 || Object.entries(value).some(([key, digest]) => !text(key, 256) || !/^[a-f0-9]{64}$/.test(digest))) invalid('Dependencies require at most 24 named SHA-256 digests')
}
const equivalent = (a, b) => JSON.stringify(Object.entries(a || {}).sort()) === JSON.stringify(Object.entries(b || {}).sort())

export function validateAnswer(answer) {
  fields(answer, ['id', 'criterion', 'scope', 'kind', 'state', 'value', 'source', 'dependencies', 'recordedAt', 'supersedes'], 'answer')
  if (!text(answer.id, 256) || !Object.hasOwn(GUIDANCE_RULES, answer.criterion) || !isScope(answer.scope)) invalid('Answer requires id, known criterion, and scope')
  if (!['fact', 'preference', 'hypothesis', 'decision'].includes(answer.kind) || !['answered', 'unknown', 'deferred', 'declined'].includes(answer.state)) invalid('Invalid answer kind or state')
  if (answer.state === 'answered' ? !text(answer.value) : answer.value != null) invalid('Only answered entries carry a non-empty value (maximum 4096 characters)')
  if (answer.recordedAt != null && !Number.isFinite(Date.parse(answer.recordedAt))) invalid('Invalid answer recordedAt')
  if (answer.supersedes != null && !text(answer.supersedes, 256)) invalid('Invalid superseded answer ID')
  validateSource(answer.source); validateDependencies(answer.dependencies)
  return answer
}

export function validateGuidanceRequest(input) {
  bounded(input)
  fields(input, ['schemaVersion', 'operation', 'subject', 'observations', 'answers', 'briefIds', 'essentialOnly', 'optionalRounds', 'deepen', 'maxQuestions'], 'guidance')
  if (input.schemaVersion !== 1 || !GUIDANCE_OPERATIONS.includes(input.operation)) invalid('Guidance requires schemaVersion 1 and a supported operation')
  if (input.subject != null && (!isScope(input.subject) || ['shared', 'conversation'].includes(input.subject))) invalid('subject must be a typed entity ID')
  for (const key of ['observations', 'answers', 'briefIds']) if (input[key] != null && (!Array.isArray(input[key]) || input[key].length > GUIDANCE_LIMITS.entries)) invalid(`${key} must be a bounded array`)
  if ((input.briefIds || []).some(id => typeof id !== 'string' || !/^artifact:[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id))) invalid('briefIds must be artifact IDs')
  for (const key of ['essentialOnly', 'deepen']) if (input[key] != null && typeof input[key] !== 'boolean') invalid(`${key} must be boolean`)
  if (input.optionalRounds != null && (!Number.isInteger(input.optionalRounds) || input.optionalRounds < 0)) invalid('optionalRounds must be a nonnegative integer')
  if (input.maxQuestions != null && (!Number.isInteger(input.maxQuestions) || input.maxQuestions < 0 || input.maxQuestions > 3)) invalid('maxQuestions must be 0-3')
  const criteria = new Set()
  for (const observation of input.observations || []) {
    fields(observation, ['criterion', 'state', 'source', 'dependencies', 'required', 'value'], 'observation')
    if (!Object.hasOwn(GUIDANCE_RULES, observation.criterion) || !['unknown', 'conflict', 'known'].includes(observation.state) || criteria.has(observation.criterion)) invalid('Observation criteria must be known and unique, with a valid state')
    criteria.add(observation.criterion)
    if (observation.required != null && typeof observation.required !== 'boolean') invalid('required must be boolean')
    if (observation.value != null && !text(observation.value)) invalid('Observation value must be bounded text')
    validateSource(observation.source); validateDependencies(observation.dependencies)
  }
  const ids = new Set()
  for (const answer of input.answers || []) {
    validateAnswer(answer)
    if (ids.has(answer.id)) invalid('Duplicate answer ID')
    ids.add(answer.id)
  }
  const byId = new Map((input.answers || []).map(a => [a.id, a]))
  for (const answer of input.answers || []) if (answer.supersedes) {
    const prior = byId.get(answer.supersedes)
    if (!prior || prior.id === answer.id || prior.criterion !== answer.criterion || prior.scope !== answer.scope) invalid('Supersession must target the same criterion and scope')
    const visited = new Set([answer.id]); let current = prior
    while (current) {
      if (visited.has(current.id)) invalid('Cyclic answer supersession')
      visited.add(current.id); current = byId.get(current.supersedes)
    }
  }
  return input
}

export function evaluateGuidance(input, { scopeChain = ['shared', ...(input.subject ? [input.subject] : []), 'conversation'] } = {}) {
  validateGuidanceRequest(input)
  const all = input.answers || [], superseded = new Set(all.map(a => a.supersedes).filter(Boolean))
  const answers = all.filter(a => !superseded.has(a.id) && scopeChain.includes(a.scope))
  const conflicts = [], effectiveAnswers = []
  for (const criterion of Object.keys(GUIDANCE_RULES)) {
    const relevant = answers.filter(a => a.criterion === criterion)
    const facts = relevant.filter(a => a.kind === 'fact' && a.state === 'answered')
    const narrowest = Math.max(-1, ...relevant.map(a => scopeChain.indexOf(a.scope)))
    const narrowed = relevant.filter(a => scopeChain.indexOf(a.scope) === narrowest)
    if (new Set(facts.map(a => a.value)).size > 1 || new Set(narrowed.filter(a => a.state === 'answered').map(a => a.value)).size > 1) conflicts.push({ criterion, reasonCode: 'ANSWER_CONFLICT', answerIds: relevant.map(a => a.id) })
    else effectiveAnswers.push(...narrowed)
  }
  const actions = [], suppressed = []
  const observations = [...(input.observations || [])]
  for (const conflict of conflicts) if (!observations.some(o => o.criterion === conflict.criterion)) observations.push({ criterion: conflict.criterion, state: 'conflict', source: { kind: 'agent', reference: 'scoped-answer-conflict' }, dependencies: {} })
  for (const observation of observations) {
    const rule = GUIDANCE_RULES[observation.criterion], conflicting = conflicts.some(c => c.criterion === observation.criterion) || observation.state === 'conflict'
    const known = effectiveAnswers.find(a => a.criterion === observation.criterion && a.kind !== 'hypothesis' && equivalent(a.dependencies, observation.dependencies))
    if (!conflicting && (observation.state === 'known' || known)) {
      suppressed.push({ criterion: observation.criterion, reasonCode: known ? `ANSWER_${known.state.toUpperCase()}` : 'KNOWN', answerId: known?.id }); continue
    }
    const required = observation.required === true
    if (rule.answerer === 'applicant' && !required && (input.essentialOnly || (input.optionalRounds >= 1 && !input.deepen))) {
      suppressed.push({ criterion: observation.criterion, reasonCode: 'OPTIONAL_COACHING_SKIPPED' }); continue
    }
    actions.push({ criterion: observation.criterion, reasonCode: conflicting ? 'CONFLICT' : observation.criterion === 'context' ? 'CONTEXT_REPAIR' : 'UNKNOWN', answerer: rule.answerer, consequence: rule.consequence, question: rule.question, required, source: observation.source, dependencies: observation.dependencies || {}, changedDependency: answers.some(a => a.criterion === observation.criterion && !equivalent(a.dependencies, observation.dependencies)) })
  }
  actions.sort((a, b) => Number(b.required) - Number(a.required) || Number(b.criterion === 'context') - Number(a.criterion === 'context') || Number(b.reasonCode === 'CONFLICT') - Number(a.reasonCode === 'CONFLICT') || a.criterion.localeCompare(b.criterion))
  const questions = actions.filter(a => a.answerer === 'applicant').slice(0, input.maxQuestions ?? 1)
  const staleAnswers = effectiveAnswers.filter(a => observations.some(o => o.criterion === a.criterion && !equivalent(a.dependencies, o.dependencies)))
  return { schemaVersion: 1, status: 'ok', advisory: true, operation: input.operation, actions: actions.filter(a => a.answerer !== 'applicant'), questions, remainingQuestionCount: actions.filter(a => a.answerer === 'applicant').length - questions.length, effectiveAnswers: effectiveAnswers.filter(a => !staleAnswers.includes(a)), staleAnswers, conflicts, suppressed }
}

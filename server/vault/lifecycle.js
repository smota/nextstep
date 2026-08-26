export const LIFECYCLE_STATUSES = Object.freeze([
  'identified', 'to_apply', 'applied', 'recruiter_screen', 'interview', 'offer',
  'rejected', 'withdrawn', 'archived',
])

export const TERMINAL_STATUSES = new Set(['rejected', 'withdrawn', 'archived'])

// Canonical transition truth. Readiness never changes or restricts lifecycle.
export const TRANSITIONS = Object.freeze({
  identified: Object.freeze(['to_apply', 'rejected', 'withdrawn', 'archived']),
  to_apply: Object.freeze(['applied', 'rejected', 'withdrawn', 'archived']),
  applied: Object.freeze(['recruiter_screen', 'rejected', 'withdrawn', 'archived']),
  recruiter_screen: Object.freeze(['interview', 'rejected', 'withdrawn', 'archived']),
  interview: Object.freeze(['offer', 'rejected', 'withdrawn', 'archived']),
  offer: Object.freeze(['rejected', 'withdrawn', 'archived']),
  rejected: Object.freeze(['identified', 'archived']),
  withdrawn: Object.freeze(['identified', 'archived']),
  archived: Object.freeze(['identified']),
})

const RECOMMENDED = Object.freeze({ identified: 'to_apply', to_apply: 'applied', applied: 'recruiter_screen', recruiter_screen: 'interview', interview: 'offer' })

export function validateTransition(current, target) {
  if (!LIFECYCLE_STATUSES.includes(current)) throw Object.assign(new Error(`Unknown current lifecycle status: ${current ?? 'unset'}`), { statusCode: 409 })
  if (!LIFECYCLE_STATUSES.includes(target)) throw Object.assign(new Error('Invalid application status'), { statusCode: 400 })
  if (!(TRANSITIONS[current] || []).includes(target)) throw Object.assign(new Error(`Invalid lifecycle transition: ${current} -> ${target}`), { statusCode: 409 })
}

export function deriveLifecycle(application) {
  const status = application.status
  const valid = LIFECYCLE_STATUSES.includes(status)
  const allowedTransitions = valid ? [...TRANSITIONS[status]] : []
  return {
    status,
    valid,
    terminal: valid && TERMINAL_STATUSES.has(status),
    logicallyArchived: status === 'archived' || Boolean(application.archived),
    allowedTransitions,
    recommendedTransition: valid ? (RECOMMENDED[status] || null) : null,
  }
}

export function deriveActions(lifecycle) {
  const allowed = new Set(lifecycle.allowedTransitions)
  return {
    advance: lifecycle.recommendedTransition ? { target: lifecycle.recommendedTransition } : null,
    close: ['rejected', 'withdrawn'].filter((target) => allowed.has(target)),
    archive: allowed.has('archived'),
    reopen: allowed.has('identified') ? { target: 'identified' } : null,
  }
}

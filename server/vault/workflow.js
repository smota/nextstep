import { hasExplicitJobSource, reuseCheckEvidence } from './evidence.js'
import { deriveActions, deriveLifecycle } from './lifecycle.js'

const STEP_DEFINITIONS = [
  ['job-source', 'Add the job description or source', (a) => hasExplicitJobSource(a)],
  ['fit', 'Run fit analysis', (a) => Boolean(a.artifacts?.fitAnalysis)],
  ['reuse-evidence', 'Review company and people evidence', (a) => reuseCheckEvidence(a).complete],
  ['dominant-narrative', 'Choose a dominant narrative', (a) => Boolean(a.dominantNarrative)],
  ['cv', 'Create or refresh CV', (a) => Boolean(a.artifacts?.cv)],
  ['cover-letter', 'Prepare cover letter', (a) => Boolean(a.artifacts?.coverLetter)],
  ['metadata-index', 'Complete application metadata and index', (a) => Boolean(a.metadataExists && a.artifacts?.index)],
]

export function derivePreparation(application) {
  const steps = STEP_DEFINITIONS.map(([id, label, check]) => ({ id, label, complete: check(application) }))
  const completed = steps.filter((step) => step.complete).length
  const firstMissing = steps.find((step) => !step.complete)
  const percent = Math.round(completed / steps.length * 100)
  const needsInput = steps.filter((step) => !step.complete && ['job-source', 'dominant-narrative'].includes(step.id)).map((step) => ({ step: step.id, message: step.label }))
  const lifecycle = deriveLifecycle(application)
  let state = completed === 0 ? 'not_started' : needsInput.length ? 'needs_input' : 'in_progress'
  if (lifecycle.terminal) state = 'closed'
  else if (!firstMissing) state = 'ready_for_next_step'
  return {
    state,
    percent,
    currentStep: lifecycle.terminal ? 'closed' : firstMissing?.id || 'advance',
    steps,
    needsInput,
    nextAction: lifecycle.terminal ? 'Application closed' : firstMissing?.label || 'Advance application',
  }
}

export function addWorkflowProjections(applications) {
  return applications.map((application) => {
    const lifecycle = deriveLifecycle(application)
    const preparation = derivePreparation(application)
    return { ...application, lifecycle, preparation, actions: deriveActions(lifecycle) }
  })
}

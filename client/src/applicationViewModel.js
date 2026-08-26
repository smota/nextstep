export const TERMINAL_LIFECYCLES = new Set(['rejected', 'withdrawn', 'archived'])

export function applicationScope(application) {
  return application.storageScope === 'archive' || (application.storageScope == null && application.archived) ? 'archive' : 'active'
}

export function applicationHref(application) {
  return `/opportunities/${application.slug}?scope=${applicationScope(application)}`
}

export function preparationView(preparation) {
  const completed = preparation.steps.filter((step) => step.complete).length
  return {
    completed,
    total: preparation.steps.length,
    percent: preparation.percent,
    valueText: `${completed} of ${preparation.steps.length} preparation steps`,
    helper: 'Process completeness — not role fit',
  }
}

const GATE_ACTIONS = Object.freeze({
  'job-source': { type: 'action', label: 'Add job source and analyze fit', action: 'generate-fit-analysis' },
  fit: { type: 'action', label: 'Generate fit analysis', action: 'generate-fit-analysis' },
  'reuse-evidence': { type: 'quick-update', label: 'Confirm company and people review', focus: 'application.recordReuseAssessment' },
  'dominant-narrative': { type: 'quick-update', label: 'Choose dominant narrative', focus: 'application.selectDominantNarrative' },
  cv: { type: 'action', label: 'Create tailored CV', action: 'create-cv' },
  'cover-letter': { type: 'action', label: 'Generate cover letter', action: 'generate-cover-letter' },
  'metadata-index': { type: 'quick-update', label: 'Repair application record', focus: 'application.repairRecord' },
})

export function applicationActionsView(application) {
  const terminal = application.lifecycle?.terminal || TERMINAL_LIFECYCLES.has(application.lifecycle?.status || application.status)
  const actions = application.actions || {}
  const firstMissing = application.preparation?.steps?.find(step => !step.complete)
  return {
    terminal,
    preparationWritable: !terminal,
    primary: terminal
      ? (actions.reopen ? { type: 'reopen', label: 'Reopen', target: actions.reopen.target } : null)
      : firstMissing
        ? GATE_ACTIONS[firstMissing.id] || { type: 'quick-update', label: `Complete ${firstMissing.label}`, focus: 'application.addNote' }
        : actions.advance
          ? { type: 'advance', label: 'Advance', target: actions.advance.target }
          : null,
  }
}

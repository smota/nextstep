function explicitValue(value) {
  if (typeof value === 'string') return value.trim().length > 0
  return value === true
}

export function hasExplicitJobSource(application) {
  return Boolean(application?.artifacts?.jobDescription || explicitValue(application?.jobSource))
}

export function reuseCheckEvidence(application) {
  const value = application?.reuseChecks
  if (value === true) return { complete: true, state: 'evidenced' }
  if (value === false) return { complete: false, state: 'incomplete' }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['complete', 'completed', 'done', 'checked', 'true', 'yes'].includes(normalized)) return { complete: true, state: 'evidenced' }
    if (['incomplete', 'pending', 'false', 'no'].includes(normalized)) return { complete: false, state: 'incomplete' }
  }
  return { complete: false, state: 'unknown' }
}

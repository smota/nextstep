// Selection preserves source text; interpretation belongs to the external client.
const CATEGORIES = Object.freeze({
  identity: ['profile/identity.md'],
  preferences: ['profile/preferences.md', 'profile/voice.md'],
  evidence: ['context/career.md', 'context/claims.md'],
  positioning: ['context/positioning.md'],
  examples: ['context/evidence.md', 'context/story-bank.md', 'context/leadership.md']
})

export function selectPersonalContext(data, intent, limits) {
  const categories = intent === 'analyze' ? ['identity', 'evidence', 'positioning', 'preferences'] : Object.keys(CATEGORIES)
  const sources = new Map((data?.self?.documents || []).map(document => [document.path, document]))
  // Interleave categories so a tiny budget does not disappear into the first category.
  const wanted = []
  for (let i = 0; i < 3; i++) for (const category of categories) {
    const sourcePath = CATEGORIES[category][i]
    if (sourcePath) wanted.push({ category, path: sourcePath })
  }
  const available = wanted.filter(item => typeof sources.get(item.path)?.content === 'string' && sources.get(item.path).content.length)
  const budget = limits.selfTotalChars ?? limits.selfCount * limits.selfChars
  const selected = available.slice(0, Math.floor(budget / 128))
  const allocations = new Map(selected.map(item => [item.path, 0]))
  let remaining = budget
  let active = [...selected]
  while (remaining > 0 && active.length) {
    const share = Math.max(1, Math.floor(remaining / active.length))
    for (const item of active) {
      const used = allocations.get(item.path)
      const amount = Math.min(share, sources.get(item.path).content.length - used, remaining)
      allocations.set(item.path, used + amount); remaining -= amount
    }
    active = active.filter(item => allocations.get(item.path) < sources.get(item.path).content.length)
  }
  const documents = selected.map(item => {
    const source = sources.get(item.path), content = source.content.slice(0, allocations.get(item.path))
    return { ...source, content, truncated: Boolean(source.truncated) || content.length < source.content.length }
  })
  const coverage = wanted.map(item => {
    const source = sources.get(item.path), document = documents.find(doc => doc.path === item.path)
    const status = !source?.content ? 'missing_at_source' : !document ? 'omitted_by_budget' : document.truncated ? 'truncated' : 'included'
    return { ...item, status, includedChars: document?.content.length || 0, ...(status === 'included' ? {} : { nextAction: status === 'missing_at_source' ? 'Retrieve available evidence through the personal-context provider; preserve unknowns.' : 'Request a deeper or targeted source excerpt before relying on missing evidence.' }) }
  })
  return { documents, coverage, textBudget: budget, selectedSources: documents.length }
}

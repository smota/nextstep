import fs from 'node:fs'

const catalogUrl = new URL('../catalog/strategy-definitions.json', import.meta.url)

function validateDefinition(definition, ids, sourceIds) {
  if (!definition?.id?.startsWith('strategy-definition:')) throw new Error('Strategy definition has an invalid ID')
  if (ids.has(definition.id)) throw new Error(`Duplicate strategy definition: ${definition.id}`)
  ids.add(definition.id)
  if (!Number.isInteger(definition.version) || definition.version < 1) throw new Error(`${definition.id} has an invalid version`)
  for (const field of ['label', 'category', 'purpose']) if (typeof definition[field] !== 'string' || !definition[field].trim()) throw new Error(`${definition.id} requires ${field}`)
  if (!Array.isArray(definition.phases) || !definition.phases.length) throw new Error(`${definition.id} requires phases`)
  const phases = new Set()
  for (const phase of definition.phases) {
    if (!phase?.id || phases.has(phase.id) || !Array.isArray(phase.actions) || !phase.actions.length || !Array.isArray(phase.completion_evidence)) throw new Error(`${definition.id} has an invalid phase`)
    phases.add(phase.id)
  }
  if (!Array.isArray(definition.metrics) || !definition.metrics.length || !Array.isArray(definition.guardrails)) throw new Error(`${definition.id} requires metrics and guardrails`)
  if (!Array.isArray(definition.source_refs) || definition.source_refs.some(id => !sourceIds.has(id))) throw new Error(`${definition.id} has invalid source references`)
}

export function loadStrategyCatalog() {
  const catalog = JSON.parse(fs.readFileSync(catalogUrl, 'utf8'))
  if (catalog.schema_version !== 1 || !Array.isArray(catalog.definitions) || !Array.isArray(catalog.sources)) throw new Error('Invalid strategy catalog')
  const sourceIds = new Set(catalog.sources.map(source => source.id))
  if (sourceIds.size !== catalog.sources.length || catalog.sources.some(source => !source.id || !source.title || !/^https:\/\//.test(source.url || ''))) throw new Error('Invalid strategy catalog sources')
  const ids = new Set()
  for (const definition of catalog.definitions) validateDefinition(definition, ids, sourceIds)
  return catalog
}

export function strategyDefinitions() { return loadStrategyCatalog().definitions }

export function strategyDefinition(id) { return strategyDefinitions().find(definition => definition.id === id) || null }

import fs from 'node:fs'
import path from 'node:path'
import { assertContained } from './config.mjs'
import { findEntity, loadModel, sha, shaFile } from './model.mjs'
import { mutate } from './storage.mjs'
import { bounded, evaluateGuidance, fields, invalid, validateGuidanceRequest } from './guidance.mjs'
import { normalizeGuidanceBrief } from './guidance-brief.mjs'

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value

function scopesFor(model, subject, visited = new Set()) {
  if (!subject) return ['shared', 'conversation']
  const found = findEntity(model, subject)
  if (!found) invalid(`Subject not found: ${subject}`, 'NOT_FOUND')
  if (visited.has(subject)) invalid('Cyclic subject ownership', 'MODEL_INVALID')
  visited.add(subject)
  const value = found.value
  const parent = value.owner_id || value.opportunity_id || value.company_id
  return [...new Set([...(parent ? scopesFor(model, parent, visited).filter(scope => scope !== 'conversation') : ['shared']), subject, 'conversation'])]
}

export function guidance(paths, raw, { model: suppliedModel } = {}) {
  const input = structuredClone(validateGuidanceRequest(raw))
  if (!input.subject && !(input.briefIds || []).length) return evaluateGuidance(input)
  if (!paths) invalid('A data root is required for registered subjects or briefs', 'DATA_ROOT_REQUIRED')
  const model = suppliedModel || loadModel(paths), scopeChain = scopesFor(model, input.subject)
  const explicit = new Set(input.briefIds || [])
  for (const id of explicit) if (!model.artifacts.some(a => a.id === id && a.kind === 'guidance_brief')) invalid(`Guidance brief not found: ${id}`, 'NOT_FOUND')
  const selected = model.artifacts.filter(a => a.kind === 'guidance_brief' && (explicit.has(a.id) || (a.owner_id && scopeChain.includes(a.owner_id)) || (a.subject_ids || []).some(id => scopeChain.includes(id))))
  for (const artifact of selected) {
    const file = assertContained(paths.candidaturesDir, path.resolve(paths.candidaturesDir, artifact.path))
    if (!fs.existsSync(file) || shaFile(file) !== artifact.sha256) invalid(`Guidance brief has a pending user revision: ${artifact.id}`, 'STALE_ARTIFACT')
    if (fs.statSync(file).size > 131072) invalid('Guidance brief exceeds 128 KiB')
    const brief = normalizeGuidanceBrief(JSON.parse(fs.readFileSync(file, 'utf8')))
    if (brief.scope !== 'shared' && !scopeChain.includes(brief.scope)) invalid('A brief from another subject cannot be silently reused', 'INVALID_COMMAND')
    // IDs are local to a brief; qualify them so two clients can use simple IDs safely.
    input.answers = [...(input.answers || []), ...brief.answers.map(a => ({ ...a, id: `${artifact.id}/${a.id}`, ...(a.supersedes ? { supersedes: `${artifact.id}/${a.supersedes}` } : {}) }))]
  }
  return { ...evaluateGuidance(input, { scopeChain }), briefRefs: selected.map(a => ({ id: a.id, sha256: a.sha256, revision: a.source_revision })) }
}

export function recordGuidance(paths, raw) {
  bounded(raw)
  fields(raw, ['schemaVersion', 'requestId', 'idempotencyKey', 'actor', 'expectedRevision', 'payload'], 'envelope')
  if (raw.schemaVersion !== 1) invalid('schemaVersion must be 1', 'INVALID_ENVELOPE')
  fields(raw.payload, ['artifactId', 'brief'], 'payload')
  const id = raw.payload.artifactId
  if (!/^artifact:[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(id || '')) invalid('artifactId must be a bounded typed ID')
  const brief = normalizeGuidanceBrief(raw.payload.brief)
  return mutate(paths, { ...raw, command: 'guidance.record' }, model => {
    if (brief.scope !== 'shared' && !findEntity(model, brief.scope)) invalid('Brief scope does not exist', 'NOT_FOUND')
    if (brief.scope === id) invalid('A brief cannot own itself')
    const existing = model.artifacts.find(a => a.id === id)
    if (existing && (existing.kind !== 'guidance_brief' || existing.source_revision !== raw.expectedRevision)) invalid('Brief revision changed or artifact ID is already in use', 'STALE_REVISION')
    if (!existing && raw.expectedRevision != null && raw.expectedRevision !== 0) invalid('New brief revision must be zero', 'STALE_REVISION')
    const relative = existing?.path || `artifacts/guidance/${id.slice(9)}.json`
    const file = assertContained(paths.artifactsDir, path.resolve(paths.candidaturesDir, relative), 'Guidance brief')
    if (!existing && (fs.existsSync(file) || model.artifacts.some(a => a.path === relative))) invalid('Guidance path is already owned', 'ARTIFACT_CONFLICT')
    let previous
    if (existing) {
      if (!fs.existsSync(file) || shaFile(file) !== existing.sha256) invalid('Adopt or reconcile the pending brief revision first', 'STALE_ARTIFACT')
      previous = normalizeGuidanceBrief(JSON.parse(fs.readFileSync(file, 'utf8')))
      if (previous.scope !== brief.scope) invalid('Create a new brief to change scope')
      for (const answer of previous.answers) if (JSON.stringify(canonical(brief.answers.find(a => a.id === answer.id))) !== JSON.stringify(canonical(answer))) invalid('Retain earlier answers; append an explicitly superseding answer')
    }
    const stamped = { ...brief, answers: brief.answers.map(a => ({ ...a, recordedAt: a.recordedAt || new Date().toISOString() })) }
    const bytes = Buffer.from(`${JSON.stringify(stamped, null, 2)}\n`), hash = sha(bytes)
    bounded(stamped)
    const snapshotPath = `artifacts/.versions/${id.slice(9)}/${hash}.json`
    const snapshot = assertContained(paths.artifactsDir, path.resolve(paths.candidaturesDir, snapshotPath))
    const owner = brief.scope === 'shared' ? { owner_type: 'shared' } : { owner_type: brief.scope.split(':')[0].replaceAll('-', '_'), owner_id: brief.scope }
    // Artifact scopes are relationships; Artifact is not an allowed owner type.
    if (owner.owner_type === 'artifact') { owner.owner_type = 'shared'; delete owner.owner_id }
    const revision = (existing?.source_revision || 0) + 1
    const record = { ...(existing || {}), id, kind: 'guidance_brief', ...owner, subject_ids: brief.scope === 'shared' ? [] : [brief.scope], path: relative, media_type: 'application/json', sha256: hash, size_bytes: bytes.length, source_revision: revision, revisions: [...(existing?.revisions || []), { version: revision, sha256: hash, snapshot_path: snapshotPath, committed_at: new Date().toISOString(), authorship: raw.actor || 'user', size_bytes: bytes.length }] }
    if (existing) Object.assign(existing, record); else model.artifacts.push(record)
    return { changedEntities: [id, ...(brief.scope === 'shared' ? [] : [brief.scope])], revision, extraOutputs: new Map([[file, bytes], [snapshot, bytes]]) }
  })
}

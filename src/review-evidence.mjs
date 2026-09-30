import crypto from 'node:crypto'
import { fields, invalid, bounded } from './guidance.mjs'
import { getWorkflowTemplate } from './workflow-templates.mjs'

export const templateDigest = id => crypto.createHash('sha256').update(JSON.stringify(getWorkflowTemplate(id).template)).digest('hex')
function finding(value) {
  fields(value, ['id', 'status', 'rationale', 'evidence'], 'review finding')
  if (typeof value.id !== 'string' || !value.id || !['passed', 'flagged', 'not_applicable'].includes(value.status) || typeof value.rationale !== 'string' || !value.rationale.trim() || value.rationale.length > 4096) invalid('Review findings need an ID, status and bounded rationale')
  if (!Array.isArray(value.evidence) || value.evidence.length > 24 || value.evidence.some(ref => typeof ref !== 'string' || !ref.trim() || ref.length > 512) || (value.status !== 'not_applicable' && !value.evidence.length)) invalid('Applicable review findings require bounded evidence references')
}
export function checkReviewFindings(criteria, lenses, status) {
  for (const list of [criteria, lenses]) {
    if (!Array.isArray(list) || !list.length || list.length > 128) invalid('Detailed review requires criteria and lenses')
    list.forEach(finding)
    if (new Set(list.map(f => f.id)).size !== list.length) invalid('Duplicate review finding')
  }
  const flagged = [...criteria, ...lenses].some(f => f.status === 'flagged')
  if (status !== (flagged ? 'flagged' : 'passed')) invalid('Review status must agree with its findings')
  if (criteria.every(f => f.status === 'not_applicable') || lenses.some(f => f.status === 'not_applicable')) invalid('A review requires an applicable criterion and performed lenses')
}

export function detailedReview(review, artifactSha256, resolveArtifact) {
  bounded(review)
  fields(review, ['schemaVersion', 'templateId', 'status', 'criteria', 'lenses', 'dependencies', 'notes'], 'review')
  if (review.schemaVersion !== 2) invalid('Detailed review requires schemaVersion 2')
  const template = getWorkflowTemplate(review.templateId).template
  checkReviewFindings(review.criteria, review.lenses, review.status)
  if (template.sections.some(id => !review.criteria.some(f => f.id === id)) || review.criteria.some(f => !template.sections.includes(f.id))) invalid('Review criteria must match the selected template sections')
  for (const id of template.constraints?.required_lenses || ['candidate', 'reader']) if (!review.lenses.some(f => f.id === id)) invalid(`Missing review lens: ${id}`)
  if (!Array.isArray(review.dependencies || []) || (review.dependencies || []).length > 24) invalid('Review supports at most 24 artifact dependencies')
  const dependencies = (review.dependencies || []).map(dep => {
    fields(dep, ['artifactId', 'sha256'], 'review dependency')
    if (!/^artifact:/.test(dep.artifactId || '') || !/^[a-f0-9]{64}$/.test(dep.sha256 || '')) invalid('Review dependency needs artifactId and SHA-256')
    if (resolveArtifact(dep.artifactId) !== dep.sha256) invalid('Review dependency is missing, stale or has a pending user revision', 'STALE_REVISION')
    return { ...dep }
  })
  return { schema_version: 2, template_id: review.templateId, template_sha256: templateDigest(review.templateId), status: review.status, criteria: structuredClone(review.criteria), lenses: structuredClone(review.lenses), dependencies, notes: review.notes || null, artifact_sha256: artifactSha256, recorded_at: new Date().toISOString() }
}

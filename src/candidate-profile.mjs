import fs from 'node:fs'
import path from 'node:path'
import { fail } from './model.mjs'
import { holoselfContext } from './holoself.mjs'

const SELF_DOCS = {
  outreach: ['profile/identity.md', 'profile/preferences.md', 'context/career.md', 'context/claims.md'],
  drafting: ['profile/identity.md', 'profile/voice.md', 'context/career.md', 'context/claims.md', 'context/evidence.md', 'context/story-bank.md'],
  application: ['profile/identity.md', 'profile/preferences.md', 'context/career.md', 'context/claims.md', 'context/evidence.md', 'context/positioning.md'],
  interview: ['profile/identity.md', 'context/career.md', 'context/claims.md', 'context/evidence.md', 'context/story-bank.md', 'context/leadership.md'],
  analyze: ['profile/identity.md', 'context/career.md', 'context/claims.md', 'context/evidence.md', 'context/positioning.md']
}

export function compactSelf(data, intent, limits) {
  const wanted = SELF_DOCS[intent] || SELF_DOCS.analyze, byPath = new Map((data?.self?.documents || []).map(document => [document.path, document]))
  const documents = wanted.map(p => byPath.get(p)).filter(Boolean).slice(0, limits.selfCount).map(document => ({ ...document, content: String(document.content || '').slice(0, limits.selfChars), truncated: String(document.content || '').length > limits.selfChars }))
  return { lens: data?.lens, validation: data?.validation, warnings: data?.warnings || [], documents, selectedSources: documents.length }
}

const TARGET_ROLES_MAX = 5, FLAGSHIP_FACTS_MAX = 5
const SOURCE_PREFERENCES = new Set(['auto', 'native'])

export function normalizeCandidateProfile(record = {}) {
  const displayName = String(record.display_name ?? '').trim()
  if (!displayName || displayName.length > 120) fail('display_name must be 1-120 characters', 'INVALID_COMMAND')
  const targetRoles = Array.isArray(record.target_roles) ? record.target_roles.map(item => String(item).trim()) : []
  if (!targetRoles.length || targetRoles.length > TARGET_ROLES_MAX || targetRoles.some(role => !role || role.length > 80)) fail(`target_roles must be 1-${TARGET_ROLES_MAX} strings of 1-80 characters`, 'INVALID_COMMAND')
  const positioning = String(record.positioning ?? '').trim()
  if (!positioning || positioning.length > 280) fail('positioning must be 1-280 characters', 'INVALID_COMMAND')
  const flagshipFacts = Array.isArray(record.flagship_facts) ? record.flagship_facts.map(item => String(item).trim()) : []
  if (flagshipFacts.length > FLAGSHIP_FACTS_MAX || flagshipFacts.some(fact => !fact || fact.length > 200)) fail(`flagship_facts must be 0-${FLAGSHIP_FACTS_MAX} strings of 1-200 characters`, 'INVALID_COMMAND')
  const sourcePreference = record.source_preference ?? 'auto'
  if (!SOURCE_PREFERENCES.has(sourcePreference)) fail('source_preference must be auto or native', 'INVALID_COMMAND')
  return { display_name: displayName, target_roles: targetRoles, positioning, flagship_facts: flagshipFacts, source_preference: sourcePreference }
}

export function candidateProfileFile(paths) {
  return path.join(paths.recordsDir, 'candidate-profile.json')
}

export function loadCandidateProfile(paths) {
  const file = candidateProfileFile(paths)
  if (!fs.existsSync(file)) return null
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { fail('Candidate profile file is invalid JSON', 'MODEL_INVALID') }
}

function nativeSelf(card) {
  return { source: 'native', documents: [], selectedSources: 0, displayName: card.display_name, targetRoles: card.target_roles, positioning: card.positioning, flagshipFacts: card.flagship_facts }
}

// Never duplicates an external tool's data: a native card is only ever read from this vault's own
// optional Candidatures/records/candidate-profile.json, and Holoself's own files are never opened
// directly (see AGENTS.md). Resolution order: an explicit native preference short-circuits before
// Holoself is ever called; otherwise Holoself is tried first and its success always wins; a card is
// used only when Holoself is not installed at all. Any other Holoself failure (bad config, timeout,
// malformed output) never silently falls back to the card - that would mask a real setup problem.
export function resolveSelf(paths, { intent, task, limits, lens = 'career' } = {}) {
  const card = loadCandidateProfile(paths)
  if (card?.source_preference === 'native') return nativeSelf(card)
  try {
    const data = holoselfContext(paths, { task, lens })
    return { ...compactSelf(data, intent, limits), source: 'holoself' }
  } catch (error) {
    if (error.code === 'HOLOSELF_UNAVAILABLE' && card) return nativeSelf(card)
    throw error
  }
}

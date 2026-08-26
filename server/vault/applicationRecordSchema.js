import yaml from 'js-yaml'
import { LIFECYCLE_STATUSES } from './lifecycle.js'

export const APPLICATION_SCHEMA_VERSION = 2
export const APPLICATION_STATUSES = LIFECYCLE_STATUSES
export const APPLICATION_PRIORITIES = Object.freeze(['very_high', 'high', 'medium', 'low', 'none'])
const SCOPES = Object.freeze(['active', 'archive'])
const LINKS = Object.freeze(['job_description', 'fit_analysis', 'cv', 'cover_letter', 'company_profile'])
const DATE = /^\d{4}-\d{2}-\d{2}$/
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function invalid(field, reason = 'is invalid') {
  const error = new Error(`Invalid application record field "${field}": ${reason}`)
  error.field = field
  error.statusCode = 422
  throw error
}
function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || /[\r\n\u0000-\u001f\u007f]/.test(value)) invalid(field, 'must be non-empty text')
  return value.trim()
}
function nullableText(value, field) {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || value.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) invalid(field)
  return value.trim() || null
}
function nullableDate(value, field) {
  if (value == null || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10)
  if (typeof value !== 'string' || !DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) invalid(field, 'must be YYYY-MM-DD or null')
  return value
}
function wikilink(value, field) {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !/^\[\[[^\]\r\n]+\]\]$/.test(value)) invalid(field, 'must be a wikilink or null')
  return value
}
function plain(data) {
  if (data == null) return {}
  if (typeof data !== 'object' || Array.isArray(data)) invalid('record', 'must be an object')
  return structuredClone(data)
}

export function validateApplicationMetadata(data, context = {}) {
  return canonicalizeApplicationMetadata(data, context)
}

export function canonicalizeApplicationMetadata(data, { company, role, status, scope, date, source } = {}) {
  const input = plain(data)
  if (input.schema_version !== undefined && input.schema_version !== APPLICATION_SCHEMA_VERSION) invalid('schema_version', `must be ${APPLICATION_SCHEMA_VERSION}`)
  if (input.type !== undefined && input.type !== 'application') invalid('type', 'must be application')
  const resolvedStatus = status ?? input.status
  if (!APPLICATION_STATUSES.includes(resolvedStatus)) invalid('status', `must be one of ${APPLICATION_STATUSES.join(', ')}`)
  const revision = input.application_revision ?? 0
  if (!Number.isSafeInteger(revision) || revision < 0) invalid('application_revision', 'must be a non-negative integer')
  const storageScope = scope ?? input.storage_scope ?? 'active'
  if (!SCOPES.includes(storageScope)) invalid('storage_scope', 'must be active or archive')
  const priority = input.priority == null || input.priority === '' ? 'none' : input.priority
  if (!APPLICATION_PRIORITIES.includes(priority)) invalid('priority', `must be one of ${APPLICATION_PRIORITIES.join(', ')}`)
  if (input.people !== undefined && !Array.isArray(input.people)) invalid('people', 'must be an array')
  if (input.tags !== undefined && !Array.isArray(input.tags)) invalid('tags', 'must be an array')
  const authoritativeDate = nullableDate(date, 'date')
  const known = new Set(['schema_version','type','company','role','status','application_revision','storage_scope','priority','country','location','language_risk','created','updated',...LINKS,'people','tags'])
  const extras = Object.fromEntries(Object.entries(input).filter(([key]) => !known.has(key)))
  if (source !== undefined && extras.source === undefined) extras.source = source
  return {
    schema_version: APPLICATION_SCHEMA_VERSION,
    type: 'application',
    company: requiredText(company ?? input.company, 'company'),
    role: requiredText(role ?? input.role, 'role'),
    status: resolvedStatus,
    application_revision: revision,
    storage_scope: storageScope,
    priority,
    country: nullableText(input.country, 'country'),
    location: nullableText(input.location, 'location'),
    language_risk: nullableText(input.language_risk, 'language_risk'),
    created: nullableDate(input.created ?? authoritativeDate, 'created'),
    updated: nullableDate(input.updated ?? authoritativeDate, 'updated'),
    job_description: wikilink(input.job_description, 'job_description'),
    fit_analysis: wikilink(input.fit_analysis, 'fit_analysis'),
    cv: wikilink(input.cv, 'cv'),
    cover_letter: wikilink(input.cover_letter, 'cover_letter'),
    company_profile: wikilink(input.company_profile, 'company_profile'),
    people: input.people ? structuredClone(input.people) : [],
    tags: [...new Set([...(input.tags || []), 'application'])],
    ...extras,
  }
}

export function canonicalizeApplicationIndex(data, { application, status, scope, date } = {}) {
  const input = plain(data)
  if (input.schema_version !== undefined && input.schema_version !== APPLICATION_SCHEMA_VERSION) invalid('schema_version', `must be ${APPLICATION_SCHEMA_VERSION}`)
  if (input.type !== undefined && input.type !== 'application-index') invalid('type', 'must be application-index')
  const slug = application ?? input.application
  if (typeof slug !== 'string' || !SLUG.test(slug)) invalid('application', 'must be a canonical slug')
  const lifecycle = status ?? input.status
  if (!APPLICATION_STATUSES.includes(lifecycle)) invalid('status', `must be one of ${APPLICATION_STATUSES.join(', ')}`)
  const storageScope = scope ?? input.storage_scope
  if (!SCOPES.includes(storageScope)) invalid('storage_scope', 'must be active or archive')
  return { schema_version: APPLICATION_SCHEMA_VERSION, type: 'application-index', application: slug, status: lifecycle, storage_scope: storageScope, updated: nullableDate(input.updated ?? date, 'updated') }
}

function frontmatter(data) { return `---\n${yaml.dump(data, { noRefs: true, lineWidth: -1, sortKeys: false }).trimEnd()}\n---\n` }
export function serializeApplicationMetadata(data, context) { return frontmatter(canonicalizeApplicationMetadata(data, context)) }
export function serializeApplicationIndex(data, body, context) {
  if (typeof body !== 'string') invalid('body', 'must be text')
  return frontmatter(canonicalizeApplicationIndex(data, context)) + body
}

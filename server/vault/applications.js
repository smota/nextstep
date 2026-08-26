import path from 'node:path'
import { safeParseFile } from './parseFrontmatter.js'
import { listSubdirectories, fileExists, dirExists } from './walker.js'
import { LIFECYCLE_STATUSES, TRANSITIONS } from './lifecycle.js'

export const ALLOWED_STATUSES = LIFECYCLE_STATUSES

const ARTIFACT_FILES = [
  { key: 'index', filename: 'index.md' },
  { key: 'jobDescription', filename: 'job-description.md' },
  { key: 'fitAnalysis', filename: 'fit-analysis.md' },
  { key: 'cv', filename: 'cv.md' },
  { key: 'coverLetter', filename: 'cover-letter.md' },
  { key: 'companyProfileLocal', filename: 'company-profile.md' },
  { key: 'peopleNotes', filename: 'people-notes.md' },
  { key: 'interviewPrep', filename: 'interview-prep.md' },
  { key: 'submissionNotes', filename: 'submission-notes.md' },
]

// metadata.md frontmatter link fields (job_description, cv, ...) are known to
// be present/absent independent of whether the underlying file actually
// exists on disk — never trust them as an existence proof.
function extractWikilinkSlug(value) {
  if (typeof value !== 'string') return null
  const m = value.match(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/)
  if (!m) return null
  return m[1].trim().split('/').pop()
}

function normalizeCompanyProfileField(value) {
  if (!value || Array.isArray(value)) return null
  if (typeof value === 'string') {
    return { raw: value, slug: extractWikilinkSlug(value) }
  }
  return null
}

function normalizePeopleField(value) {
  if (!Array.isArray(value)) return []
  return value.map((entry) => {
    if (typeof entry !== 'string') {
      return { raw: String(entry), slug: null, name: String(entry) }
    }
    const slug = extractWikilinkSlug(entry)
    return { raw: entry, slug, name: slug || entry }
  })
}

// Body text in metadata.md often carries a richer free-text risk statement
// (e.g. "**Main risk:** Direct CTMS/LIMS ownership not explicit...") than the
// language_risk/compensation_risk frontmatter fields alone.
function extractMainRisk(content) {
  const m = content.match(/\*\*Main risk:?\*\*\s*(.+)/i)
  return m ? m[1].trim() : null
}

export function loadApplications(dirPath, { archived }) {
  const slugs = listSubdirectories(dirPath)

  return slugs.map((slug) => {
    const folderPath = path.join(dirPath, slug)
    const metadataPath = path.join(folderPath, 'metadata.md')
    const { data, content, parseError, exists: metadataExists } = safeParseFile(metadataPath)

    const artifacts = {}
    for (const { key, filename } of ARTIFACT_FILES) {
      artifacts[key] = fileExists(path.join(folderPath, filename))
    }

    const hasLegacyFiles = dirExists(path.join(folderPath, 'legacy-files'))
    const archiveShape = archived ? (hasLegacyFiles ? 'A-legacy' : 'B-full') : null

    const canonicalStatus = typeof data.status === 'string' && ALLOWED_STATUSES.includes(data.status) ? data.status : null
    const effectiveStatus = archived ? 'archived' : canonicalStatus

    return {
      slug,
      archived,
      archiveShape,
      storageScope: archived ? 'archive' : 'active',
      revision: Number.isSafeInteger(data.application_revision) ? data.application_revision : 0,
      canonicalStatus,
      effectiveStatus,
      statusSource: archived ? 'physical_archive' : (canonicalStatus ? 'metadata' : 'missing_or_malformed'),
      metadataExists,
      metadataParseError: parseError,
      company: data.company || null,
      role: data.role || null,
      status: effectiveStatus,
      statusIsKnown: effectiveStatus ? ALLOWED_STATUSES.includes(effectiveStatus) : false,
      allowedTransitions: effectiveStatus ? [...(TRANSITIONS[effectiveStatus] || [])] : [],
      priority: data.priority || null,
      country: data.country || null,
      location: data.location || null,
      languageRisk: data.language_risk || null,
      compensationRisk: data.compensation_risk || null,
      mainRiskFromBody: extractMainRisk(content || ''),
      created: data.created || null,
      updated: data.updated || null,
      jobSource: data.source || null,
      reuseChecks: data.reuse_assessment?.reviewed ?? null,
      dominantNarrative: data.dominant_narrative || data.narrative || null,
      tags: Array.isArray(data.tags) ? data.tags : [],
      companyProfile: normalizeCompanyProfileField(data.company_profile),
      people: normalizePeopleField(data.people),
      artifacts,
    }
  })
}

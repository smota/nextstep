import path from 'node:path'
import { safeParseFile } from './parseFrontmatter.js'
import { listMarkdownFiles } from './walker.js'

function titleCaseFromSlug(slug) {
  return slug
    .replace(/-company-profile$/i, '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function extractFirstH1(content) {
  const m = content.match(/^#\s+(.+)$/m)
  return m ? m[1].trim() : null
}

function extractSection(content, heading) {
  const lines = (content || '').split(/\r?\n/)
  const headingLine = heading.trim()
  const startIdx = lines.findIndex((l) => l.trim() === headingLine)
  if (startIdx === -1) return null

  const collected = []
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break
    collected.push(lines[i])
  }
  const text = collected.join('\n').trim()
  return text.length > 0 ? text : null
}

// ~14/32 company profiles have no frontmatter at all — this must never throw
// and must still produce a sensible display name (filename slug is a poor
// fallback for names like "jj", so the first H1 line wins when present).
export function loadCompanies(companiesDir) {
  const files = listMarkdownFiles(companiesDir)

  return files.map((filename) => {
    const slug = filename.replace(/\.md$/i, '')
    const filePath = path.join(companiesDir, filename)
    const { data, content, parseError } = safeParseFile(filePath)
    const hasFrontmatter = Boolean(data && Object.keys(data).length > 0)
    const h1 = extractFirstH1(content || '')

    return {
      slug,
      name: data.company || h1 || titleCaseFromSlug(slug),
      hasFrontmatter,
      parseError,
      created: data.created || null,
      updated: data.updated || null,
      tags: Array.isArray(data.tags) ? data.tags : [],
      risksRedFlags: extractSection(content || '', '## Risks / Red Flags'),
      talkingPoints: extractSection(content || '', '## Talking Points'),
      referencedByApplications: [],
    }
  })
}

import path from 'node:path'
import { safeParseFile } from './parseFrontmatter.js'
import { listMarkdownFiles } from './walker.js'

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

// People profiles are the most structurally consistent artifact in the vault
// (all real ones carry `type: person` frontmatter). Files without that type
// tag (e.g. tom-pluym-conversation-script.md) are ad hoc extras linked from a
// real profile, not people records themselves, and are excluded here.
export function loadPeople(peopleDir) {
  const files = listMarkdownFiles(peopleDir)

  return files
    .map((filename) => {
      const slug = filename.replace(/\.md$/i, '')
      const filePath = path.join(peopleDir, filename)
      const { data, content, parseError } = safeParseFile(filePath)
      return { slug, filePath, data, content, parseError }
    })
    .filter(({ data }) => data.type === 'person')
    .map(({ slug, data, content, parseError }) => ({
      slug,
      name: data.name || slug,
      company: data.company || null,
      role: data.role || null,
      parseError,
      created: data.created || null,
      updated: data.updated || null,
      tags: Array.isArray(data.tags) ? data.tags : [],
      likelyPriorities: extractSection(content || '', '## Likely Priorities'),
      communicationAngle: extractSection(content || '', '## Communication Angle'),
      referencedByApplications: [],
    }))
}

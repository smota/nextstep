import fs from 'node:fs'
import matter from 'gray-matter'

// Wraps gray-matter so that missing files, missing frontmatter, and malformed
// YAML all degrade gracefully instead of throwing — the vault has plenty of
// markdown files with no frontmatter at all (see companies.js) and index.md
// files with inconsistent/optional frontmatter.
export function safeParseFile(filePath) {
  let raw
  try {
    raw = fs.readFileSync(filePath, 'utf8')
  } catch {
    return { exists: false, data: {}, content: '', raw: '', parseError: false }
  }

  try {
    const parsed = matter(raw)
    return {
      exists: true,
      data: parsed.data || {},
      content: parsed.content || '',
      raw,
      parseError: false,
    }
  } catch (err) {
    return {
      exists: true,
      data: {},
      content: raw,
      raw,
      parseError: true,
      parseErrorMessage: err.message,
    }
  }
}

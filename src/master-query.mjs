// Pure domain engine module for Master guide cataloging and literal querying.
// No filesystem or network dependencies: operates purely on provided in-memory documents.

const USAGE_CODE = 'USAGE'

function usageError(message) {
  return Object.assign(new Error(message), { code: USAGE_CODE })
}

function compareDocuments(a, b) {
  const pathA = String(a?.path ?? '')
  const pathB = String(b?.path ?? '')
  if (pathA < pathB) return -1
  if (pathA > pathB) return 1
  return 0
}

export function extractTitle(document) {
  if (typeof document?.title === 'string' && document.title.trim()) {
    return document.title.trim()
  }
  const content = typeof document?.content === 'string' ? document.content : ''

  // 1. YAML frontmatter title
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (fmMatch) {
    const titleLine = fmMatch[1].split(/\r?\n/).find(line => /^\s*title\s*:/i.test(line))
    if (titleLine) {
      const val = titleLine.replace(/^\s*title\s*:\s*/i, '').trim().replace(/^['"](.*)['"]$/, '$1').trim()
      if (val) return val
    }
  }

  // 2. First Markdown heading # Title
  const h1Match = content.match(/^#\s+(.+)$/m)
  if (h1Match) {
    const heading = h1Match[1].trim()
    if (heading) return heading
  }

  // 3. Any Markdown heading ## Title
  const anyHMatch = content.match(/^#{2,6}\s+(.+)$/m)
  if (anyHMatch) {
    const heading = anyHMatch[1].trim()
    if (heading) return heading
  }

  // 4. Path basename without .md
  const rawPath = typeof document?.path === 'string' ? document.path : ''
  const basename = rawPath.split('/').pop().split('\\').pop()
  const fallback = basename.replace(/\.md$/i, '').trim()
  return fallback || 'Untitled'
}

export function catalogMaster(documents) {
  if (!Array.isArray(documents)) {
    throw usageError('documents must be an array')
  }

  const sorted = [...documents].sort(compareDocuments)
  const cataloged = sorted.map(doc => ({
    path: doc.path,
    sha256: doc.sha256,
    sizeBytes: doc.sizeBytes,
    title: extractTitle(doc)
  }))

  return {
    schemaVersion: 1,
    documents: cataloged,
    count: cataloged.length
  }
}

function findFirstMatchOffset(content, tokens) {
  if (!content) return -1
  const lower = content.toLowerCase()
  const norm = content.normalize('NFKC').toLowerCase()
  let earliest = -1
  for (const token of tokens) {
    const tokLower = token.toLowerCase()
    let idx = lower.indexOf(tokLower)
    if (idx === -1) {
      const normalizedOffset = norm.indexOf(tokLower)
      // Normalization can expand ligatures or collapse combining characters.
      // Map the match back to the original text; normalized offsets are not
      // valid source offsets for an evidence excerpt.
      if (normalizedOffset >= 0) {
        let offset = 0
        for (const part of new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(content)) {
          const length = part.segment.normalize('NFKC').toLowerCase().length
          if (offset + length > normalizedOffset) { idx = part.index; break }
          offset += length
        }
      }
    }
    if (idx !== -1) {
      if (earliest === -1 || idx < earliest) {
        earliest = idx
      }
    }
  }
  return earliest
}

function buildExcerpt(content, tokens, maxChars) {
  const text = typeof content === 'string' ? content : ''
  if (text.length <= maxChars) {
    return {
      excerpt: text,
      truncated: false
    }
  }

  const matchOffset = findFirstMatchOffset(text, tokens)
  let start = 0
  if (matchOffset >= 0) {
    const half = Math.floor(maxChars / 2)
    start = Math.max(0, matchOffset - half)
    if (start + maxChars > text.length) {
      start = Math.max(0, text.length - maxChars)
    }
  }

  const excerpt = text.slice(start, start + maxChars)
  return {
    excerpt,
    truncated: true
  }
}

export function queryMaster(documents, { query, limit = 10, maxChars = 2000 } = {}) {
  if (!Array.isArray(documents)) {
    throw usageError('documents must be an array')
  }

  if (typeof query !== 'string') {
    throw usageError('query must be a non-empty string')
  }

  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    throw usageError('query must not be empty')
  }
  if (trimmedQuery.length > 200) {
    throw usageError('query must not exceed 200 characters')
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw usageError('limit must be an integer between 1 and 50')
  }

  if (!Number.isInteger(maxChars) || maxChars < 1 || maxChars > 8000) {
    throw usageError('maxChars must be an integer between 1 and 8000')
  }

  const normalizedQuery = trimmedQuery.normalize('NFKC')
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)

  const matched = []
  const sorted = [...documents].sort(compareDocuments)

  for (const doc of sorted) {
    const pathNorm = String(doc?.path ?? '').normalize('NFKC').toLowerCase()
    const contentNorm = String(doc?.content ?? '').normalize('NFKC').toLowerCase()

    const allMatch = tokens.every(token => {
      const tokLower = token.toLowerCase()
      return pathNorm.includes(tokLower) || contentNorm.includes(tokLower)
    })

    if (allMatch) {
      matched.push(doc)
    }
  }

  const totalMatches = matched.length
  const results = matched.slice(0, limit).map(doc => {
    const { excerpt, truncated } = buildExcerpt(doc.content, tokens, maxChars)
    return {
      path: doc.path,
      sha256: doc.sha256,
      sizeBytes: doc.sizeBytes,
      title: extractTitle(doc),
      excerpt,
      truncated
    }
  })

  return {
    schemaVersion: 1,
    query: trimmedQuery,
    totalMatches,
    results
  }
}

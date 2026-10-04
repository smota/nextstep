import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { TextDecoder } from 'node:util'

const fail = (message, code) => { throw Object.assign(new Error(message), { code }) }
const decoder = new TextDecoder('utf-8', { fatal: true })

// Filesystem adapter: no persistent index, no link traversal, no external context.
export function readMasterDocuments(paths) {
  const root = path.join(paths.vaultRoot, 'Master')
  const documents = [], excluded = []
  let totalBytes = 0, entriesSeen = 0
  if (!fs.existsSync(root)) return { documents, excluded, coverage: 'Master/**/*.md; excludes Archive/ and hidden entries' }
  const rootStat = fs.lstatSync(root)
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) fail('Master must be a regular directory', 'UNSAFE_PATH')
  const rootReal = fs.realpathSync.native(root)
  function visit(directory, depth) {
    if (depth > 20) fail('Master directory depth exceeds 20', 'MASTER_LIMIT')
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      if (++entriesSeen > 10000) fail('Master inventory exceeds 10000 entries', 'MASTER_LIMIT')
      const absolute = path.join(directory, entry.name)
      const relative = `Master/${path.relative(root, absolute).split(path.sep).join('/')}`
      if (entry.name.startsWith('.') || entry.name.toLowerCase() === 'archive') { excluded.push({ path: relative, reason: 'inactive-or-hidden' }); continue }
      const stat = fs.lstatSync(absolute)
      if (stat.isSymbolicLink()) { excluded.push({ path: relative, reason: 'link' }); continue }
      const physical = path.relative(rootReal, fs.realpathSync.native(absolute))
      if (physical.startsWith(`..${path.sep}`) || physical === '..' || path.isAbsolute(physical)) fail('Master entry escapes its root', 'UNSAFE_PATH')
      if (stat.isDirectory()) { visit(absolute, depth + 1); continue }
      if (!stat.isFile() || path.extname(entry.name).toLowerCase() !== '.md') { excluded.push({ path: relative, reason: 'not-markdown' }); continue }
      if (stat.size > 2 * 1024 * 1024 || totalBytes + stat.size > 32 * 1024 * 1024 || documents.length >= 1000) fail('Master exceeds retrieval limits (2 MiB/file, 32 MiB total, 1000 documents)', 'MASTER_LIMIT')
      // Bind validation and reading to the same file handle. Reopening by path
      // after lstat would allow a rename/link swap between the two operations.
      const fd = fs.openSync(absolute, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0))
      let bytes
      try {
        const opened = fs.fstatSync(fd)
        if (!opened.isFile() || opened.ino !== stat.ino || opened.dev !== stat.dev || opened.size !== stat.size || opened.mtimeMs !== stat.mtimeMs) fail('Master changed before retrieval; retry', 'MASTER_CHANGED')
        const buffer = Buffer.alloc(stat.size + 1)
        let length = 0, read = 0
        do { read = fs.readSync(fd, buffer, length, buffer.length - length, length); length += read } while (read && length < buffer.length)
        const completed = fs.fstatSync(fd)
        if (completed.size !== opened.size || completed.mtimeMs !== opened.mtimeMs || completed.ctimeMs !== opened.ctimeMs) fail('Master changed during retrieval; retry', 'MASTER_CHANGED')
        bytes = buffer.subarray(0, length)
      } finally { fs.closeSync(fd) }
      const after = fs.lstatSync(absolute)
      if (fs.realpathSync.native(root) !== rootReal || path.relative(rootReal, fs.realpathSync.native(absolute)) !== physical || after.isSymbolicLink() || after.ino !== stat.ino || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || bytes.length !== stat.size) fail('Master changed during retrieval; retry', 'MASTER_CHANGED')
      let content
      try { content = decoder.decode(bytes) } catch { fail(`Invalid UTF-8 in ${relative}`, 'MASTER_ENCODING') }
      totalBytes += bytes.length
      documents.push({ path: relative, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), sizeBytes: bytes.length, content })
    }
  }
  visit(root, 0)
  return { documents, excluded, coverage: 'Master/**/*.md; excludes Archive/ and hidden entries' }
}

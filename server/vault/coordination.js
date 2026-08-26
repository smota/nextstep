import fs from 'node:fs'
import { safeParseFile } from './parseFrontmatter.js'

function splitRow(line) {
  const trimmed = line.trim().replace(/^\||\|$/g, '')
  return trimmed.split('|').map((c) => c.trim())
}

// work-queue.md is a real, actively-used markdown table — but its own
// template row (task_id: "_example_") must be filtered out of results.
function parseMarkdownTable(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().startsWith('|'))
  if (lines.length < 2) return []
  const headerCells = splitRow(lines[0])
  return lines
    .slice(2)
    .map((line) => {
      const cells = splitRow(line)
      const record = {}
      headerCells.forEach((h, i) => {
        record[h] = (cells[i] || '').trim()
      })
      return record
    })
    .filter((row) => row.task_id && row.task_id !== '_example_')
}

// audit-log.md entries are free-text prose in a loose nested-bullet format,
// not a strict schema — this is a tolerant best-effort line scanner intended
// for read-only display, not a source of truth for the app's own run state.
function parseAuditLog(content) {
  const entriesSection = content.split(/^## Entries\s*$/m)[1] ?? content
  const blocks = entriesSection
    .split(/\n(?=-\s*timestamp:)/)
    .map((b) => b.trim())
    .filter((b) => b.startsWith('- timestamp:'))

  const get = (block, field) => {
    const re = new RegExp(`-\\s*${field}:\\s*(.*)`, 'i')
    const m = block.match(re)
    return m ? m[1].trim() : null
  }

  return blocks
    .map((block) => ({
      timestamp: get(block, 'timestamp'),
      agent: get(block, 'agent'),
      taskId: get(block, 'task_id'),
      action: get(block, 'action'),
      paths: get(block, 'paths'),
      result: get(block, 'result'),
    }))
    .filter((entry) => entry.timestamp)
    .reverse()
}

function listArtifacts(dirPath) {
  try {
    return fs.readdirSync(dirPath).filter((name) => name !== '.gitkeep')
  } catch {
    return []
  }
}

export function loadCoordinationState(paths) {
  const workQueueFile = safeParseFile(paths.workQueuePath)
  const auditLogFile = safeParseFile(paths.auditLogPath)

  return {
    workQueue: parseMarkdownTable(workQueueFile.raw || ''),
    auditLog: parseAuditLog(auditLogFile.raw || ''),
    activeLocks: listArtifacts(paths.locksDir),
    activeHandoffs: listArtifacts(paths.handoffsDir),
  }
}

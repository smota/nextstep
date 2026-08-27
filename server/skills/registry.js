import fs from 'node:fs'
import path from 'node:path'
import { safeParseFile } from '../vault/parseFrontmatter.js'

function extractTriggerPhrases(content) {
  const lines = (content || '').split(/\r?\n/)
  const startIdx = lines.findIndex((l) => l.trim() === '## When to Use This Skill')
  if (startIdx === -1) return []

  const phrases = []
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break
    const trimmed = lines[i].trim()
    if (trimmed.startsWith('-')) phrases.push(trimmed.replace(/^-\s*/, ''))
  }
  return phrases
}

// Skills are external dependencies. Each direct child is one substitutable
// capability implementation identified by its directory name.
export function loadSkillRegistry(skillsDir) {
  if (!skillsDir || !path.isAbsolute(skillsDir)) return []
  let entries
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true })
  } catch {
    return []
  }

  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .map((skillDirName) => {
      const skillMdPath = path.join(skillsDir, skillDirName, 'SKILL.md')
      const { data, content, exists, parseError } = safeParseFile(skillMdPath)
      return {
        id: skillDirName,
        name: data.name || skillDirName,
        description: data.description || null,
        owner: data.metadata?.owner || null,
        kind: data.metadata?.kind || 'external-skill',
        version: data.metadata?.version || null,
        exists,
        parseError,
        triggerPhrases: extractTriggerPhrases(content || ''),
        skillMdPath,
      }
    })
    .filter((skill) => skill.exists)
}

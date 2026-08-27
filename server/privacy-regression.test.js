import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

const PRODUCT_SKILLS = new Set([
  '.agents/skills/application-pipeline-manager/SKILL.md',
  '.agents/skills/company-profile-research/SKILL.md',
  '.agents/skills/people-profile-research/SKILL.md',
])

function candidateFiles() {
  const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' })
  return [...new Set(output.split('\0').filter(Boolean))]
    .map(file => file.replaceAll('\\', '/'))
    .filter(file => fs.existsSync(file) && fs.statSync(file).isFile())
}

test('public candidate excludes private data, runtime state, generated skills, personal paths and credentials', () => {
  const files = candidateFiles()
  const forbiddenPaths = files.filter(file =>
    /^(?:Candidatures|Master|data|\.nextstep|\.holoself)(?:\/|$)/.test(file)
    || (/^\.coordination\//.test(file) && file !== '.coordination/tools/vault-lock.mjs')
    || (/^\.agents\/skills\//.test(file) && !PRODUCT_SKILLS.has(file))
    || /(?:^|\/)(?:runs|intakes|receipts|journals)(?:\/|$)/.test(file)
  )
  assert.deepEqual(forbiddenPaths, [], `private or generated paths in public candidate: ${forbiddenPaths.join(', ')}`)

  const home = process.env.USERPROFILE || os.homedir()
  const normalizedHome = home && path.resolve(home).replaceAll('\\', '/').toLowerCase()
  const leaks = []
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8')
    const normalized = content.replaceAll('\\', '/').toLowerCase()
    if (normalizedHome && normalized.includes(normalizedHome)) leaks.push(`${file}: personal home path`)
    if (/(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bsk-[A-Za-z0-9_-]{20,}|\bgh[pousr]_[A-Za-z0-9]{20,})/.test(content)) leaks.push(`${file}: credential pattern`)
  }
  assert.deepEqual(leaks, [], `sensitive content in public candidate: ${leaks.join(', ')}`)
})

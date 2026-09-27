import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { packageSkills, skillNames, fileHashes } from '../scripts/package-skills.mjs'
import { updateSkills } from '../scripts/update-skills.mjs'

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-distribution-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const sourceRoot = path.join(root, 'source'), outputRoot = path.join(root, 'distribution')
  fs.cpSync(path.resolve(import.meta.dirname, '..', 'skills'), sourceRoot, { recursive: true })
  return { root, sourceRoot, outputRoot }
}

test('Packages are deterministic, self-contained and do not mutate source', t => {
  const options = fixture(t), before = fileHashes(options.sourceRoot), first = packageSkills(options)
  assert.deepEqual(fileHashes(options.sourceRoot), before)
  assert.equal(packageSkills(options).changed, false)
  for (const name of skillNames) {
    const root = path.join(first.current, name)
    assert.deepEqual(fileHashes(root), first.manifest.packages[name])
    for (const file of Object.keys(fileHashes(root)).filter(file => file.endsWith('.md'))) {
      const text = fs.readFileSync(path.join(root, file), 'utf8')
      for (const [, target] of text.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(target)) continue
        const resolved = path.resolve(root, path.dirname(file), target.split('#')[0])
        assert.equal(resolved.startsWith(`${root}${path.sep}`), true)
        assert.equal(fs.existsSync(resolved), true)
      }
    }
  }
  fs.appendFileSync(path.join(options.sourceRoot, 'references', 'context.md'), '\nSynthetic update.\n')
  const updated = packageSkills(options)
  assert.equal(updated.changed, true)
  assert.notEqual(first.manifest.digest, updated.manifest.digest)
  assert.equal(fs.existsSync(path.join(updated.previous, 'manifest.json')), true)
})

test('Missing, escaping and personal references fail before publishing', t => {
  const options = fixture(t), first = packageSkills(options)
  const file = path.join(options.sourceRoot, 'nxt-context', 'SKILL.md'), original = fs.readFileSync(file)
  for (const addition of ['\n[missing](../references/missing.md)', '\n[escape](../../outside.md)', '\nC:/Users/example/private']) {
    fs.writeFileSync(file, Buffer.concat([original, Buffer.from(addition)]))
    assert.throws(() => packageSkills(options))
    assert.equal(JSON.parse(fs.readFileSync(path.join(first.current, 'manifest.json'))).digest, first.manifest.digest)
  }
})

test('Manager imports and updates the same IDs, preserves preset, detects drift', { skip: !process.env.NEXTSTEP_TEST_SKILLS_MANAGER }, t => {
  const { root, ...options } = fixture(t), manager = process.env.NEXTSTEP_TEST_SKILLS_MANAGER
  const skillsRoot = path.join(root, 'library'); fs.mkdirSync(skillsRoot)
  const invoke = (...args) => {
    const r = spawnSync(manager, ['--skills-root', skillsRoot, '--json', ...args], { encoding: 'utf8', windowsHide: true })
    assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout)
  }
  const first = updateSkills({ ...options, manager, skillsRoot, install: true })
  const preset = invoke('presets', 'create', 'Next Step')
  invoke('presets', 'add-skill', preset.id, ...skillNames)
  const before = invoke('skills', 'list')
  fs.appendFileSync(path.join(options.sourceRoot, 'references', 'context.md'), '\nSynthetic update.\n')
  const updated = updateSkills({ ...options, manager, skillsRoot })
  assert.deepEqual(updated.reports.map(r => r.id), first.reports.map(r => r.id))
  assert.ok(updated.reports.every(r => r.changed && r.verified))
  assert.ok(invoke('skills', 'list').every(s => s.preset_ids.includes(preset.id)))
  assert.ok(updateSkills({ ...options, manager, skillsRoot }).reports.every(r => !r.changed))
  const target = before.find(s => s.name === 'nxt-context')
  fs.appendFileSync(path.join(target.path, 'SKILL.md'), '\nA local user edit.\n')
  assert.throws(() => updateSkills({ ...options, manager, skillsRoot }), /Library drift/)
  assert.match(fs.readFileSync(path.join(target.path, 'SKILL.md'), 'utf8'), /local user edit/)
})

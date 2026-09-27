import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { integrationLink, integrationPlan, integrationUnlink, skillInventory } from '../src/integration.mjs'

const productRoot = path.resolve(import.meta.dirname, '..')
const expected = ['nxt-application', 'nxt-context', 'nxt-networking', 'nxt-opportunity', 'nxt-review']

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-c4-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const profile = path.join(root, 'profile'), workspace = path.join(root, 'workspace')
  fs.mkdirSync(workspace); fs.writeFileSync(path.join(workspace, 'AGENTS.md'), '# synthetic C4\n')
  return { root, profile, workspace }
}

test('C4-TR-01 exposes exactly five canonical nxt skills', () => {
  const inventory = skillInventory(path.join(productRoot, 'skills'), { includeDir: name => name.startsWith('nxt-') })
  assert.deepEqual(inventory.skills.map(item => item.name).sort(), expected)
  assert.deepEqual(inventory.invalid, [])
  assert.deepEqual(inventory.duplicates, [])
  assert.equal(fs.existsSync(path.join(productRoot, 'skills', 'nextstep')), false)
})

test('CLI relink never creates workspace skills and preserves external skills', t => {
  const { root, profile, workspace } = setup(t), external = path.join(root, 'holoself-source'), codexRoot = path.join(workspace, '.codex', 'skills')
  fs.mkdirSync(external); fs.mkdirSync(codexRoot, { recursive: true }); fs.symlinkSync(external, path.join(codexRoot, 'holoself'), 'junction')
  integrationLink({ productRoot, profileRoot: profile, workspaceRoot: workspace })
  assert.equal(integrationPlan({ productRoot, profileRoot: profile, workspaceRoot: workspace }).operations.length, 0)
  for (const name of [...expected, 'references']) assert.equal(fs.existsSync(path.join(codexRoot, name)), false)
  integrationUnlink({ profileRoot: profile })
  assert.equal(fs.realpathSync.native(path.join(codexRoot, 'holoself')), fs.realpathSync.native(external))
})

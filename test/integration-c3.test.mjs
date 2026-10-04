import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import platformTest from 'node:test'

// These suites exercise the Windows-only linked installation contract.
const test = (name, fn) => platformTest(name, { skip: process.platform !== 'win32' ? 'Windows linked installation only' : false }, fn)
import { seedWorkspaceSkills } from './fixtures/workspace-skills.mjs'
import { integrationDoctor, integrationLink, integrationPlan, integrationStatus, integrationUnlink, integrationRestoreSkills, skillInventory } from '../src/integration.mjs'

const productRoot = path.resolve(import.meta.dirname, '..')

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-c3-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const profile = path.join(root, 'profile'), workspace = path.join(root, 'workspace')
  fs.mkdirSync(workspace); fs.writeFileSync(path.join(workspace, 'AGENTS.md'), '# synthetic C3\n')
  return { root, profile, workspace }
}

test('C3-TR-01 product retains the two initial nxt skills and no old router', () => {
  const inventory = skillInventory(path.join(productRoot, 'skills'), { includeDir: name => name.startsWith('nxt-') })
  assert.deepEqual(inventory.skills.map(item => item.name).filter(name => ['nxt-application', 'nxt-context'].includes(name)).sort(), ['nxt-application', 'nxt-context'])
  assert.deepEqual(inventory.invalid, [])
  assert.deepEqual(inventory.duplicates, [])
  assert.equal(fs.existsSync(path.join(productRoot, 'skills', 'nextstep')), false)
})

test('Skill migration previews, removes, restores and re-removes only owned workspace links', t => {
  const { root, profile, workspace } = setup(t), external = path.join(root, 'holoself-source')
  fs.mkdirSync(external); fs.writeFileSync(path.join(external, 'canary'), 'keep')
  fs.mkdirSync(path.join(workspace, '.codex', 'skills'), { recursive: true }); fs.symlinkSync(external, path.join(workspace, '.codex', 'skills', 'holoself'), 'junction')
  fs.writeFileSync(path.join(workspace, 'nextstep.yaml'), 'preserve marker')
  let pathState = { exists: true, type: 'REG_SZ', value: 'original' }
  const pathAdapter = { read: () => structuredClone(pathState), write: value => { pathState = structuredClone(value) } }
  const before = seedWorkspaceSkills({ productRoot, profileRoot: profile, workspaceRoot: workspace, manageUserPath: true, pathAdapter })
  const originalPath = structuredClone(pathState)
  const options = { profileRoot: profile, workspaceRoot: workspace, scope: 'skills' }
  const preview = integrationUnlink({ ...options, dryRun: true })
  assert.equal(preview.operations.length, 7)
  assert.equal(fs.existsSync(path.join(workspace, '.agents', 'skills')), true)
  integrationUnlink(options)
  assert.deepEqual(pathState, originalPath)
  const after = integrationStatus({ profileRoot: profile, pathAdapter })
  assert.equal(after.status, 'ok'); assert.equal(after.skills.state, 'externally_managed')
  assert.deepEqual(after.registry.managedLinks, before.managedLinks.filter(item => item.kind === 'tool'))
  assert.deepEqual(after.registry.userPath, before.userPath)
  assert.equal(fs.readFileSync(path.join(workspace, 'nextstep.yaml'), 'utf8'), 'preserve marker')
  assert.equal(fs.readFileSync(path.join(external, 'canary'), 'utf8'), 'keep')
  assert.equal(fs.realpathSync.native(path.join(workspace, '.codex', 'skills', 'holoself')), fs.realpathSync.native(external))
  integrationLink({ productRoot, profileRoot: profile, workspaceRoot: workspace })
  assert.equal(fs.existsSync(path.join(workspace, '.agents', 'skills')), false)
  assert.equal(integrationUnlink(options).changed, false)
  assert.equal(integrationRestoreSkills({ profileRoot: profile, dryRun: true }).operations.length, 7)
  integrationRestoreSkills({ profileRoot: profile })
  assert.equal(fs.existsSync(path.join(workspace, '.agents', 'skills')), true)
  integrationUnlink(options)
  assert.equal(fs.existsSync(path.join(workspace, '.agents', 'skills')), false)
})

test('Skill migration refuses a drifted junction before deleting any sibling', t => {
  const { root, profile, workspace } = setup(t)
  seedWorkspaceSkills({ productRoot, profileRoot: profile, workspaceRoot: workspace })
  const destination = path.join(workspace, '.codex', 'skills', 'nxt-context'), outside = path.join(root, 'outside')
  fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'canary'), 'keep'); fs.unlinkSync(destination); fs.symlinkSync(outside, destination, 'junction')
  assert.throws(() => integrationUnlink({ profileRoot: profile, scope: 'skills' }), { code: 'INTEGRATION_CONFLICT' })
  assert.equal(fs.existsSync(path.join(workspace, '.agents', 'skills')), true)
  assert.equal(fs.readFileSync(path.join(outside, 'canary'), 'utf8'), 'keep')
})

test('Skill migration resumes after every removed junction and retains launcher', t => {
  for (const id of ['skill-root:workspace', 'support:codex:references', ...['nxt-context', 'nxt-application', 'nxt-networking', 'nxt-opportunity', 'nxt-review'].map(name => `skill:codex:${name}`)]) {
    const { profile, workspace } = setup(t)
    seedWorkspaceSkills({ productRoot, profileRoot: profile, workspaceRoot: workspace })
    assert.throws(() => integrationUnlink({ profileRoot: profile, scope: 'skills', failAfter: id }), { code: 'INJECTED_FAILURE' })
    assert.equal(integrationStatus({ profileRoot: profile }).state, 'recovery_required')
    integrationUnlink({ profileRoot: profile, scope: 'skills' })
    assert.equal(integrationStatus({ profileRoot: profile }).state, 'linked')
    assert.equal(fs.existsSync(path.join(workspace, '.agents', 'skills')), false)
    assert.equal(fs.existsSync(path.join(profile, 'bin')), true)
  }
})

test('Migration rollback refuses occupied destinations and preserves external data', t => {
  const { profile, workspace } = setup(t)
  seedWorkspaceSkills({ productRoot, profileRoot: profile, workspaceRoot: workspace })
  integrationUnlink({ profileRoot: profile, scope: 'skills' })
  const occupied = path.join(workspace, '.codex', 'skills', 'nxt-context')
  fs.mkdirSync(occupied); fs.writeFileSync(path.join(occupied, 'canary'), 'keep')
  assert.throws(() => integrationRestoreSkills({ profileRoot: profile }), { code: 'INTEGRATION_CONFLICT' })
  assert.equal(fs.readFileSync(path.join(occupied, 'canary'), 'utf8'), 'keep')
  assert.equal(fs.existsSync(path.join(workspace, '.agents', 'skills')), false)
})

test('CLI health does not require locally activated skills', t => {
  const { profile, workspace } = setup(t)
  let value = { exists: true, type: 'REG_SZ', value: '' }
  const pathAdapter = { read: () => value, write: next => { value = next } }
  integrationLink({ productRoot, profileRoot: profile, manageUserPath: true, pathAdapter })
  const result = integrationDoctor({ profileRoot: profile, workspaceRoot: workspace, pathAdapter, paths: { vaultRoot: workspace, dataRootSource: 'argument' }, env: { PATH: path.join(profile, 'bin') } })
  assert.equal(result.healthy, true)
  assert.equal(result.skills.state, 'externally_managed')
  assert.equal(result.skills.hostEvidence, 'not_run')
})

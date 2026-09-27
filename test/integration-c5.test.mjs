import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { seedWorkspaceSkills } from './fixtures/workspace-skills.mjs'
import { integrationDoctor, integrationLink, integrationStatus, integrationUnlink } from '../src/integration.mjs'

function roots(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-c5-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const product = path.join(root, 'product'), profile = path.join(root, 'profile'), workspace = path.join(root, 'workspace')
  fs.mkdirSync(path.join(product, 'bin'), { recursive: true }); fs.mkdirSync(path.join(product, 'launchers', 'windows'), { recursive: true }); fs.mkdirSync(path.join(product, 'skills', 'references'), { recursive: true }); fs.mkdirSync(path.join(product, 'skills', 'nxt-synthetic'), { recursive: true }); fs.mkdirSync(workspace)
  fs.writeFileSync(path.join(product, 'package.json'), '{"name":"nextstep","version":"2.0.0"}\n')
  fs.writeFileSync(path.join(product, 'bin', 'nextstep.mjs'), '')
  fs.writeFileSync(path.join(product, 'launchers', 'windows', 'nextstep.cmd'), '')
  fs.writeFileSync(path.join(product, 'launchers', 'windows', 'nextstep-launcher.mjs'), '')
  fs.writeFileSync(path.join(product, 'skills', 'references', 'context.md'), '# context\n')
  fs.writeFileSync(path.join(product, 'skills', 'nxt-synthetic', 'SKILL.md'), '---\nname: nxt-synthetic\ndescription: Exercise synthetic linked maintenance behavior.\n---\n')
  fs.writeFileSync(path.join(workspace, 'AGENTS.md'), '# synthetic C5\n')
  return { root, product, profile, workspace }
}

test('C5 remembers a registered skill whose source disappeared and unlinks the broken junction safely', t => {
  const { product, profile, workspace } = roots(t), source = path.join(product, 'skills', 'nxt-synthetic'), parked = `${source}-parked`, destination = path.join(workspace, '.codex', 'skills', 'nxt-synthetic')
  seedWorkspaceSkills({ productRoot: product, profileRoot: profile, workspaceRoot: workspace })
  fs.renameSync(source, parked)
  try {
    const status = integrationStatus({ profileRoot: profile, workspaceRoot: workspace })
    const skill = status.skills.links.find(item => item.name === 'nxt-synthetic')
    assert.equal(status.status, 'degraded')
    assert.equal(skill.state, 'broken')
    assert.equal(fs.lstatSync(destination).isSymbolicLink(), true)
    assert.equal(integrationUnlink({ profileRoot: profile, workspaceRoot: workspace }).state, 'not_linked')
    assert.equal(fs.existsSync(destination), false)
    assert.equal(fs.existsSync(parked), true)
  } finally { if (!fs.existsSync(source) && fs.existsSync(parked)) fs.renameSync(parked, source) }
})

test('C5 remembers every registered Codex link when the complete skills source root disappears', t => {
  const { product, profile, workspace } = roots(t), source = path.join(product, 'skills'), parked = `${source}-parked`
  seedWorkspaceSkills({ productRoot: product, profileRoot: profile, workspaceRoot: workspace })
  fs.renameSync(source, parked)
  try {
    const status = integrationStatus({ profileRoot: profile, workspaceRoot: workspace })
    assert.equal(status.status, 'degraded')
    assert.deepEqual(status.skills.links.filter(item => item.host === 'codex').map(item => [item.name, item.state]), [['references', 'broken'], ['nxt-synthetic', 'broken']])
    integrationUnlink({ profileRoot: profile, workspaceRoot: workspace })
    assert.equal(fs.existsSync(parked), true)
  } finally { if (!fs.existsSync(source) && fs.existsSync(parked)) fs.renameSync(parked, source) }
})

test('C5 preserves an unrelated occupied Codex references destination', t => {
  const { product, profile, workspace } = roots(t), destination = path.join(workspace, '.codex', 'skills', 'references')
  fs.mkdirSync(destination, { recursive: true }); fs.writeFileSync(path.join(destination, 'canary'), 'preserve')
  integrationLink({ productRoot: product, profileRoot: profile, workspaceRoot: workspace })
  assert.equal(fs.readFileSync(path.join(destination, 'canary'), 'utf8'), 'preserve')
  assert.equal(fs.existsSync(path.join(profile, 'bin')), true)
})

test('C5 CLI installation does not depend on skill references', t => {
  const { product, profile, workspace } = roots(t)
  fs.rmSync(path.join(product, 'skills', 'references'), { recursive: true })
  integrationLink({ productRoot: product, profileRoot: profile, workspaceRoot: workspace })
  assert.equal(fs.existsSync(path.join(profile, 'bin')), true)
  assert.equal(fs.existsSync(path.join(workspace, '.agents', 'skills')), false)
  assert.equal(fs.existsSync(path.join(workspace, '.codex', 'skills', 'references')), false)
})

test('C5 doctor distinguishes an unmanaged user PATH from the current process PATH', t => {
  const { product, profile, workspace } = roots(t)
  integrationLink({ productRoot: product, profileRoot: profile, workspaceRoot: workspace })
  const result = integrationDoctor({ profileRoot: profile, workspaceRoot: workspace, env: { PATH: '' } })
  assert.equal(result.executable.persistedPath, false)
  assert.match(result.executable.correction, /--manage-user-path/)
  integrationUnlink({ profileRoot: profile, workspaceRoot: workspace })
})

test('C5 doctor reports external skill defects without degrading managed nxt skills', t => {
  const { product, profile, workspace } = roots(t)
  let pathState = { exists: true, type: 'REG_SZ', value: '' }
  const adapter = { read: () => ({ ...pathState }), write: next => { pathState = { ...next } } }
  integrationLink({ productRoot: product, profileRoot: profile, workspaceRoot: workspace, manageUserPath: true, pathAdapter: adapter })
  const external = path.join(workspace, '.codex', 'skills', 'holoself'); fs.mkdirSync(external, { recursive: true }); fs.writeFileSync(path.join(external, 'SKILL.md'), 'name: invalid\n')
  const paths = { vaultRoot: workspace, dataRootSource: 'argument', instanceConfig: { instanceId: 'synthetic' } }
  const result = integrationDoctor({ profileRoot: profile, workspaceRoot: workspace, pathAdapter: adapter, paths, env: { PATH: path.join(profile, 'bin') } })
  assert.equal(result.skills.invalid.length, 1)
  assert.equal(result.skills.managedInvalid.length, 0)
  assert.equal(result.skills.healthy, true)
  assert.equal(result.healthy, true)
  integrationUnlink({ profileRoot: profile, workspaceRoot: workspace, pathAdapter: adapter })
})

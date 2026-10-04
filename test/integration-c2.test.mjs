import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import platformTest from 'node:test'

// These suites exercise the Windows-only linked installation contract.
const test = (name, fn) => platformTest(name, { skip: process.platform !== 'win32' ? 'Windows linked installation only' : false }, fn)
import { main } from '../src/cli.mjs'
import { integrationDoctor, integrationLink, integrationPlan, integrationStatus, integrationUnlink, skillInventory } from '../src/integration.mjs'
import { projectLink, projectUnlink } from '../src/instance-config.mjs'
import { cleanEnvironment } from '../scripts/c0-baseline.mjs'

const productRoot = path.resolve(import.meta.dirname, '..')

function withoutNextstepEnv(t) {
  const saved = {}
  for (const key of Object.keys(process.env)) if (/^NEXTSTEP_/i.test(key)) { saved[key] = process.env[key]; delete process.env[key] }
  t.after(() => { for (const [key, value] of Object.entries(saved)) process.env[key] = value })
}

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-c2-integration-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const profile = path.join(root, 'profile'), workspace = path.join(root, 'workspace')
  fs.mkdirSync(workspace); fs.writeFileSync(path.join(workspace, 'AGENTS.md'), '# fixture\n')
  return { root, profile, workspace }
}

function memoryPath(initial = { exists: false, type: null, value: '' }) {
  let state = structuredClone(initial)
  return { read: () => structuredClone(state), write: value => { state = structuredClone(value) }, state: () => structuredClone(state) }
}

test('CLI linking leaves workspace skill directories untouched', t => {
  const { profile, workspace } = setup(t)
  const occupied = path.join(workspace, '.agents', 'skills')
  fs.mkdirSync(occupied, { recursive: true }); fs.writeFileSync(path.join(occupied, 'canary'), 'keep')
  const plan = integrationPlan({ productRoot, profileRoot: profile, workspaceRoot: workspace })
  assert.equal(plan.skills.state, 'externally_managed')
  assert.equal(plan.operations.length, 1)
  integrationLink({ productRoot, profileRoot: profile, workspaceRoot: workspace })
  assert.equal(fs.readFileSync(path.join(occupied, 'canary'), 'utf8'), 'keep')
  assert.equal(fs.existsSync(path.join(workspace, '.codex', 'skills')), false)
  integrationUnlink({ profileRoot: profile })
  assert.equal(fs.existsSync(occupied), true)
})

test('C2-08 inventory identifies names from frontmatter and invalid manifests', t => {
  const { root } = setup(t), skills = path.join(root, 'skills')
  const make = (dir, name, valid = true) => { fs.mkdirSync(path.join(skills, dir), { recursive: true }); fs.writeFileSync(path.join(skills, dir, 'SKILL.md'), valid ? `---\nname: ${name}\ndescription: test\n---\n` : `name: ${name}\n`) }
  make('one', 'duplicate'); make('two', 'duplicate'); make('same', 'different'); make('invalid', 'bad', false); make('quoted', '"duplicate"')
  const inventory = skillInventory(skills)
  assert.deepEqual(inventory.duplicates.map(item => item.name), ['duplicate'])
  assert.equal(inventory.skills.some(item => item.name === 'different' && path.basename(path.dirname(item.file)) === 'same'), true)
  assert.equal(inventory.invalid.length, 2)
})

test('C2-09/10 manages PATH once, preserves type and concurrent entries, then removes its segment', t => {
  const { profile, workspace } = setup(t), adapter = memoryPath({ exists: true, type: 'REG_SZ', value: 'C:\\Other' })
  const linked = integrationLink({ productRoot, profileRoot: profile, workspaceRoot: workspace, manageUserPath: true, pathAdapter: adapter })
  assert.equal(linked.userPath.originalType, 'REG_SZ')
  assert.match(adapter.state().value, /Other/)
  assert.equal(adapter.state().value.toLowerCase().split(';').filter(item => item === path.join(profile, 'bin').toLowerCase()).length, 1)
  integrationLink({ productRoot, profileRoot: profile, workspaceRoot: workspace, manageUserPath: true, pathAdapter: adapter })
  adapter.write({ exists: true, type: 'REG_SZ', value: `${adapter.state().value};C:\\Concurrent` })
  integrationUnlink({ profileRoot: profile, workspaceRoot: workspace, pathAdapter: adapter })
  assert.equal(adapter.state().value, 'C:\\Other;C:\\Concurrent')
})

test('C2-09 accepts an absent PATH and an existing segment with different casing', t => {
  for (const initial of [{ exists: false, type: null, value: '' }, { exists: true, type: 'REG_EXPAND_SZ', value: '' }]) {
    const { profile, workspace } = setup(t), adapter = memoryPath(initial)
    if (initial.exists) initial.value = path.join(profile, 'bin').toUpperCase()
    adapter.write(initial)
    const linked = integrationLink({ productRoot, profileRoot: profile, workspaceRoot: workspace, manageUserPath: true, pathAdapter: adapter })
    assert.equal(adapter.state().type, 'REG_EXPAND_SZ')
    assert.equal(adapter.state().value.toLowerCase().split(';').filter(item => item === path.join(profile, 'bin').toLowerCase()).length, 1)
    assert.equal(linked.userPath?.newProcessRequired ?? false, !initial.exists)
    integrationUnlink({ profileRoot: profile, workspaceRoot: workspace, pathAdapter: adapter })
  }
})

test('C2-10 detects a PATH change between plan and apply without overwriting it', t => {
  const { profile, workspace } = setup(t)
  let reads = 0, state = { exists: true, type: 'REG_SZ', value: 'C:\\Before' }
  const adapter = { read() { reads++; if (reads === 2) state = { exists: true, type: 'REG_SZ', value: 'C:\\Concurrent' }; return structuredClone(state) }, write(value) { state = structuredClone(value) } }
  assert.throws(() => integrationLink({ productRoot, profileRoot: profile, workspaceRoot: workspace, manageUserPath: true, pathAdapter: adapter }), error => error.code === 'INTEGRATION_CONFLICT')
  assert.equal(state.value, 'C:\\Concurrent')
  assert.equal(fs.existsSync(path.join(profile, 'integration-v1.json')), false)
  assert.equal(fs.existsSync(path.join(profile, 'bin')), false)
})

test('C2-10/16 failed composite relink restores a pre-existing zero-link registry byte-for-byte', t => {
  const { profile, workspace } = setup(t), initialAdapter = memoryPath()
  integrationLink({ productRoot, profileRoot: profile })
  const file = path.join(profile, 'integration-v1.json'), registry = JSON.parse(fs.readFileSync(file, 'utf8'))
  registry.unknownTop = { preserve: true }; fs.writeFileSync(file, `${JSON.stringify(registry, null, 4)}\n`)
  integrationUnlink({ profileRoot: profile, pathAdapter: initialAdapter })
  const before = fs.readFileSync(file)
  let reads = 0, state = { exists: true, type: 'REG_SZ', value: 'C:\\Before' }
  const racing = { read() { reads++; if (reads === 2) state = { exists: true, type: 'REG_SZ', value: 'C:\\Concurrent' }; return structuredClone(state) }, write(value) { state = structuredClone(value) } }
  assert.throws(() => integrationLink({ productRoot, profileRoot: profile, workspaceRoot: workspace, manageUserPath: true, pathAdapter: racing }), error => error.code === 'INTEGRATION_CONFLICT')
  assert.deepEqual(fs.readFileSync(file), before)
  assert.equal(fs.existsSync(path.join(profile, 'bin')), false)
  assert.equal(fs.existsSync(path.join(workspace, '.agents', 'skills')), false)
})

test('C2-11 recovers interrupted PATH augmentation without touching source', t => {
  for (const phase of ['path']) {
    const { profile, workspace } = setup(t), adapter = memoryPath({ exists: true, type: 'REG_SZ', value: 'C:\\Original' })
    assert.throws(() => integrationLink({ productRoot, profileRoot: profile, workspaceRoot: workspace, manageUserPath: true, pathAdapter: adapter, failAfter: phase }), error => error.code === 'INJECTED_FAILURE')
    assert.equal(integrationStatus({ profileRoot: profile, workspaceRoot: workspace, pathAdapter: adapter }).state, 'recovery_required')
    const recovered = integrationLink({ productRoot, profileRoot: profile, workspaceRoot: workspace, manageUserPath: true, pathAdapter: adapter })
    assert.equal(recovered.state, 'linked')
    assert.equal(fs.existsSync(path.join(profile, 'transactions', 'host-active.json')), false)
    assert.equal(fs.existsSync(path.join(productRoot, 'skills', 'nxt-context', 'SKILL.md')), true)
    integrationUnlink({ profileRoot: profile, workspaceRoot: workspace, pathAdapter: adapter })
  }
})

test('C2-11 resumes interrupted unlink in inverse order', t => {
  for (const phase of ['unlink_path', 'unlink_skill']) {
    const { profile, workspace } = setup(t), adapter = memoryPath({ exists: true, type: 'REG_SZ', value: 'C:\\Original' })
    integrationLink({ productRoot, profileRoot: profile, workspaceRoot: workspace, manageUserPath: true, pathAdapter: adapter })
    assert.throws(() => integrationUnlink({ profileRoot: profile, workspaceRoot: workspace, pathAdapter: adapter, failAfter: phase }), error => error.code === 'INJECTED_FAILURE')
    assert.equal(integrationStatus({ profileRoot: profile, workspaceRoot: workspace, pathAdapter: adapter }).state, 'recovery_required')
    const result = integrationUnlink({ profileRoot: profile, workspaceRoot: workspace, pathAdapter: adapter })
    assert.equal(result.state, 'not_linked')
    assert.equal(adapter.state().value, 'C:\\Original')
    assert.equal(fs.existsSync(path.join(workspace, '.agents', 'skills')), false)
  }
})

test('C2-07 rejects a workspace whose .agents parent escapes through a junction', t => {
  const { root, profile, workspace } = setup(t), outside = path.join(root, 'outside')
  fs.mkdirSync(outside); fs.symlinkSync(outside, path.join(workspace, '.agents'), 'junction')
  assert.throws(() => integrationPlan({ productRoot, profileRoot: profile, workspaceRoot: workspace }), error => error.code === 'INVALID_WORKSPACE_ROOT')
  assert.deepEqual(fs.readdirSync(outside), [])
})

test('C2-06 reports cloud-sync workspace placement', t => {
  const { root, profile, workspace } = setup(t)
  const plan = integrationPlan({ productRoot, profileRoot: profile, workspaceRoot: workspace, env: { ...process.env, OneDrive: root } })
  assert.equal(plan.skills.state, 'externally_managed')
  assert.equal(plan.operations.some(item => item.destination?.startsWith(workspace)), false)
})

test('C2-14 a fresh process resolves the command through PATH and the instance through its marker', t => {
  const { profile, workspace } = setup(t), vault = path.join(workspace, 'vault')
  fs.mkdirSync(path.join(vault, 'Master'), { recursive: true })
  fs.mkdirSync(path.join(vault, 'Candidatures', 'records'), { recursive: true })
  fs.writeFileSync(path.join(vault, 'Candidatures', 'records', 'manifest.json'), '{}\n')
  integrationLink({ productRoot, profileRoot: profile })
  const registry = JSON.parse(fs.readFileSync(path.join(profile, 'integration-v1.json'), 'utf8'))
  fs.writeFileSync(path.join(vault, 'nextstep.yaml'), 'schema_version: 1\ninstance_id: process-test\ndata_root: .\n')
  const command = `nextstep doctor --json`
  const result = spawnSync('cmd.exe', ['/d', '/s', '/c', command], { cwd: vault, env: cleanEnvironment(process.env, { PATH: `${path.join(profile, 'bin')};${process.env.PATH}` }), encoding: 'utf8', windowsHide: true })
  assert.equal([0, 2].includes(result.status), true, result.stderr)
  assert.equal(JSON.parse(result.stdout).dataRoot, fs.realpathSync.native(vault))
  assert.equal(registry.productRootReal, fs.realpathSync.native(productRoot))
  integrationUnlink({ profileRoot: profile })
})

test('C2-12 integration doctor works without a data root and performs no repair', async t => {
  withoutNextstepEnv(t)
  const { profile } = setup(t)
  let out = '', err = ''
  const code = await main(['doctor', '--integration', '--profile-root', profile, '--json'], { out: { write: value => { out += value } }, err: { write: value => { err += value } } })
  assert.equal(code, 2)
  assert.equal(err, '')
  const result = JSON.parse(out)
  assert.equal(result.instance.status, 'not_resolved')
  assert.equal(result.healthy, false)
  assert.equal(fs.existsSync(profile), false)
})

test('C2-16 registry extensions preserve unknown fields', t => {
  const { profile, workspace } = setup(t), adapter = memoryPath()
  integrationLink({ productRoot, profileRoot: profile })
  const file = path.join(profile, 'integration-v1.json'), registry = JSON.parse(fs.readFileSync(file, 'utf8'))
  registry.extension = { keep: ['exact', 7] }; registry.managedLinks[0].extension = 'keep-link'
  fs.writeFileSync(file, `${JSON.stringify(registry, null, 2)}\n`)
  integrationLink({ productRoot, profileRoot: profile, workspaceRoot: workspace, manageUserPath: true, pathAdapter: adapter })
  const after = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.deepEqual(after.extension, { keep: ['exact', 7] })
  assert.equal(after.managedLinks.find(item => item.id === 'tool:nextstep').extension, 'keep-link')
  integrationUnlink({ profileRoot: profile, workspaceRoot: workspace, pathAdapter: adapter })
  const preserved = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.deepEqual(preserved.extension, { keep: ['exact', 7] })
  assert.deepEqual(preserved.managedLinks, [])
  integrationLink({ productRoot, profileRoot: profile })
  const relinked = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.deepEqual(relinked.extension, { keep: ['exact', 7] })
  assert.equal(relinked.managedLinks.some(item => item.id === 'tool:nextstep'), true)
  integrationUnlink({ profileRoot: profile })
})

test('C2 doctor separates filesystem visibility from host activation', t => {
  const { profile, workspace } = setup(t), adapter = memoryPath()
  integrationLink({ productRoot, profileRoot: profile, workspaceRoot: workspace, manageUserPath: true, pathAdapter: adapter })
  const result = integrationDoctor({ profileRoot: profile, workspaceRoot: workspace, pathAdapter: adapter, env: { PATH: '' } })
  assert.equal(result.skills.hostEvidence, 'not_run')
  assert.equal(result.executable.persistedPath, true)
  assert.equal(result.executable.processPath, false)
  assert.equal(result.executable.newProcessRequired, true)
  integrationUnlink({ profileRoot: profile, workspaceRoot: workspace, pathAdapter: adapter })
})

test('C2-08/12 doctor degrades for duplicate names and invalid manifests in alternate host destinations', t => {
  const { profile, workspace } = setup(t), adapter = memoryPath(), vault = path.join(workspace, 'vault')
  fs.mkdirSync(path.join(vault, 'Master'), { recursive: true }); fs.mkdirSync(path.join(vault, 'Candidatures', 'records'), { recursive: true }); fs.writeFileSync(path.join(vault, 'Candidatures', 'records', 'manifest.json'), '{}\n')
  integrationLink({ productRoot, profileRoot: profile, workspaceRoot: workspace, manageUserPath: true, pathAdapter: adapter })
  const first = path.join(workspace, '.agents', 'skills', 'nxt-context'); fs.mkdirSync(first, { recursive: true }); fs.writeFileSync(path.join(first, 'SKILL.md'), '---\nname: nxt-context\ndescription: duplicate\n---\n')
  const duplicate = path.join(workspace, '.gemini', 'skills', 'other'); fs.mkdirSync(duplicate, { recursive: true }); fs.writeFileSync(path.join(duplicate, 'SKILL.md'), '---\nname: nxt-context\ndescription: duplicate\n---\n')
  const invalid = path.join(workspace, '.codex', 'skills', 'nxt-invalid'); fs.mkdirSync(invalid, { recursive: true }); fs.writeFileSync(path.join(invalid, 'SKILL.md'), 'name: invalid\n')
  const paths = { vaultRoot: vault, dataRootSource: 'argument', instanceConfig: null }
  const result = integrationDoctor({ profileRoot: profile, workspaceRoot: workspace, pathAdapter: adapter, paths, env: { PATH: path.join(profile, 'bin') } })
  assert.equal(result.healthy, false)
  assert.equal(result.status, 'degraded')
  assert.deepEqual(result.skills.duplicates.map(item => item.name), ['nxt-context'])
  assert.equal(result.skills.invalid.length, 1)
  assert.equal(result.skills.managedInvalid.length, 1)
  assert.equal(result.product.status, 'available')
  assert.equal(result.product.runtime.compatible, true)
  integrationUnlink({ profileRoot: profile, workspaceRoot: workspace, pathAdapter: adapter })
})

test('C2-11/12 doctor reports project unlink recovery phase and action', t => {
  const { profile, workspace } = setup(t), vault = path.join(workspace, 'vault')
  fs.mkdirSync(path.join(vault, 'Master'), { recursive: true }); fs.mkdirSync(path.join(vault, 'Candidatures', 'records'), { recursive: true }); fs.writeFileSync(path.join(vault, 'Candidatures', 'records', 'manifest.json'), '{}\n')
  integrationLink({ productRoot, profileRoot: profile })
  projectLink({ dataRoot: vault, instanceId: 'doctor-test', profileRoot: profile })
  assert.throws(() => projectUnlink({ dataRoot: vault, profileRoot: profile, failAfter: 'marker_removed' }), error => error.code === 'INJECTED_FAILURE')
  const result = integrationDoctor({ profileRoot: profile, paths: { vaultRoot: vault, dataRootSource: 'argument', instanceConfig: null } })
  assert.equal(result.recovery.status, 'pending')
  assert.equal(result.recovery.operation, 'project-unlink')
  assert.equal(result.recovery.phase, 'marker_removed')
  assert.match(result.recovery.action, /project unlink/)
  projectUnlink({ dataRoot: vault, profileRoot: profile })
  integrationUnlink({ profileRoot: profile })
})

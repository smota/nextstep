import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { resolvePaths } from '../src/config.mjs'
import { integrationLink, integrationUnlink } from '../src/integration.mjs'
import { parseInstanceConfig, projectLink, projectPlan, projectRecoveryStatus, projectStatus, projectUnlink } from '../src/instance-config.mjs'

const productRoot = path.resolve(import.meta.dirname, '..')

function roots(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-c2-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const vault = path.join(root, 'vault'), profile = path.join(root, 'profile')
  fs.mkdirSync(path.join(vault, 'Master'), { recursive: true })
  fs.mkdirSync(path.join(vault, 'Candidatures', 'records'), { recursive: true })
  fs.writeFileSync(path.join(vault, 'Candidatures', 'records', 'manifest.json'), '{}\n')
  integrationLink({ productRoot, profileRoot: profile })
  t.after(() => { try { integrationUnlink({ profileRoot: profile }) } catch {} })
  return { root, vault, profile }
}

test('C2-01/02 marker resolves from a subdirectory with defined precedence', t => {
  const { root, vault, profile } = roots(t)
  projectLink({ dataRoot: vault, instanceId: 'nextstep-test', profileRoot: profile })
  const nested = path.join(vault, 'Candidatures', 'artifacts'); fs.mkdirSync(nested)
  const marker = resolvePaths({ cwd: nested, env: {} })
  assert.equal(marker.vaultRoot, fs.realpathSync.native(vault))
  assert.equal(marker.dataRootSource, 'marker')
  assert.equal(marker.instanceConfig.instanceId, 'nextstep-test')
  const explicit = path.join(root, 'explicit'); fs.cpSync(vault, explicit, { recursive: true }); fs.unlinkSync(path.join(explicit, 'nextstep.yaml'))
  assert.equal(resolvePaths({ dataRoot: explicit, cwd: nested, env: {} }).dataRootSource, 'argument')
  // The removed NEXTSTEP_DATA_ROOT variable is ignored: it neither beats the marker nor rescues a cwd outside any vault.
  assert.equal(resolvePaths({ cwd: nested, env: { NEXTSTEP_DATA_ROOT: explicit } }).dataRootSource, 'marker')
  assert.throws(() => resolvePaths({ cwd: root, env: { NEXTSTEP_DATA_ROOT: explicit } }), error => error.code === 'DATA_ROOT_REQUIRED')
})

test('C2-03/04 nearest invalid marker fails closed and grammar is restricted', t => {
  const { vault, profile } = roots(t)
  projectLink({ dataRoot: vault, instanceId: 'nextstep-test', profileRoot: profile })
  const nested = path.join(vault, 'bad'); fs.mkdirSync(nested)
  fs.writeFileSync(path.join(nested, 'nextstep.yaml'), 'schema_version: 1\ninstance_id: yes\ndata_root: .\n')
  assert.throws(() => resolvePaths({ cwd: nested, env: {} }), error => error.code === 'INVALID_INSTANCE_CONFIG')
  for (const text of [
    'schema_version: 1\ninstance_id: x\ndata_root: ..\n',
    'schema_version: 1\ninstance_id: &x\ndata_root: .\n',
    'schema_version: 1\ninstance_id: x\ndata_root: |\n',
    'schema_version: 1\ninstance_id: x\ninstance_id: y\ndata_root: .\n',
    ' schema_version: 1\ninstance_id: x\ndata_root: .\n',
    'schema_version: 1 \ninstance_id: x\ndata_root: .\n'
  ]) assert.throws(() => parseInstanceConfig(text), error => error.code === 'INVALID_INSTANCE_CONFIG')
})

test('C2-05 project link is idempotent and preserves conflicts', t => {
  const { vault, profile } = roots(t)
  assert.equal(projectPlan({ dataRoot: vault, instanceId: 'nextstep-test', profileRoot: profile }).state, 'not_linked')
  assert.equal(projectLink({ dataRoot: vault, instanceId: 'nextstep-test', profileRoot: profile }).changed, true)
  assert.equal(projectLink({ dataRoot: vault, instanceId: 'nextstep-test', profileRoot: profile }).changed, false)
  assert.equal(projectStatus({ dataRoot: vault, profileRoot: profile }).state, 'linked')
  fs.appendFileSync(path.join(vault, 'nextstep.yaml'), '# changed\n')
  assert.equal(projectStatus({ dataRoot: vault, profileRoot: profile }).state, 'drifted')
  assert.throws(() => projectUnlink({ dataRoot: vault, profileRoot: profile }), error => error.code === 'INTEGRATION_DRIFT')
  assert.match(fs.readFileSync(path.join(vault, 'nextstep.yaml'), 'utf8'), /changed/)
})

test('C2-05 adopts ownership of an identical marker without rewriting it', t => {
  const { vault, profile } = roots(t), marker = path.join(vault, 'nextstep.yaml')
  const content = 'schema_version: 1\ninstance_id: nextstep-test\ndata_root: .\n'
  fs.writeFileSync(marker, content)
  assert.equal(projectPlan({ dataRoot: vault, instanceId: 'nextstep-test', profileRoot: profile }).state, 'unmanaged')
  assert.equal(projectLink({ dataRoot: vault, instanceId: 'nextstep-test', profileRoot: profile }).changed, true)
  assert.equal(fs.readFileSync(marker, 'utf8'), content)
  assert.equal(projectStatus({ dataRoot: vault, profileRoot: profile }).state, 'linked')
  assert.equal(projectUnlink({ dataRoot: vault, profileRoot: profile }).changed, true)
})

test('C2 project link rejects a directory that is not a vault', t => {
  const { root, profile } = roots(t), empty = path.join(root, 'empty'); fs.mkdirSync(empty)
  assert.throws(() => projectLink({ dataRoot: empty, instanceId: 'nextstep-test', profileRoot: profile }), error => error.code === 'INVALID_DATA_ROOT')
  assert.equal(fs.existsSync(path.join(empty, 'nextstep.yaml')), false)
})

test('C2-11 project ownership failure rolls back a newly created marker', t => {
  const { vault, profile } = roots(t)
  fs.writeFileSync(path.join(profile, 'projects'), 'occupied')
  assert.throws(() => projectLink({ dataRoot: vault, instanceId: 'nextstep-test', profileRoot: profile }))
  assert.equal(fs.existsSync(path.join(vault, 'nextstep.yaml')), false)
  assert.equal(fs.readFileSync(path.join(profile, 'projects'), 'utf8'), 'occupied')
})

test('C2-11 project unlink resumes after interruption following marker removal', t => {
  const { vault, profile } = roots(t)
  projectLink({ dataRoot: vault, instanceId: 'nextstep-test', profileRoot: profile })
  assert.throws(() => projectUnlink({ dataRoot: vault, profileRoot: profile, failAfter: 'marker_removed' }), error => error.code === 'INJECTED_FAILURE')
  assert.equal(projectStatus({ dataRoot: vault, profileRoot: profile }).state, 'recovery_required')
  const recovered = projectUnlink({ dataRoot: vault, profileRoot: profile })
  assert.equal(recovered.recovered, true)
  assert.equal(projectStatus({ dataRoot: vault, profileRoot: profile }).state, 'not_linked')
})

test('C2-11 project unlink prepared phase is diagnosed before marker removal', t => {
  const { vault, profile } = roots(t)
  projectLink({ dataRoot: vault, instanceId: 'nextstep-test', profileRoot: profile })
  const projects = path.join(profile, 'projects'), file = path.join(projects, fs.readdirSync(projects)[0]), record = JSON.parse(fs.readFileSync(file, 'utf8'))
  fs.writeFileSync(file, `${JSON.stringify({ ...record, unlinking: true, unlinkStartedAt: new Date().toISOString() }, null, 2)}\n`)
  assert.equal(projectStatus({ dataRoot: vault, profileRoot: profile }).state, 'recovery_required')
  assert.equal(projectRecoveryStatus({ dataRoot: vault, profileRoot: profile }).phase, 'unlink_prepared')
  assert.equal(projectUnlink({ dataRoot: vault, profileRoot: profile }).changed, true)
})

test('C2-13 marker survives disposable state rebuild and owned unlink removes only marker', t => {
  const { vault, profile } = roots(t)
  projectLink({ dataRoot: vault, instanceId: 'nextstep-test', profileRoot: profile })
  const state = path.join(vault, '.nextstep'); fs.mkdirSync(state); fs.writeFileSync(path.join(state, 'throwaway'), 'x'); fs.rmSync(state, { recursive: true })
  assert.equal(resolvePaths({ cwd: vault, env: {} }).dataRootSource, 'marker')
  assert.equal(projectUnlink({ dataRoot: vault, profileRoot: profile }).changed, true)
  assert.equal(fs.existsSync(path.join(vault, 'nextstep.yaml')), false)
  assert.equal(fs.existsSync(path.join(vault, 'Master')), true)
})

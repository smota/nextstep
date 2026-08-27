import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { validateConfiguredPaths } from './paths.js'

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-paths-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const appRoot = path.join(root, 'app')
  const vaultRoot = path.join(root, 'data')
  const stateRoot = path.join(vaultRoot, '.nextstep')
  fs.mkdirSync(appRoot)
  for (const name of ['Candidatures', 'Master', '.coordination']) {
    fs.mkdirSync(path.join(vaultRoot, name), { recursive: true })
  }
  return { appRoot, vaultRoot, stateRoot, configuredDataRoot: true }
}

test('accepts an explicit external data root with contained state', t => {
  const paths = fixture(t)
  assert.equal(validateConfiguredPaths(paths, { NEXTSTEP_DATA_ROOT: paths.vaultRoot }), paths)
})

test('requires an explicitly configured absolute data root', t => {
  const paths = fixture(t)
  assert.throws(() => validateConfiguredPaths(paths, {}), /must be configured/)
  assert.throws(() => validateConfiguredPaths(paths, { NEXTSTEP_DATA_ROOT: 'relative' }), /absolute path/)
})

test('rejects data or state inside the application repository', t => {
  const paths = fixture(t)
  const dataInApp = { ...paths, vaultRoot: path.join(paths.appRoot, 'data') }
  assert.throws(() => validateConfiguredPaths(dataInApp, { NEXTSTEP_DATA_ROOT: dataInApp.vaultRoot }), /NEXTSTEP_DATA_ROOT must be outside/i)
  const stateInApp = { ...paths, stateRoot: path.join(paths.appRoot, '.nextstep') }
  assert.throws(() => validateConfiguredPaths(stateInApp, { NEXTSTEP_DATA_ROOT: paths.vaultRoot }), /NEXTSTEP_STATE_ROOT must be outside/i)
})

test('requires state beneath data and the expected data directories', t => {
  const paths = fixture(t)
  assert.throws(() => validateConfiguredPaths({ ...paths, stateRoot: path.join(path.dirname(paths.vaultRoot), 'state') }, { NEXTSTEP_DATA_ROOT: paths.vaultRoot }), /contained by/)
  fs.rmSync(path.join(paths.vaultRoot, 'Master'), { recursive: true })
  assert.throws(() => validateConfiguredPaths(paths, { NEXTSTEP_DATA_ROOT: paths.vaultRoot }), /missing required directory: Master/)
})

test('rejects a data symlink or junction that physically resolves inside the application repository', t => {
  const paths = fixture(t)
  const target = path.join(paths.appRoot, 'private-data')
  fs.renameSync(paths.vaultRoot, target)
  try {
    fs.symlinkSync(target, paths.vaultRoot, process.platform === 'win32' ? 'junction' : 'dir')
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip(`symlink creation unavailable: ${error.code}`)
    throw error
  }
  assert.throws(() => validateConfiguredPaths(paths, { NEXTSTEP_DATA_ROOT: paths.vaultRoot }), /NEXTSTEP_DATA_ROOT must be outside/i)
})

test('rejects a state symlink or junction that physically resolves outside data or inside the application repository', t => {
  const paths = fixture(t)
  const target = path.join(paths.appRoot, 'runtime-state')
  fs.mkdirSync(target)
  try {
    fs.symlinkSync(target, paths.stateRoot, process.platform === 'win32' ? 'junction' : 'dir')
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip(`symlink creation unavailable: ${error.code}`)
    throw error
  }
  assert.throws(() => validateConfiguredPaths(paths, { NEXTSTEP_DATA_ROOT: paths.vaultRoot }), /NEXTSTEP_STATE_ROOT must be outside/i)
})

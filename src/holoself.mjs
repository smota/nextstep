import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

function candidates(env = process.env) {
  const dirs = new Set((env.PATH || '').split(path.delimiter).filter(Boolean))
  if (env.APPDATA) dirs.add(path.join(env.APPDATA, 'npm'))
  if (env.LOCALAPPDATA) dirs.add(path.join(env.LOCALAPPDATA, 'npm'))
  const values = []
  for (const dir of dirs) {
    values.push(path.join(dir, process.platform === 'win32' ? 'holoself.exe' : 'holoself'))
    if (process.platform === 'win32') values.push(path.join(dir, 'node_modules', 'holoself-ai', 'bin', 'holoself.mjs'))
  }
  return [...new Set(values.map(value => path.resolve(value)))]
}

export function discoverHoloself(env = process.env) {
  if (env.HOLOSELF_EXECUTABLE) {
    const file = path.resolve(env.HOLOSELF_EXECUTABLE)
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw Object.assign(new Error('Configured Holoself executable is unavailable'), { code: 'HOLOSELF_UNAVAILABLE' })
    if (/\.(?:mjs|js)$/i.test(file)) return { command: process.execPath, prefix: [fs.realpathSync.native(file)], source: 'explicit-override' }
    if (process.platform === 'win32' && !file.toLowerCase().endsWith('.exe')) throw Object.assign(new Error('Configured Windows Holoself executable must be an .exe or JavaScript entrypoint'), { code: 'HOLOSELF_UNTRUSTED' })
    return { command: fs.realpathSync.native(file), prefix: [], source: 'explicit-override' }
  }
  for (const file of candidates(env)) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue
    if (/\.(?:mjs|js)$/i.test(file)) return { command: process.execPath, prefix: [fs.realpathSync.native(file)], source: 'global-node-package' }
    if (process.platform === 'win32' && !file.toLowerCase().endsWith('.exe')) continue
    return { command: fs.realpathSync.native(file), prefix: [], source: 'global-executable' }
  }
  throw Object.assign(new Error('The global Holoself CLI is unavailable to this process'), { code: 'HOLOSELF_UNAVAILABLE' })
}

export function runHoloself(args, { env = process.env, cwd = process.cwd(), timeout = 10_000 } = {}) {
  const executable = discoverHoloself(env)
  const result = spawnSync(executable.command, [...executable.prefix, ...args], { cwd, env, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 2 * 1024 * 1024, shell: false })
  if (result.error) throw Object.assign(new Error(`Holoself failed: ${result.error.message}`), { code: result.error.code === 'ETIMEDOUT' ? 'HOLOSELF_TIMEOUT' : 'HOLOSELF_FAILED' })
  if (result.status !== 0) throw Object.assign(new Error(`Holoself failed with exit ${result.status}`), { code: 'HOLOSELF_FAILED', details: { stderr: String(result.stderr || '').slice(0, 2000) } })
  return { stdout: result.stdout, executable }
}

export function holoselfVersion(options) {
  const result = runHoloself(['capabilities', '--json'], options)
  let capabilities
  try { capabilities = JSON.parse(result.stdout) } catch { throw Object.assign(new Error('Holoself capabilities output is malformed'), { code: 'HOLOSELF_MALFORMED' }) }
  if (capabilities.product !== 'holoself' || !capabilities.version || !capabilities.contextSchemaVersion) throw Object.assign(new Error('Holoself capability contract is incomplete'), { code: 'HOLOSELF_INCOMPATIBLE' })
  return { available: true, version: capabilities.version, contextSchemaVersion: capabilities.contextSchemaVersion, source: result.executable.source }
}

export function holoselfContext(paths, { task, lens = 'career' } = {}) {
  const args = ['context', '--project', paths.vaultRoot, '--lens', lens, '--self-only', '--json']
  if (task) args.push('--task', task)
  const result = runHoloself(args, { cwd: paths.vaultRoot })
  try { return JSON.parse(result.stdout) } catch { throw Object.assign(new Error('Holoself returned malformed JSON'), { code: 'HOLOSELF_MALFORMED' }) }
}

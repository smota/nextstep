import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export const INSTANCE_CONFIG = 'nextstep.yaml'
const SCALAR = /^[A-Za-z0-9._-]+$/
const INSTANCE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/
const YAML_LIKE = new Set(['yes', 'no', 'true', 'false', 'null', '~'])

function fail(message, code, details) { throw Object.assign(new Error(message), { code, details }) }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex') }
function markerText(instanceId) { return `schema_version: 1\ninstance_id: ${instanceId}\ndata_root: .\n` }

export function parseInstanceConfig(text, file = INSTANCE_CONFIG) {
  if (text.charCodeAt(0) === 0xfeff || text.includes('\t')) fail('Instance config contains unsupported syntax', 'INVALID_INSTANCE_CONFIG', { file })
  const values = {}
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw
    if (!line || line.startsWith('#')) continue
    const match = /^([a-z_]+): ([A-Za-z0-9._-]+)$/.exec(line)
    if (!match || !SCALAR.test(match[2]) || YAML_LIKE.has(match[2].toLowerCase())) fail('Instance config contains unsupported syntax', 'INVALID_INSTANCE_CONFIG', { file, line: index + 1 })
    const [, key, value] = match
    if (!['schema_version', 'instance_id', 'data_root'].includes(key) || Object.hasOwn(values, key)) fail('Instance config contains an unknown or duplicate key', 'INVALID_INSTANCE_CONFIG', { file, line: index + 1, key })
    values[key] = value
  }
  if (Object.keys(values).length !== 3 || values.schema_version !== '1' || values.data_root !== '.' || !INSTANCE_ID.test(values.instance_id || '')) fail('Instance config values are invalid', 'INVALID_INSTANCE_CONFIG', { file })
  return { schemaVersion: 1, instanceId: values.instance_id, dataRoot: values.data_root }
}

export function findNearestInstanceConfig(start = process.cwd()) {
  let current = path.resolve(start)
  while (true) {
    const file = path.join(current, INSTANCE_CONFIG)
    if (fs.existsSync(file)) return { root: current, file, config: parseInstanceConfig(fs.readFileSync(file, 'utf8'), file) }
    const parent = path.dirname(current)
    if (parent === current) return null
    current = parent
  }
}

function absolute(value, label, code) {
  if (!value || !path.isAbsolute(value)) fail(`${label} must be an absolute path`, code)
  return path.resolve(value)
}

function registryFile(profileRoot) { return path.join(profileRoot, 'integration-v1.json') }
function projectFile(profileRoot, realRoot) { return path.join(profileRoot, 'projects', `${sha256(realRoot.toLowerCase())}.json`) }
function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.tmp-${process.pid}-${crypto.randomUUID()}`
  try {
    fs.writeFileSync(temporary, content, { flag: 'wx' })
    fs.renameSync(temporary, file)
  } finally {
    try { fs.unlinkSync(temporary) } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
}
function readRegistry(profileRoot) {
  const file = registryFile(profileRoot)
  if (!fs.existsSync(file)) fail('Integration profile is not linked', 'INTEGRATION_CONFLICT')
  let value
  try { value = JSON.parse(fs.readFileSync(file, 'utf8')) } catch (error) { fail('Integration registry is invalid', 'INTEGRATION_CONFLICT', { cause: error.code || error.message }) }
  if (value?.schemaVersion !== 1 || !value.installationId || path.resolve(value.profileRoot || '') !== profileRoot || !Array.isArray(value.managedLinks)) fail('Integration registry is incompatible', 'INTEGRATION_CONFLICT')
  return { file, value }
}
function validateDataRoot(dataRoot) {
  const root = absolute(dataRoot, 'dataRoot', 'INVALID_DATA_ROOT')
  if (!fs.existsSync(root)) fail('Data root does not exist', 'INVALID_DATA_ROOT')
  const real = fs.realpathSync.native(root)
  if (!fs.existsSync(path.join(real, 'Master')) || !fs.existsSync(path.join(real, 'Candidatures', 'records', 'manifest.json'))) fail('Data root must contain Master/ and Candidatures/records/manifest.json', 'INVALID_DATA_ROOT')
  return { root, real }
}
function ownedRecord(profileRoot, realRoot) {
  const file = projectFile(profileRoot, realRoot)
  if (!fs.existsSync(file)) return { file, record: null }
  try { return { file, record: JSON.parse(fs.readFileSync(file, 'utf8')) } } catch { fail('Project ownership record is invalid', 'INTEGRATION_CONFLICT', { file }) }
}
function acquireProjectLocks(profileRoot, dataRoot) {
  const files = [path.join(profileRoot, 'project.lock'), path.join(dataRoot, '.nextstep-project.lock')], handles = []
  try {
    for (const file of files) handles.push({ file, handle: fs.openSync(file, 'wx') })
    return handles
  } catch (error) {
    for (const item of handles.reverse()) { fs.closeSync(item.handle); fs.unlinkSync(item.file) }
    if (error.code === 'EEXIST') fail('Another project binding operation owns a lock', 'INTEGRATION_BUSY')
    throw error
  }
}
function releaseProjectLocks(locks) {
  for (const item of locks.reverse()) { try { fs.closeSync(item.handle) } finally { fs.unlinkSync(item.file) } }
}

export function projectPlan({ dataRoot, instanceId, profileRoot } = {}) {
  if (!INSTANCE_ID.test(instanceId || '')) fail('instanceId is invalid', 'INVALID_INSTANCE_CONFIG')
  const profile = absolute(profileRoot, 'profileRoot', 'INVALID_PROFILE_ROOT')
  const data = validateDataRoot(dataRoot)
  const registry = readRegistry(profile).value
  const marker = path.join(data.real, INSTANCE_CONFIG)
  const expected = markerText(instanceId)
  let state = 'not_linked'
  if (fs.existsSync(marker)) {
    const actual = fs.readFileSync(marker, 'utf8')
    state = actual === expected ? 'marker_present' : 'conflict'
  }
  const ownership = ownedRecord(profile, data.real)
  if (ownership.record?.unlinking) fail('Project unlink recovery must complete before linking', 'INTEGRATION_RECOVERY_REQUIRED', { marker })
  if (state === 'marker_present') state = ownership.record ? 'linked' : 'unmanaged'
  if (state === 'conflict' || (ownership.record && (ownership.record.installationId !== registry.installationId || ownership.record.marker !== marker || ownership.record.instanceId !== instanceId || ownership.record.sha256 !== sha256(expected)))) fail('Project marker conflicts with managed state', 'INTEGRATION_CONFLICT', { marker })
  return { schemaVersion: 1, status: 'ok', operation: 'plan', state, dataRoot: data.real, instanceId, marker, operations: state === 'linked' ? [] : state === 'unmanaged' ? [{ action: 'register-ownership', destination: marker }] : [{ action: 'create-file', destination: marker }] }
}

export function projectLink(options = {}) {
  const profile = absolute(options.profileRoot, 'profileRoot', 'INVALID_PROFILE_ROOT')
  const data = validateDataRoot(options.dataRoot), locks = acquireProjectLocks(profile, data.real)
  try {
    const plan = projectPlan(options)
    if (plan.state === 'linked') return { ...plan, operation: 'link', changed: false }
    const { value: registry } = readRegistry(profile)
    const content = markerText(options.instanceId)
    let createdMarker = false
    try {
      if (plan.state === 'not_linked') { atomicWrite(plan.marker, content); createdMarker = true }
      const record = { schemaVersion: 1, installationId: registry.installationId, dataRoot: plan.dataRoot, marker: plan.marker, instanceId: options.instanceId, sha256: sha256(content), createdAt: new Date().toISOString() }
      atomicWrite(projectFile(profile, plan.dataRoot), `${JSON.stringify(record, null, 2)}\n`)
      return { ...plan, operation: 'link', state: 'linked', changed: true }
    } catch (error) {
      if (createdMarker && fs.existsSync(plan.marker) && sha256(fs.readFileSync(plan.marker)) === sha256(content)) fs.unlinkSync(plan.marker)
      throw error
    }
  } finally { releaseProjectLocks(locks) }
}

export function projectStatus({ dataRoot, profileRoot, cwd = process.cwd() } = {}) {
  const profile = absolute(profileRoot, 'profileRoot', 'INVALID_PROFILE_ROOT')
  const selected = dataRoot ? validateDataRoot(dataRoot).real : findNearestInstanceConfig(cwd)?.root
  if (!selected) return { schemaVersion: 1, status: 'ok', operation: 'status', state: 'not_linked' }
  const real = fs.realpathSync.native(selected)
  const marker = path.join(real, INSTANCE_CONFIG)
  const { record } = ownedRecord(profile, real)
  if (record?.unlinking) return { schemaVersion: 1, status: 'degraded', operation: 'status', state: 'recovery_required', phase: fs.existsSync(marker) ? 'unlink_prepared' : 'marker_removed', action: 'Run project unlink again with the same data and profile roots.', dataRoot: real }
  if (!fs.existsSync(marker)) return { schemaVersion: 1, status: 'ok', operation: 'status', state: 'not_linked', dataRoot: real }
  const config = parseInstanceConfig(fs.readFileSync(marker, 'utf8'), marker)
  const actualHash = sha256(fs.readFileSync(marker))
  const state = record && record.marker === marker && record.instanceId === config.instanceId && record.sha256 === actualHash ? 'linked' : record ? 'drifted' : 'unmanaged'
  return { schemaVersion: 1, status: state === 'linked' ? 'ok' : 'degraded', operation: 'status', state, dataRoot: real, instanceId: config.instanceId, marker }
}

export function projectRecoveryStatus({ dataRoot, profileRoot } = {}) {
  if (!dataRoot || !profileRoot || !path.isAbsolute(dataRoot) || !path.isAbsolute(profileRoot) || !fs.existsSync(dataRoot)) return { status: 'clear' }
  const real = fs.realpathSync.native(path.resolve(dataRoot)), marker = path.join(real, INSTANCE_CONFIG)
  const { record } = ownedRecord(path.resolve(profileRoot), real)
  return record?.unlinking ? { status: 'pending', operation: 'project-unlink', phase: fs.existsSync(marker) ? 'unlink_prepared' : 'marker_removed', action: 'Run project unlink again with the same data and profile roots.' } : { status: 'clear' }
}

export function projectUnlink({ dataRoot, profileRoot, failAfter } = {}) {
  const profile = absolute(profileRoot, 'profileRoot', 'INVALID_PROFILE_ROOT')
  const data = validateDataRoot(dataRoot)
  const locks = acquireProjectLocks(profile, data.real)
  try {
    const { file, record } = ownedRecord(profile, data.real)
    if (!record) return { schemaVersion: 1, status: 'ok', operation: 'unlink', state: 'not_linked', changed: false }
    const marker = path.join(data.real, INSTANCE_CONFIG)
    if (record.unlinking && !fs.existsSync(marker)) {
      fs.unlinkSync(file)
      return { schemaVersion: 1, status: 'ok', operation: 'unlink', state: 'not_linked', changed: true, recovered: true }
    }
    let content
    try { content = fs.readFileSync(marker) } catch (error) { if (error.code === 'ENOENT') fail('Managed project marker is missing', 'INTEGRATION_BROKEN'); throw error }
    const parsed = parseInstanceConfig(content.toString('utf8'), marker)
    if (record.marker !== marker || record.instanceId !== parsed.instanceId || record.sha256 !== sha256(content)) fail('Refusing to remove a changed project marker', 'INTEGRATION_DRIFT', { marker })
    atomicWrite(file, `${JSON.stringify({ ...record, unlinking: true, unlinkStartedAt: record.unlinkStartedAt || new Date().toISOString() }, null, 2)}\n`)
    fs.unlinkSync(marker)
    if (failAfter === 'marker_removed') throw Object.assign(new Error('Injected failure after marker removal'), { code: 'INJECTED_FAILURE' })
    fs.unlinkSync(file)
    return { schemaVersion: 1, status: 'ok', operation: 'unlink', state: 'not_linked', changed: true }
  } finally { releaseProjectLocks(locks) }
}

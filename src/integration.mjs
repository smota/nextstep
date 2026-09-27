import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { projectRecoveryStatus } from './instance-config.mjs'

const REGISTRY = 'integration-v1.json'
const LOCK = 'integration.lock'
const JOURNAL = path.join('transactions', 'active.json')
const HOST_JOURNAL = path.join('transactions', 'host-active.json')
const LINK_ID = 'tool:nextstep'
const SKILL_LINK_ID = 'skill-root:workspace'
const CODEX_REFERENCES_ID = 'support:codex:references'

function fail(message, code, details) {
  throw Object.assign(new Error(message), { code, details })
}

function absolute(value, name) {
  const code = name === 'productRoot' ? 'INVALID_PRODUCT_ROOT' : name === 'workspaceRoot' ? 'INVALID_WORKSPACE_ROOT' : 'INVALID_PROFILE_ROOT'
  if (!value || !path.isAbsolute(value)) fail(`${name} must be an absolute path`, code)
  return path.resolve(value)
}

function existingAncestor(candidate) {
  let current = path.resolve(candidate)
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current)
    if (parent === current) return null
    current = parent
  }
  return current
}

function projectedReal(candidate) {
  const ancestor = existingAncestor(candidate)
  if (!ancestor) return path.resolve(candidate)
  return path.resolve(fs.realpathSync.native(ancestor), path.relative(ancestor, path.resolve(candidate)))
}

function overlaps(a, b) {
  const relative = path.relative(a, b)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.tmp-${process.pid}-${crypto.randomUUID()}`
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' })
  fs.renameSync(temporary, file)
}

function atomicBytes(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.tmp-${process.pid}-${crypto.randomUUID()}`
  try { fs.writeFileSync(temporary, value, { flag: 'wx' }); fs.renameSync(temporary, file) } finally { try { fs.unlinkSync(temporary) } catch (error) { if (error.code !== 'ENOENT') throw error } }
}

function readJson(file, code = 'INTEGRATION_CONFLICT') {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (error) { fail(`Invalid integration metadata: ${file}`, code, { cause: error.code || error.message }) }
}

function registryPath(profileRoot) { return path.join(profileRoot, REGISTRY) }
function journalPath(profileRoot) { return path.join(profileRoot, JOURNAL) }
function hostJournalPath(profileRoot) { return path.join(profileRoot, HOST_JOURNAL) }
function linkPath(profileRoot) { return path.join(profileRoot, 'bin') }

function validateRegistry(value, profileRoot) {
  if (!value || value.schemaVersion !== 1 || !value.installationId || path.resolve(value.profileRoot || '') !== profileRoot || !Array.isArray(value.managedLinks)) fail('Integration registry is incompatible', 'INTEGRATION_CONFLICT')
  const managed = value.managedLinks.find(item => item.id === LINK_ID)
  if (managed && (managed.ownerInstallationId !== value.installationId || path.resolve(managed.destination || '') !== linkPath(profileRoot) || managed.linkType !== 'junction')) fail('Managed-link ownership or destination does not match the installation', 'INTEGRATION_CONFLICT')
  const skill = value.managedLinks.find(item => item.id === SKILL_LINK_ID)
  if (skill && (skill.ownerInstallationId !== value.installationId || !value.workspaceRoot || path.resolve(skill.destination || '') !== path.join(path.resolve(value.workspaceRoot), '.agents', 'skills') || skill.linkType !== 'junction')) fail('Managed skill-link ownership or destination does not match the installation', 'INTEGRATION_CONFLICT')
  for (const item of value.managedLinks.filter(candidate => String(candidate.id).startsWith('skill:codex:'))) {
    const name = item.id.slice('skill:codex:'.length)
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name) || item.ownerInstallationId !== value.installationId || !value.workspaceRoot || path.resolve(item.destination || '') !== path.join(path.resolve(value.workspaceRoot), '.codex', 'skills', name) || item.linkType !== 'junction' || item.host !== 'codex') fail('Managed Codex skill ownership or destination does not match the installation', 'INTEGRATION_CONFLICT')
  }
  const references = value.managedLinks.find(item => item.id === CODEX_REFERENCES_ID)
  if (references && (references.ownerInstallationId !== value.installationId || !value.workspaceRoot || path.resolve(references.destination || '') !== path.join(path.resolve(value.workspaceRoot), '.codex', 'skills', 'references') || references.linkType !== 'junction' || references.host !== 'codex' || references.kind !== 'skill-support')) fail('Managed Codex reference ownership or destination does not match the installation', 'INTEGRATION_CONFLICT')
  return value
}

function knownCloudRoots(env = process.env) {
  return ['OneDrive', 'OneDriveCommercial', 'OneDriveConsumer'].map(name => env[name]).filter(Boolean).map(item => projectedReal(item))
}

function volumeOf(value) { return path.parse(path.resolve(value)).root }

function validateRuntime(runtimeVersion) {
  if (process.platform !== 'win32') fail('Linked installation currently supports Windows only', 'INTEGRATION_UNSUPPORTED', { platform: process.platform })
  const runtimeMajor = Number.parseInt(String(runtimeVersion).split('.')[0], 10)
  if (!Number.isInteger(runtimeMajor) || runtimeMajor < 20) fail('Linked installation requires Node.js 20 or newer', 'INTEGRATION_UNSUPPORTED', { runtimeVersion })
  return runtimeMajor
}

function validateProduct(productRoot) {
  const root = absolute(productRoot, 'productRoot')
  if (!fs.existsSync(root)) fail('Product root does not exist', 'INVALID_PRODUCT_ROOT')
  const real = fs.realpathSync.native(root)
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(real, 'package.json'), 'utf8'))
    if (manifest.name !== 'nextstep') throw new Error('package name is not nextstep')
    for (const relative of ['bin/nextstep.mjs', 'launchers/windows/nextstep.cmd', 'launchers/windows/nextstep-launcher.mjs']) {
      if (!fs.statSync(path.join(real, relative)).isFile()) throw new Error(`missing ${relative}`)
    }
  } catch (error) { fail('Product root is not a valid Nextstep tree', 'INVALID_PRODUCT_ROOT', { cause: error.code || error.message }) }
  return { root, real, launcherTarget: path.join(real, 'launchers', 'windows') }
}

function validateProfile(profileRoot, productReal, env) {
  const root = absolute(profileRoot, 'profileRoot')
  const parsed = path.parse(root)
  let cursor = parsed.root
  for (const segment of root.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment)
    if (!fs.existsSync(cursor)) break
    if (fs.lstatSync(cursor).isSymbolicLink()) fail('Profile root must not traverse a link or junction', 'INVALID_PROFILE_ROOT', { component: cursor })
  }
  const projected = projectedReal(root)
  if (overlaps(productReal, projected) || overlaps(projected, productReal)) fail('Profile root and product root must not overlap', 'INVALID_PROFILE_ROOT')
  const ancestor = existingAncestor(root)
  if (!ancestor) fail('Profile root has no existing ancestor', 'INVALID_PROFILE_ROOT')
  const ancestorReal = fs.realpathSync.native(ancestor)
  const expected = path.resolve(ancestorReal, path.relative(ancestor, root))
  if (expected !== projected) fail('Profile root escapes through a link or junction', 'INVALID_PROFILE_ROOT')
  const cloud = knownCloudRoots(env).find(cloudRoot => overlaps(cloudRoot, projected))
  return { root, projected, cloud }
}

function inspectLink(profileRoot, registry) {
  const destination = linkPath(profileRoot)
  const managed = registry?.managedLinks.find(item => item.id === LINK_ID)
  if (!fs.existsSync(destination)) {
    try {
      const stat = fs.lstatSync(destination)
      if (!stat.isSymbolicLink()) return { state: 'conflict', destination, reason: 'destination is an unknown object' }
    } catch (error) {
      if (error.code === 'ENOENT') return { state: managed ? 'broken' : 'not_linked', destination, reason: managed ? 'managed link is missing' : undefined }
      throw error
    }
  }
  const stat = fs.lstatSync(destination)
  if (!stat.isSymbolicLink()) return { state: 'conflict', destination, reason: 'destination is not a junction' }
  const rawTarget = fs.readlinkSync(destination)
  if (!managed) return { state: 'conflict', destination, rawTarget, reason: 'junction is not registered' }
  if (rawTarget !== managed.rawLinkTarget) return { state: 'drifted', destination, rawTarget, expectedRawTarget: managed.rawLinkTarget }
  if (!fs.existsSync(destination)) return { state: 'broken', destination, rawTarget }
  const targetReal = fs.realpathSync.native(destination)
  return targetReal === managed.sourceRealAtLink
    ? { state: 'linked', destination, rawTarget, targetReal }
    : { state: 'drifted', destination, rawTarget, targetReal, expectedTargetReal: managed.sourceRealAtLink }
}

function resultBase(operation, profileRoot) {
  return { schemaVersion: 1, status: 'ok', operation, profileRoot, binDestination: linkPath(profileRoot) }
}

function baseIntegrationPlan({ productRoot, profileRoot, env = process.env, runtimeVersion = process.versions.node } = {}) {
  validateRuntime(runtimeVersion)
  const product = validateProduct(productRoot)
  const profile = validateProfile(profileRoot, product.real, env)
  const registryFile = registryPath(profile.root)
  const registry = fs.existsSync(registryFile) ? validateRegistry(readJson(registryFile), profile.root) : null
  const link = inspectLink(profile.root, registry)
  const repairable = link.state === 'broken' && link.reason === 'managed link is missing'
  if (['conflict', 'drifted', 'broken'].includes(link.state) && !repairable) fail(`Integration cannot be linked from state: ${link.state}`, link.state === 'drifted' ? 'INTEGRATION_DRIFT' : link.state === 'broken' ? 'INTEGRATION_BROKEN' : 'INTEGRATION_CONFLICT', link)
  if (registry && (registry.productRootReal !== product.real || registry.productRoot !== product.root)) fail('Profile is registered to another product root', 'INTEGRATION_CONFLICT')
  return {
    ...resultBase('plan', profile.root),
    state: link.state,
    checks: {
      platform: { status: 'passed', value: process.platform },
      runtime: { status: 'passed', value: runtimeVersion, minimumMajor: 20 },
      productRoot: { status: 'passed', value: product.root, real: product.real },
      sourceVolume: { status: 'passed', value: volumeOf(product.real) },
      profileVolume: { status: 'passed', value: volumeOf(profile.projected) },
      cloudSyncProfile: profile.cloud ? { status: 'warning', root: profile.cloud, message: 'Junctions are local and must be recreated on another machine.' } : { status: 'passed' }
    },
    operations: link.state === 'linked' ? [] : [{ action: 'create-junction', destination: linkPath(profile.root), source: product.launcherTarget }]
  }
}

function acquireLock(profileRoot) {
  fs.mkdirSync(profileRoot, { recursive: true })
  const file = path.join(profileRoot, LOCK)
  try { return { file, handle: fs.openSync(file, 'wx') } } catch (error) {
    if (error.code === 'EEXIST') fail('Another integration operation owns the profile lock', 'INTEGRATION_BUSY')
    throw error
  }
}

function releaseLock(lock) {
  try { fs.closeSync(lock.handle) } finally { try { fs.unlinkSync(lock.file) } catch (error) { if (error.code !== 'ENOENT') throw error } }
}

function removeOwnedJunction(file, rawTarget) {
  let stat
  try { stat = fs.lstatSync(file) } catch (error) { if (error.code === 'ENOENT') return; throw error }
  if (!stat.isSymbolicLink() || fs.readlinkSync(file) !== rawTarget) fail('Refusing to remove a changed integration link', 'INTEGRATION_CONFLICT', { file })
  fs.unlinkSync(file)
}

function reconcile(profileRoot) {
  const file = journalPath(profileRoot)
  if (!fs.existsSync(file)) return
  const journal = readJson(file, 'INTEGRATION_RECOVERY_REQUIRED')
  if (journal.schemaVersion !== 1 || !journal.installationId || !journal.phase || !journal.temporaryLink || !journal.source || !journal.preconditions) fail('Integration journal requires manual recovery', 'INTEGRATION_RECOVERY_REQUIRED')
  if (journal.phase === 'done') { fs.unlinkSync(file); return }
  if (journal.phase === 'prepared') {
    try {
      const stat = fs.lstatSync(journal.temporaryLink)
      if (!stat.isSymbolicLink() || !fs.existsSync(journal.temporaryLink) || fs.realpathSync.native(journal.temporaryLink) !== fs.realpathSync.native(journal.source)) fail('Prepared transaction has an unknown temporary object', 'INTEGRATION_RECOVERY_REQUIRED')
      fs.unlinkSync(journal.temporaryLink)
    } catch (error) { if (error.code !== 'ENOENT') throw error }
    fs.unlinkSync(file); return
  }
  if (journal.phase === 'temporary_link_created') {
    removeOwnedJunction(journal.temporaryLink, journal.rawTarget)
    fs.unlinkSync(file)
    return
  }
  if (journal.phase === 'registry_published') {
    if (!fs.existsSync(registryPath(profileRoot))) fail('Published registry is missing during recovery', 'INTEGRATION_RECOVERY_REQUIRED')
    journal.phase = 'done'; atomicJson(file, journal); fs.unlinkSync(file); return
  }
  fail('Integration requires recovery before continuing', 'INTEGRATION_RECOVERY_REQUIRED', { phase: journal.phase })
}

function baseIntegrationLink({ productRoot, profileRoot, env = process.env, runtimeVersion = process.versions.node, failAfter } = {}) {
  validateRuntime(runtimeVersion)
  const product = validateProduct(productRoot)
  const profile = validateProfile(profileRoot, product.real, env)
  if (!fs.existsSync(journalPath(profile.root))) baseIntegrationPlan({ productRoot, profileRoot, env, runtimeVersion })
  const lock = acquireLock(profile.root)
  try {
    reconcile(profile.root)
    const plan = baseIntegrationPlan({ productRoot: product.root, profileRoot: profile.root, env, runtimeVersion })
    if (plan.state === 'linked') return { ...plan, operation: 'link', changed: false }
    const existingRegistry = fs.existsSync(registryPath(profile.root)) ? validateRegistry(readJson(registryPath(profile.root)), profile.root) : null
    const installationId = existingRegistry?.installationId || crypto.randomUUID()
    const destination = linkPath(profile.root)
    const temporaryLink = `${destination}.nextstep-${installationId}`
    const journal = {
      schemaVersion: 1,
      installationId,
      phase: 'prepared',
      temporaryLink,
      destination,
      source: product.launcherTarget,
      rawTarget: null,
      preconditions: {
        planState: plan.state,
        destinationPresent: fs.existsSync(destination),
        registryPresent: fs.existsSync(registryPath(profile.root)),
        productRootReal: product.real,
        sourceReal: fs.realpathSync.native(product.launcherTarget)
      }
    }
    atomicJson(journalPath(profile.root), journal)
    if (failAfter === 'journal') throw Object.assign(new Error('Injected failure after journal'), { code: 'INJECTED_FAILURE' })
    try { fs.symlinkSync(product.launcherTarget, temporaryLink, 'junction') } catch (error) { fail('Windows could not create the launcher junction', 'INTEGRATION_UNSUPPORTED', { cause: error.code || error.message }) }
    journal.rawTarget = fs.readlinkSync(temporaryLink)
    journal.phase = 'temporary_link_created'; atomicJson(journalPath(profile.root), journal)
    if (failAfter === 'temporary_link') throw Object.assign(new Error('Injected failure after temporary link'), { code: 'INJECTED_FAILURE' })
    if (fs.existsSync(destination)) fail('Integration destination changed after planning', 'INTEGRATION_CONFLICT')
    fs.renameSync(temporaryLink, destination)
    journal.phase = 'link_published'; atomicJson(journalPath(profile.root), journal)
    if (failAfter === 'link_published') throw Object.assign(new Error('Injected failure after publishing link'), { code: 'INJECTED_FAILURE' })
    const now = new Date().toISOString()
    const registry = {
      ...(existingRegistry || {}),
      schemaVersion: 1, installationId, productRoot: product.root, productRootReal: product.real, profileRoot: profile.root, createdAt: existingRegistry?.createdAt || now, updatedAt: now,
      managedLinks: [...(existingRegistry?.managedLinks || []).filter(item => item.id !== LINK_ID), { id: LINK_ID, kind: 'tool', destination, source: product.launcherTarget, sourceRealAtLink: fs.realpathSync.native(destination), rawLinkTarget: fs.readlinkSync(destination), linkType: 'junction', ownerInstallationId: installationId }]
    }
    atomicJson(registryPath(profile.root), registry)
    journal.phase = 'registry_published'; atomicJson(journalPath(profile.root), journal)
    if (failAfter === 'registry') throw Object.assign(new Error('Injected failure after registry'), { code: 'INJECTED_FAILURE' })
    journal.phase = 'done'; atomicJson(journalPath(profile.root), journal)
    fs.unlinkSync(journalPath(profile.root))
    return { ...resultBase('link', profile.root), state: 'linked', changed: true, installationId, managedLinks: registry.managedLinks }
  } finally { releaseLock(lock) }
}

function baseIntegrationStatus({ profileRoot } = {}) {
  const profile = absolute(profileRoot, 'profileRoot')
  const registryFile = registryPath(profile)
  const registry = fs.existsSync(registryFile) ? validateRegistry(readJson(registryFile), profile) : null
  const link = inspectLink(profile, registry)
  const pendingRecovery = fs.existsSync(journalPath(profile))
  return { ...resultBase('status', profile), status: ['linked', 'not_linked'].includes(link.state) && !pendingRecovery ? 'ok' : 'degraded', state: pendingRecovery ? 'recovery_required' : link.state, link, registry: registry ? { schemaVersion: registry.schemaVersion, installationId: registry.installationId, productRoot: registry.productRoot, managedLinks: registry.managedLinks } : null }
}

function baseIntegrationUnlink({ profileRoot } = {}) {
  const profile = absolute(profileRoot, 'profileRoot')
  const lock = acquireLock(profile)
  try {
    reconcile(profile)
    const registryFile = registryPath(profile)
    if (!fs.existsSync(registryFile)) return { ...resultBase('unlink', profile), state: 'not_linked', changed: false }
    const registry = validateRegistry(readJson(registryFile), profile)
    const managed = registry.managedLinks.find(item => item.id === LINK_ID)
    if (!managed) return { ...resultBase('unlink', profile), state: 'not_linked', changed: false }
    const link = inspectLink(profile, registry)
    if (!['linked', 'broken'].includes(link.state)) fail('Refusing to unlink a drifted or conflicting destination', link.state === 'drifted' ? 'INTEGRATION_DRIFT' : 'INTEGRATION_CONFLICT', link)
    removeOwnedJunction(managed.destination, managed.rawLinkTarget)
    registry.managedLinks = registry.managedLinks.filter(item => item.id !== LINK_ID)
    const known = new Set(['schemaVersion', 'installationId', 'productRoot', 'productRootReal', 'profileRoot', 'createdAt', 'updatedAt', 'managedLinks', 'workspaceRoot', 'userPath'])
    const preserveRegistry = registry.managedLinks.length || Object.keys(registry).some(key => !known.has(key))
    if (preserveRegistry) { registry.updatedAt = new Date().toISOString(); atomicJson(registryFile, registry) } else fs.unlinkSync(registryFile)
    return { ...resultBase('unlink', profile), state: 'not_linked', changed: true }
  } finally { releaseLock(lock) }
}

function validateWorkspace(workspaceRoot, productReal, env) {
  const root = absolute(workspaceRoot, 'workspaceRoot')
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory() || !fs.existsSync(path.join(root, 'AGENTS.md'))) fail('Workspace root must exist and contain AGENTS.md', 'INVALID_WORKSPACE_ROOT')
  const parsed = path.parse(root)
  let cursor = parsed.root
  for (const segment of root.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment)
    if (fs.lstatSync(cursor).isSymbolicLink()) fail('Workspace root must not traverse a link or junction', 'INVALID_WORKSPACE_ROOT', { component: cursor })
  }
  const real = fs.realpathSync.native(root)
  if (overlaps(productReal, real) || overlaps(real, productReal)) fail('Workspace root and product root must not overlap', 'INVALID_WORKSPACE_ROOT')
  const cloud = knownCloudRoots(env).find(cloudRoot => overlaps(cloudRoot, real))
  const agentsRoot = path.join(root, '.agents'), destination = path.join(agentsRoot, 'skills'), ancestor = existingAncestor(agentsRoot)
  if (!ancestor || (fs.existsSync(agentsRoot) && fs.lstatSync(agentsRoot).isSymbolicLink())) fail('Skill destination must not traverse a link or junction', 'INVALID_WORKSPACE_ROOT')
  const projected = projectedReal(agentsRoot)
  if (overlaps(real, projected) === false) fail('Skill destination escapes the workspace', 'INVALID_WORKSPACE_ROOT')
  for (const parent of [path.join(root, '.codex'), path.join(root, '.codex', 'skills')]) {
    if (fs.existsSync(parent) && fs.lstatSync(parent).isSymbolicLink()) fail('Codex skill destination parent must not be a link or junction', 'INVALID_WORKSPACE_ROOT', { component: parent })
  }
  return { root, real, cloud, destination, source: path.join(productReal, 'skills') }
}

function inspectManagedJunction(destination, managed) {
  let stat
  try { stat = fs.lstatSync(destination) } catch (error) {
    if (error.code === 'ENOENT') return { state: managed ? 'broken' : 'not_linked', destination }
    throw error
  }
  if (!stat.isSymbolicLink()) return { state: 'conflict', destination, reason: 'destination is not a junction' }
  const rawTarget = fs.readlinkSync(destination)
  if (!managed) return { state: 'conflict', destination, rawTarget, reason: 'junction is not registered' }
  if (rawTarget !== managed.rawLinkTarget) return { state: 'drifted', destination, rawTarget, expectedRawTarget: managed.rawLinkTarget }
  if (!fs.existsSync(destination)) return { state: 'broken', destination, rawTarget }
  const targetReal = fs.realpathSync.native(destination)
  return targetReal === managed.sourceRealAtLink ? { state: 'linked', destination, rawTarget, targetReal } : { state: 'drifted', destination, rawTarget, targetReal, expectedTargetReal: managed.sourceRealAtLink }
}

function parseSkillManifest(file) {
  const text = fs.readFileSync(file, 'utf8')
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) return { valid: false, file, reason: 'frontmatter must start at byte zero' }
  const lines = text.split(/\r?\n/)
  const end = lines.indexOf('---', 1)
  if (end < 0) return { valid: false, file, reason: 'frontmatter is not closed' }
  const values = {}
  for (const line of lines.slice(1, end)) {
    const match = /^(name|description):\s+([^\r\n]+)$/.exec(line)
    if (!match || Object.hasOwn(values, match[1])) return { valid: false, file, reason: 'frontmatter must contain unique scalar name and description only' }
    values[match[1]] = match[2].trim()
  }
  if (!values.name || !values.description || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(values.name) || /["'&*!|>\[\]{}]/.test(values.description)) return { valid: false, file, reason: 'frontmatter requires an unquoted canonical name and plain description' }
  return { valid: true, file, name: values.name, description: values.description }
}

export function skillInventory(skillsRoot, { includeDir = () => true } = {}) {
  if (!fs.existsSync(skillsRoot)) return { skills: [], invalid: [], duplicates: [] }
  const manifests = fs.readdirSync(skillsRoot, { withFileTypes: true }).filter(item => {
    if (!includeDir(item.name)) return false
    if (item.isDirectory()) return true
    const candidate = path.join(skillsRoot, item.name)
    return item.isSymbolicLink() && fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()
  }).map(item => path.join(skillsRoot, item.name, 'SKILL.md')).filter(file => fs.existsSync(file)).map(parseSkillManifest)
  const valid = manifests.filter(item => item.valid), invalid = manifests.filter(item => !item.valid)
  const grouped = new Map()
  for (const item of valid) grouped.set(item.name, [...(grouped.get(item.name) || []), item])
  const duplicates = [...grouped].filter(([, items]) => items.length > 1).map(([name, items]) => ({ name, files: items.map(item => item.file) }))
  return { skills: valid.map(({ name, description, file }) => ({ name, description, file })), invalid, duplicates }
}

function defaultPathAdapter() {
  return {
    read() {
      const result = spawnSync('reg.exe', ['query', 'HKCU\\Environment', '/v', 'Path'], { encoding: 'utf8', windowsHide: true, shell: false })
      if (result.status !== 0) return { exists: false, type: null, value: '' }
      const line = String(result.stdout).split(/\r?\n/).find(item => /\sREG_(?:SZ|EXPAND_SZ)\s/.test(item))
      if (!line) fail('User PATH registry value has an unsupported shape', 'INTEGRATION_CONFLICT')
      const match = /^\s*Path\s+(REG_(?:SZ|EXPAND_SZ))\s+(.*)$/.exec(line)
      if (!match) fail('User PATH registry value has an unsupported shape', 'INTEGRATION_CONFLICT')
      return { exists: true, type: match[1], value: match[2] }
    },
    write(state) {
      const args = state.exists ? ['add', 'HKCU\\Environment', '/v', 'Path', '/t', state.type, '/d', state.value, '/f'] : ['delete', 'HKCU\\Environment', '/v', 'Path', '/f']
      const result = spawnSync('reg.exe', args, { encoding: 'utf8', windowsHide: true, shell: false })
      if (result.status !== 0) fail('Could not update the user PATH', 'INTEGRATION_CONFLICT', { stderr: String(result.stderr).trim() })
    }
  }
}

function pathSegments(value) { return String(value || '').split(';').map(item => item.trim()).filter(Boolean) }
function sameSegment(a, b) { return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() }
function pathPlan(profileRoot, adapter) {
  const original = adapter.read()
  if (original.exists && !['REG_SZ', 'REG_EXPAND_SZ'].includes(original.type)) fail('User PATH registry type is unsupported', 'INTEGRATION_CONFLICT', { type: original.type })
  const segment = linkPath(profileRoot)
  const present = pathSegments(original.value).some(item => sameSegment(item, segment))
  const next = present ? original : { exists: true, type: original.exists ? original.type : 'REG_EXPAND_SZ', value: [...pathSegments(original.value), segment].join(';') }
  return { segment, present, original, next, newProcessRequired: !present }
}

function readOptionalRegistry(profileRoot) {
  const file = registryPath(profileRoot)
  return fs.existsSync(file) ? validateRegistry(readJson(file), profileRoot) : null
}

function isWorkspaceSkillLink(item) {
  return item.id === SKILL_LINK_ID || item.id === CODEX_REFERENCES_ID || String(item.id).startsWith('skill:codex:')
}

// Migration only: ordinary installation never publishes workspace skills again.
function validateMigrationLinks(registry) {
  validateWorkspace(registry.workspaceRoot, registry.productRootReal, {})
  for (const item of registry.managedLinks.filter(isWorkspaceSkillLink)) {
    const relative = item.id === SKILL_LINK_ID ? 'skills' : item.id === CODEX_REFERENCES_ID ? 'skills/references' : `skills/${item.id.slice('skill:codex:'.length)}`
    const expected = path.resolve(registry.productRootReal, relative)
    if (path.resolve(item.source) !== expected || path.resolve(item.sourceRealAtLink) !== expected || path.resolve(item.rawLinkTarget) !== expected) fail('Skill source differs from the registered product', 'INTEGRATION_CONFLICT')
  }
}

function detachWorkspaceSkills({ profileRoot, workspaceRoot, dryRun, failAfter }) {
  const profile = absolute(profileRoot, 'profileRoot')
  const pending = fs.existsSync(hostJournalPath(profile)) ? readJson(hostJournalPath(profile)) : null
  if (pending && pending.operation !== 'detach-skills') fail('Another integration needs recovery first', 'INTEGRATION_RECOVERY_REQUIRED')
  const registry = readOptionalRegistry(profile)
  if (!registry) fail('No registered installation to migrate', 'INTEGRATION_CONFLICT')
  const original = pending ? validateRegistry(pending.original, profile) : registry
  if (pending && original.installationId !== registry.installationId) fail('Installation changed during migration', 'INTEGRATION_CONFLICT')
  const links = original.managedLinks.filter(isWorkspaceSkillLink)
  if (workspaceRoot && original.workspaceRoot && path.resolve(workspaceRoot) !== path.resolve(original.workspaceRoot)) fail('Workspace differs from the registered installation', 'INTEGRATION_CONFLICT')
  if (links.length) validateMigrationLinks(original)
  for (const item of links) {
    const observed = inspectManagedJunction(item.destination, item)
    if (!['linked', 'broken'].includes(observed.state)) fail('Migration destination changed; preserving all remaining links', 'INTEGRATION_CONFLICT', observed)
  }
  const result = { ...resultBase('detach-skills', profile), changed: Boolean(links.length), state: 'externally_managed', operations: links.map(item => ({ action: 'remove-junction', destination: item.destination, source: item.source })) }
  if (dryRun || !links.length) return { ...result, dryRun: Boolean(dryRun) }
  const lock = acquireLock(profile)
  try {
    if (JSON.stringify(readOptionalRegistry(profile)) !== JSON.stringify(registry)) fail('Registry changed after preview', 'INTEGRATION_CONFLICT')
    const receipt = path.join(profile, 'skills-migration-v1.json')
    if (!pending) {
      if (fs.existsSync(receipt)) fail('A previous skills migration receipt already exists', 'INTEGRATION_CONFLICT')
      atomicJson(hostJournalPath(profile), { schemaVersion: 1, operation: 'detach-skills', phase: 'removing', installationId: registry.installationId, original })
    }
    for (const item of [...links].reverse()) {
      removeOwnedJunction(item.destination, item.rawLinkTarget)
      if (failAfter === item.id) throw Object.assign(new Error('Injected migration interruption'), { code: 'INJECTED_FAILURE' })
    }
    atomicJson(receipt, { schemaVersion: 1, original })
    registry.managedLinks = registry.managedLinks.filter(item => !isWorkspaceSkillLink(item))
    delete registry.workspaceRoot
    registry.updatedAt = new Date().toISOString()
    atomicJson(registryPath(profile), registry)
    fs.unlinkSync(hostJournalPath(profile))
    return { ...result, receipt }
  } finally { releaseLock(lock) }
}

export function integrationRestoreSkills({ profileRoot, dryRun = false } = {}) {
  const profile = absolute(profileRoot, 'profileRoot'), receipt = path.join(profile, 'skills-migration-v1.json')
  if (fs.existsSync(hostJournalPath(profile))) fail('Finish the pending migration before restoring', 'INTEGRATION_RECOVERY_REQUIRED')
  const original = validateRegistry(readJson(receipt).original, profile), registry = readOptionalRegistry(profile)
  if (!registry || registry.installationId !== original.installationId || registry.productRootReal !== original.productRootReal) fail('Installation differs from migration receipt', 'INTEGRATION_CONFLICT')
  validateMigrationLinks(original)
  const links = original.managedLinks.filter(isWorkspaceSkillLink)
  for (const item of links) {
    const observed = inspectManagedJunction(item.destination, item)
    if (!['linked', 'broken'].includes(observed.state) || !fs.existsSync(item.source) || fs.realpathSync.native(item.source) !== item.sourceRealAtLink) fail('Cannot safely restore migration link', 'INTEGRATION_CONFLICT', observed)
  }
  const operations = links.filter(item => !fs.existsSync(item.destination)).map(item => ({ action: 'restore-junction', destination: item.destination, source: item.source }))
  if (dryRun) return { ...resultBase('restore-skills', profile), operations, dryRun }
  const lock = acquireLock(profile)
  try {
    if (JSON.stringify(readOptionalRegistry(profile)) !== JSON.stringify(registry)) fail('Registry changed during restore', 'INTEGRATION_CONFLICT')
    for (const item of links) {
      // Revalidate immediately before writing; never replace an occupied destination.
      try { fs.lstatSync(item.destination) } catch (error) {
        if (error.code !== 'ENOENT') throw error
        fs.mkdirSync(path.dirname(item.destination), { recursive: true })
        fs.symlinkSync(item.source, item.destination, 'junction')
      }
      if (inspectManagedJunction(item.destination, item).state !== 'linked') fail('Restore destination changed', 'INTEGRATION_CONFLICT')
    }
    registry.managedLinks = [...registry.managedLinks.filter(item => !isWorkspaceSkillLink(item)), ...links]
    registry.workspaceRoot = original.workspaceRoot
    registry.updatedAt = new Date().toISOString()
    atomicJson(registryPath(profile), registry)
    fs.unlinkSync(receipt)
    return { ...resultBase('restore-skills', profile), operations, changed: true }
  } finally { releaseLock(lock) }
}

function reconcileHostAugment(profile, adapter) {
  const file = hostJournalPath(profile)
  if (!fs.existsSync(file)) return
  const journal = readJson(file, 'INTEGRATION_RECOVERY_REQUIRED')
  if (journal.schemaVersion !== 1 || journal.operation !== 'augment') fail('Host integration journal requires manual recovery', 'INTEGRATION_RECOVERY_REQUIRED')
  if (journal.phase === 'registry_published') { fs.unlinkSync(file); return }
  if (journal.pathWritten) {
    const current = adapter.read()
    if (JSON.stringify(current) !== JSON.stringify(journal.pathWritten)) fail('User PATH changed during recovery', 'INTEGRATION_RECOVERY_REQUIRED')
    adapter.write(journal.pathOriginal)
  }
  for (const link of [...(journal.skillLinks || (journal.skillLink ? [journal.skillLink] : []))].reverse()) removeOwnedJunction(link.destination, link.rawLinkTarget)
  fs.unlinkSync(file)
}

function resumeHostUnlink(profile, adapter) {
  const file = hostJournalPath(profile), journal = readJson(file, 'INTEGRATION_RECOVERY_REQUIRED')
  if (journal.schemaVersion !== 1 || journal.operation !== 'unlink') fail('Host integration unlink journal requires manual recovery', 'INTEGRATION_RECOVERY_REQUIRED')
  if (journal.phase === 'prepared') { fs.unlinkSync(file); return }
  const registry = readOptionalRegistry(profile)
  if (!registry || registry.installationId !== journal.installationId) fail('Host integration registry changed during unlink recovery', 'INTEGRATION_RECOVERY_REQUIRED')
  const unlinkSkills = journal.skillLinks || (journal.skillLink ? [journal.skillLink] : [])
  if (journal.phase === 'path_removed') {
    for (const link of unlinkSkills) {
      const observed = inspectManagedJunction(link.destination, link)
      if (!['linked', 'broken'].includes(observed.state)) fail('Skill link changed during unlink recovery', 'INTEGRATION_RECOVERY_REQUIRED', observed)
    }
    for (const link of [...unlinkSkills].reverse()) {
      removeOwnedJunction(link.destination, link.rawLinkTarget)
    }
    journal.phase = 'skill_removed'; atomicJson(file, journal)
  }
  if (!['path_removed', 'skill_removed'].includes(journal.phase)) fail('Unknown host unlink recovery phase', 'INTEGRATION_RECOVERY_REQUIRED', { phase: journal.phase })
  const unlinkIds = new Set(unlinkSkills.map(item => item.id))
  registry.managedLinks = registry.managedLinks.filter(item => !unlinkIds.has(item.id))
  delete registry.workspaceRoot; delete registry.userPath
  registry.updatedAt = new Date().toISOString(); atomicJson(registryPath(profile), registry)
  fs.unlinkSync(file)
}

export function defaultProfileRoot(env = process.env) {
  const base = env.LOCALAPPDATA || (env.HOME ? path.join(env.HOME, '.local', 'share') : null)
  return base ? path.join(base, 'Nextstep', 'integration') : undefined
}

export function integrationPlan({ productRoot, profileRoot, workspaceRoot, manageUserPath = false, env = process.env, runtimeVersion = process.versions.node, pathAdapter } = {}) {
  const base = baseIntegrationPlan({ productRoot, profileRoot, env, runtimeVersion })
  const profile = path.resolve(profileRoot)
  if (workspaceRoot) validateWorkspace(workspaceRoot, validateProduct(productRoot).real, env)
  const userPath = manageUserPath ? pathPlan(profile, pathAdapter || defaultPathAdapter()) : null
  return { ...base, skills: { state: 'externally_managed', manager: 'Skills Manager' }, userPath, operations: [...base.operations, ...(userPath && !userPath.present ? [{ action: 'append-user-path', segment: userPath.segment }] : [])] }
}

export function integrationLink(options = {}) {
  const { workspaceRoot, manageUserPath = false, pathAdapter } = options
  const profileCandidate = options.profileRoot && path.isAbsolute(options.profileRoot) ? path.resolve(options.profileRoot) : null
  const registrySnapshot = profileCandidate && fs.existsSync(registryPath(profileCandidate)) ? fs.readFileSync(registryPath(profileCandidate)) : null
  if (profileCandidate && fs.existsSync(hostJournalPath(profileCandidate))) reconcileHostAugment(profileCandidate, pathAdapter || defaultPathAdapter())
  let plan, base
  if (profileCandidate && fs.existsSync(journalPath(profileCandidate))) {
    base = baseIntegrationLink(options)
    plan = integrationPlan(options)
  } else {
    plan = integrationPlan(options)
    base = baseIntegrationLink(options)
  }
  if (!workspaceRoot && !manageUserPath) return base
  const profile = path.resolve(options.profileRoot), adapter = pathAdapter || defaultPathAdapter()
  const lock = acquireLock(profile)
  let writtenPath = null
  try {
    const registry = validateRegistry(readJson(registryPath(profile)), profile)
    const hostJournal = { schemaVersion: 1, operation: 'augment', phase: 'prepared', installationId: registry.installationId, skillLinks: [], pathOriginal: null, pathWritten: null }
    atomicJson(hostJournalPath(profile), hostJournal)
    let userPath = registry.userPath
    if (manageUserPath && !plan.userPath.present) {
      const current = adapter.read()
      if (JSON.stringify(current) !== JSON.stringify(plan.userPath.original)) fail('User PATH changed after planning', 'INTEGRATION_CONFLICT')
      adapter.write(plan.userPath.next)
      const verified = adapter.read()
      if (JSON.stringify(verified) !== JSON.stringify(plan.userPath.next)) fail('User PATH verification failed', 'INTEGRATION_CONFLICT')
      writtenPath = { original: current, written: verified }
      hostJournal.pathOriginal = current; hostJournal.pathWritten = verified; hostJournal.phase = 'path_written'; atomicJson(hostJournalPath(profile), hostJournal)
      if (options.failAfter === 'path') throw Object.assign(new Error('Injected failure after PATH'), { code: 'INJECTED_FAILURE' })
      userPath = { managed: true, segment: plan.userPath.segment, originalType: current.type, originalValueHash: crypto.createHash('sha256').update(current.value).digest('hex'), original: current, written: verified, newProcessRequired: true }
      registry.userPath = userPath
    }
    registry.updatedAt = new Date().toISOString(); atomicJson(registryPath(profile), registry)
    hostJournal.phase = 'registry_published'; atomicJson(hostJournalPath(profile), hostJournal); fs.unlinkSync(hostJournalPath(profile))
    return { ...resultBase('link', profile), state: 'linked', changed: base.changed || Boolean(writtenPath), installationId: registry.installationId, managedLinks: registry.managedLinks, skills: plan.skills, userPath }
  } catch (error) {
    if (error.code !== 'INJECTED_FAILURE') {
      if (writtenPath && JSON.stringify(adapter.read()) === JSON.stringify(writtenPath.written)) adapter.write(writtenPath.original)
      try { fs.unlinkSync(hostJournalPath(profile)) } catch (unlinkError) { if (unlinkError.code !== 'ENOENT') throw unlinkError }
      if (base.changed) {
        const rollbackRegistry = validateRegistry(readJson(registryPath(profile)), profile)
        const tool = rollbackRegistry.managedLinks.find(item => item.id === LINK_ID)
        if (tool) removeOwnedJunction(tool.destination, tool.rawLinkTarget)
        rollbackRegistry.managedLinks = rollbackRegistry.managedLinks.filter(item => item.id !== LINK_ID)
        if (registrySnapshot) atomicBytes(registryPath(profile), registrySnapshot)
        else if (rollbackRegistry.managedLinks.length) atomicJson(registryPath(profile), rollbackRegistry)
        else fs.unlinkSync(registryPath(profile))
      }
    }
    throw error
  } finally { releaseLock(lock) }
}

export function integrationStatus({ profileRoot, workspaceRoot, pathAdapter } = {}) {
  const base = baseIntegrationStatus({ profileRoot })
  const profile = path.resolve(profileRoot), registry = readOptionalRegistry(profile)
  const legacyLinks = (registry?.managedLinks || []).filter(isWorkspaceSkillLink)
  const skills = { state: legacyLinks.length ? 'migration_required' : 'externally_managed', manager: 'Skills Manager', links: legacyLinks.map(item => ({ ...item, ...inspectManagedJunction(item.destination, item) })) }
  let userPath = null
  if (registry?.userPath?.managed) {
    const observed = (pathAdapter || defaultPathAdapter()).read()
    userPath = { ...registry.userPath, persisted: pathSegments(observed.value).some(item => sameSegment(item, registry.userPath.segment)) }
  }
  const pendingHostRecovery = fs.existsSync(hostJournalPath(profile))
  const degraded = base.status === 'degraded' || pendingHostRecovery || skills.links.some(item => !['linked'].includes(item.state)) || (userPath && !userPath.persisted)
  return { ...base, status: degraded ? 'degraded' : 'ok', state: pendingHostRecovery ? 'recovery_required' : base.state, skills, userPath, registry: registry ? { ...registry } : null }
}

export function integrationUnlink({ profileRoot, workspaceRoot, pathAdapter, failAfter, scope, dryRun = false } = {}) {
  if (scope && scope !== 'skills') fail('Only --scope skills is supported', 'USAGE')
  if (scope === 'skills') return detachWorkspaceSkills({ profileRoot, workspaceRoot, failAfter, dryRun })
  if (dryRun) fail('--dry-run requires --scope skills', 'USAGE')
  const profile = absolute(profileRoot, 'profileRoot'), adapter = pathAdapter || defaultPathAdapter()
  if (fs.existsSync(hostJournalPath(profile))) resumeHostUnlink(profile, adapter)
  const registry = readOptionalRegistry(profile)
  if (registry) {
    const lock = acquireLock(profile)
    try {
      const skill = registry.managedLinks.find(item => item.id === SKILL_LINK_ID)
      const codexSkills = registry.managedLinks.filter(item => item.host === 'codex' && ['skill', 'skill-support'].includes(item.kind)).sort((a, b) => a.id.localeCompare(b.id))
      const skillLinks = [...(skill ? [skill] : []), ...codexSkills]
      if (skillLinks.length) {
        if (workspaceRoot && path.resolve(workspaceRoot) !== path.resolve(registry.workspaceRoot)) fail('Workspace root does not match the managed installation', 'INTEGRATION_CONFLICT')
        for (const item of skillLinks) {
          const observed = inspectManagedJunction(item.destination, item)
          if (!['linked', 'broken'].includes(observed.state)) fail('Refusing to unlink a drifted skill destination', observed.state === 'drifted' ? 'INTEGRATION_DRIFT' : 'INTEGRATION_CONFLICT', observed)
        }
      }
      const journal = { schemaVersion: 1, operation: 'unlink', phase: 'prepared', installationId: registry.installationId, skillLinks }
      atomicJson(hostJournalPath(profile), journal)
      if (registry.userPath?.managed) {
        const current = adapter.read(), segments = pathSegments(current.value)
        const filtered = segments.filter(item => !sameSegment(item, registry.userPath.segment))
        if (filtered.length !== segments.length) adapter.write({ exists: current.exists, type: current.type, value: filtered.join(';') })
      }
      journal.phase = 'path_removed'; atomicJson(hostJournalPath(profile), journal)
      if (failAfter === 'unlink_path') throw Object.assign(new Error('Injected failure after unlink PATH'), { code: 'INJECTED_FAILURE' })
      if (skillLinks.length) {
        for (const item of [...skillLinks].reverse()) {
          removeOwnedJunction(item.destination, item.rawLinkTarget)
          if (failAfter === `unlink_codex:${item.name}`) throw Object.assign(new Error(`Injected failure after unlink Codex skill ${item.name}`), { code: 'INJECTED_FAILURE' })
        }
        const skillIds = new Set(skillLinks.map(item => item.id))
        registry.managedLinks = registry.managedLinks.filter(item => !skillIds.has(item.id)); delete registry.workspaceRoot
      }
      journal.phase = 'skill_removed'; atomicJson(hostJournalPath(profile), journal)
      if (failAfter === 'unlink_skill') throw Object.assign(new Error('Injected failure after unlink skill'), { code: 'INJECTED_FAILURE' })
      delete registry.userPath
      registry.updatedAt = new Date().toISOString(); atomicJson(registryPath(profile), registry)
      fs.unlinkSync(hostJournalPath(profile))
    } finally { releaseLock(lock) }
  }
  return baseIntegrationUnlink({ profileRoot: profile })
}

function workspaceSkillInventory(workspaceRoot) {
  if (!workspaceRoot) return { hosts: {}, destinations: [], skills: [], invalid: [], duplicates: [], managedSkills: [], managedInvalid: [], managedDuplicates: [] }
  const definitions = { antigravity: ['.agents/skills', '_agents/skills', '.gemini/skills', '.gemini/antigravity/skills'], codex: ['.codex/skills'] }
  const hosts = {}, destinations = [], skills = [], invalid = [], duplicates = [], managedSkills = [], managedInvalid = [], managedDuplicates = []
  for (const [host, relatives] of Object.entries(definitions)) {
    const hostSkills = [], hostInvalid = [], hostDestinations = []
    for (const relative of relatives) {
      const root = path.join(workspaceRoot, ...relative.split('/'))
      if (!fs.existsSync(root)) continue
      const inventory = skillInventory(root), destination = { host, relative, root, count: inventory.skills.length, invalidCount: inventory.invalid.length }
      hostDestinations.push(destination); destinations.push(destination)
      const decoratedSkills = inventory.skills.map(item => ({ ...item, host, destination: relative })), decoratedInvalid = inventory.invalid.map(item => ({ ...item, host, destination: relative }))
      hostSkills.push(...decoratedSkills); skills.push(...decoratedSkills); hostInvalid.push(...decoratedInvalid); invalid.push(...decoratedInvalid)
    }
    const grouped = new Map()
    for (const item of hostSkills) grouped.set(item.name, [...(grouped.get(item.name) || []), item])
    const hostDuplicates = [...grouped].filter(([, items]) => items.length > 1).map(([name, items]) => ({ host, name, files: items.map(item => item.file), destinations: items.map(item => item.destination) }))
    const hostManagedSkills = hostSkills.filter(item => item.name.startsWith('nxt-'))
    const hostManagedInvalid = hostInvalid.filter(item => path.basename(path.dirname(item.file)).startsWith('nxt-'))
    const hostManagedDuplicates = hostDuplicates.filter(item => item.name.startsWith('nxt-'))
    duplicates.push(...hostDuplicates)
    managedSkills.push(...hostManagedSkills); managedInvalid.push(...hostManagedInvalid); managedDuplicates.push(...hostManagedDuplicates)
    hosts[host] = { destinations: hostDestinations, skills: hostSkills, invalid: hostInvalid, duplicates: hostDuplicates, managedSkills: hostManagedSkills, managedInvalid: hostManagedInvalid, managedDuplicates: hostManagedDuplicates, healthy: hostDestinations.length > 0 && hostManagedSkills.length > 0 && hostManagedInvalid.length === 0 && hostManagedDuplicates.length === 0 }
  }
  return { hosts, destinations, skills, invalid, duplicates, managedSkills, managedInvalid, managedDuplicates }
}

export function integrationDoctor({ profileRoot, workspaceRoot, pathAdapter, paths, env = process.env } = {}) {
  let integration = null
  if (profileRoot) {
    try { integration = integrationStatus({ profileRoot, workspaceRoot, pathAdapter }) } catch (error) { integration = { status: 'degraded', state: 'error', error: { code: error.code || 'NEXTSTEP_FAILED', message: error.message } } }
  }
  const persistedSegment = integration?.userPath?.segment || (profileRoot ? linkPath(path.resolve(profileRoot)) : null)
  let observedUserPath = false
  if (persistedSegment && !integration?.userPath) { try { observedUserPath = pathSegments((pathAdapter || defaultPathAdapter()).read().value).some(item => sameSegment(item, persistedSegment)) } catch {} }
  const processPath = persistedSegment ? pathSegments(env.PATH).some(item => sameSegment(item, persistedSegment)) : false
  let holoself
  try {
    const result = spawnSync('holoself', ['--version'], { encoding: 'utf8', windowsHide: true, shell: false, timeout: 5000 })
    holoself = result.status === 0 ? { status: 'available', version: String(result.stdout || result.stderr).trim() } : { status: 'unavailable' }
  } catch { holoself = { status: 'unavailable' } }
  const pendingJournal = profileRoot && [journalPath(path.resolve(profileRoot)), hostJournalPath(path.resolve(profileRoot))].find(file => fs.existsSync(file))
  let recovery = { status: 'clear', action: 'none' }
  if (pendingJournal) {
    let phase = 'unknown', operation = 'unknown'
    try { const journal = readJson(pendingJournal, 'INTEGRATION_RECOVERY_REQUIRED'); phase = journal.phase; operation = journal.operation || 'tool-link' } catch {}
    recovery = { status: 'pending', journal: pendingJournal, operation, phase, action: operation === 'detach-skills' ? 'Run integration unlink --scope skills again after resolving drift.' : operation === 'unlink' ? 'Run integration unlink again after resolving any reported drift.' : 'Run integration link again with the same arguments to recover.' }
  }
  if (recovery.status === 'clear' && profileRoot && paths) recovery = projectRecoveryStatus({ profileRoot, dataRoot: paths.vaultRoot })
  const instance = paths ? { status: 'available', dataRoot: paths.vaultRoot, origin: paths.dataRootSource, marker: paths.instanceConfig } : { status: 'not_resolved' }
  const effectiveWorkspace = workspaceRoot || integration?.registry?.workspaceRoot
  const discovered = workspaceSkillInventory(effectiveWorkspace)
  const skillsHealthy = discovered.managedInvalid.length === 0 && discovered.managedDuplicates.length === 0
  let product = { status: 'unavailable', correction: 'Link a valid Nextstep product tree.' }
  if (integration?.registry?.productRootReal) {
    try {
      const manifestFile = path.join(integration.registry.productRootReal, 'package.json'), bytes = fs.readFileSync(manifestFile), manifest = JSON.parse(bytes)
      product = { status: 'available', root: integration.registry.productRoot, rootReal: integration.registry.productRootReal, version: manifest.version, manifestSha256: crypto.createHash('sha256').update(bytes).digest('hex'), runtime: { observed: process.versions.node, minimumMajor: 20, compatible: Number.parseInt(process.versions.node.split('.')[0], 10) >= 20 } }
    } catch (error) { product = { status: 'broken', cause: error.code || error.message, correction: 'Restore or relink the registered product tree.' } }
  }
  const stalePathEntries = pathSegments(env.PATH).filter(item => /[\/]nextstep[\/]integration[\/]bin$/i.test(item) && !fs.existsSync(item))
  const executable = { stalePathEntries, link: integration?.link || null, persistedPath: integration?.userPath?.persisted || observedUserPath, processPath, newProcessRequired: Boolean((integration?.userPath?.persisted || observedUserPath) && !processPath), correction: integration?.link?.state === 'linked' ? (processPath ? 'none' : integration?.userPath?.persisted ? 'Start a new process after persisting PATH.' : 'Run integration link with --manage-user-path, or invoke the linked launcher by absolute path.') : stalePathEntries.length ? `PATH lists a missing directory (${stalePathEntries.join('; ')}). Run integration link --profile-root <absolute-path> to recreate it, or integration unlink to clear the entry.` : 'Run integration link after resolving the reported destination state.' }
  const skills = { ...integration?.skills, ...discovered, state: integration?.skills?.state || 'externally_managed', manager: 'Skills Manager', healthy: skillsHealthy, hostEvidence: 'not_run', correction: 'Use Skills Manager status and a fresh host session to verify global deployment. Workspace inventory is not activation evidence.' }
  const data = paths ? { status: 'available', root: paths.vaultRoot } : { status: 'not_resolved', correction: 'Run from a linked instance or supply --data-root.' }
  const healthy = Boolean(integration && integration.status === 'ok' && integration.link?.state === 'linked' && (integration.userPath?.persisted || observedUserPath) && stalePathEntries.length === 0 && skillsHealthy && instance.status === 'available' && product.status === 'available' && recovery.status === 'clear')
  return { schemaVersion: 1, status: healthy ? 'ok' : 'degraded', healthy, executable, product, skills, instance, data, holoself: { ...holoself, correction: holoself.status === 'available' ? 'none' : 'Install or repair the external Holoself CLI when the task requires it.' }, recovery, limitations: ['Windows user PATH updates use read-validate-write and cannot provide compare-and-swap.'] }
}

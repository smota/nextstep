#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import process from 'node:process'

const DEFAULT_LOCK_DIR = '.coordination/locks'
const DEFAULT_LEASE_SECONDS = 1800
const MAX_LEASE_SECONDS = 86400

function fail(message) {
  throw new Error(message)
}

function parseArgs(argv) {
  const [command, ...rest] = argv
  const options = {}
  for (let i = 0; i < rest.length; i += 1) {
    const key = rest[i]
    if (!key.startsWith('--')) fail(`unexpected argument: ${key}`)
    const value = rest[i + 1]
    if (!value || value.startsWith('--')) fail(`missing value for ${key}`)
    options[key.slice(2)] = value
    i += 1
  }
  return { command, options }
}

function lockName(artifact) {
  const slug = basename(artifact.replaceAll('\\', '/')).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'artifact'
  const digest = createHash('sha256').update(artifact).digest('hex').slice(0, 12)
  return `${slug}-${digest}.lock.json`
}

function paths(options) {
  const artifact = options.artifact
  if (!artifact) fail('--artifact is required')
  const lockDir = resolve(options['lock-dir'] || DEFAULT_LOCK_DIR)
  mkdirSync(lockDir, { recursive: true })
  const lockPath = join(lockDir, lockName(artifact))
  return { artifact, lockDir, lockPath, guardPath: `${lockPath}.guard` }
}

function parseLease(value) {
  const leaseSeconds = value === undefined ? DEFAULT_LEASE_SECONDS : Number(value)
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > MAX_LEASE_SECONDS) {
    fail(`lease seconds must be integer from 1 to ${MAX_LEASE_SECONDS}`)
  }
  return leaseSeconds
}

function readLock(lockPath) {
  if (!existsSync(lockPath)) fail(`lock not found: ${lockPath}`)
  let lock
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf8'))
  } catch (error) {
    fail(`invalid lock record ${lockPath}: ${error.message}`)
  }
  for (const field of ['artifact_path', 'owning_agent', 'owner_token', 'task_id', 'claimed_at', 'heartbeat_at', 'lease_expires_at']) {
    if (typeof lock[field] !== 'string' || !lock[field]) fail(`invalid lock record ${lockPath}: missing ${field}`)
  }
  if (!Number.isInteger(lock.lease_seconds) || lock.lease_seconds < 1 || lock.lease_seconds > MAX_LEASE_SECONDS) fail(`invalid lock record ${lockPath}: bad lease_seconds`)
  for (const field of ['claimed_at', 'heartbeat_at', 'lease_expires_at']) if (!Number.isFinite(Date.parse(lock[field]))) fail(`invalid lock record ${lockPath}: bad ${field}`)
  if (lock.distributed_boundary !== 'local-filesystem-only') fail(`invalid lock record ${lockPath}: bad distributed boundary`)
  return lock
}

function atomicCreate(path, content) {
  let fd
  let created = false
  let complete = false
  try {
    fd = openSync(path, 'wx')
    created = true
    writeFileSync(fd, content, 'utf8')
    complete = true
  } finally {
    if (fd !== undefined) closeSync(fd)
    if (created && !complete) rmSync(path, { force: true })
  }
}

function atomicReplace(path, content) {
  const temp = `${path}.tmp-${process.pid}-${randomUUID()}`
  writeFileSync(temp, content, { encoding: 'utf8', flag: 'wx' })
  try {
    renameSync(temp, path)
  } finally {
    rmSync(temp, { force: true })
  }
}

function withMutationGuard(guardPath, action) {
  let acquired = false
  try {
    atomicCreate(guardPath, `${process.pid}\n`)
    acquired = true
    return action()
  } catch (error) {
    if (error.code === 'EEXIST') fail(`lock mutation already in progress: ${guardPath}`)
    throw error
  } finally {
    if (acquired) rmSync(guardPath, { force: true })
  }
}

function requireToken(lock, token) {
  if (!token) fail('--owner-token is required')
  if (lock.owner_token !== token) fail('owner token mismatch; refusing mutation')
}

function acquire(options) {
  const { artifact, lockPath } = paths(options)
  const leaseSeconds = parseLease(options['lease-seconds'])
  if (!options.agent) fail('--agent is required')
  if (!options.task) fail('--task is required')
  const now = new Date()
  const lock = {
    schema_version: 1,
    artifact_path: artifact,
    owning_agent: options.agent,
    owner_token: randomUUID(),
    task_id: options.task,
    claimed_at: now.toISOString(),
    heartbeat_at: now.toISOString(),
    lease_seconds: leaseSeconds,
    lease_expires_at: new Date(now.getTime() + leaseSeconds * 1000).toISOString(),
    intended_operation: options.operation || 'update',
    distributed_boundary: 'local-filesystem-only'
  }
  try {
    atomicCreate(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
  } catch (error) {
    if (error.code === 'EEXIST') {
      const existing = readLock(lockPath)
      fail(`artifact already locked by ${existing.owning_agent} for ${existing.task_id}; lease expires ${existing.lease_expires_at}`)
    }
    throw error
  }
  return { status: 'acquired', lock_path: lockPath, lock }
}

function heartbeat(options) {
  const { lockPath, guardPath } = paths(options)
  return withMutationGuard(guardPath, () => {
    const lock = readLock(lockPath)
    requireToken(lock, options['owner-token'])
    const now = new Date()
    const leaseSeconds = parseLease(options['lease-seconds'] || String(lock.lease_seconds))
    const updated = {
      ...lock,
      heartbeat_at: now.toISOString(),
      lease_seconds: leaseSeconds,
      lease_expires_at: new Date(now.getTime() + leaseSeconds * 1000).toISOString()
    }
    atomicReplace(lockPath, `${JSON.stringify(updated, null, 2)}\n`)
    return { status: 'renewed', lock_path: lockPath, lock: updated }
  })
}

function release(options) {
  const { lockPath, guardPath } = paths(options)
  return withMutationGuard(guardPath, () => {
    const lock = readLock(lockPath)
    requireToken(lock, options['owner-token'])
    const tombstone = `${lockPath}.released-${process.pid}-${randomUUID()}`
    renameSync(lockPath, tombstone)
    const moved = readLock(tombstone)
    requireToken(moved, options['owner-token'])
    rmSync(tombstone, { force: true })
    return { status: 'released', lock_path: lockPath, artifact_path: lock.artifact_path }
  })
}

function breakExpired(options) {
  const { lockPath, guardPath } = paths(options)
  if (!options['expected-heartbeat']) fail('--expected-heartbeat is required for expired-lock recovery')
  return withMutationGuard(guardPath, () => {
    const lock = readLock(lockPath)
    if (lock.heartbeat_at !== options['expected-heartbeat']) fail('heartbeat changed; refusing stale-lock recovery')
    if (Date.now() <= Date.parse(lock.lease_expires_at)) fail(`lease still active until ${lock.lease_expires_at}`)
    const tombstone = `${lockPath}.expired-${process.pid}-${randomUUID()}`
    renameSync(lockPath, tombstone)
    const moved = readLock(tombstone)
    if (moved.heartbeat_at !== options['expected-heartbeat']) fail('heartbeat changed during stale-lock recovery')
    rmSync(tombstone, { force: true })
    return { status: 'expired-lock-removed', lock_path: lockPath, prior_lock: moved }
  })
}

function inspect(options) {
  const { lockPath } = paths(options)
  const lock = readLock(lockPath)
  return { status: Date.now() > Date.parse(lock.lease_expires_at) ? 'expired' : 'active', lock_path: lockPath, lock }
}

function main() {
  const { command, options } = parseArgs(process.argv.slice(2))
  const commands = { acquire, heartbeat, release, inspect, 'break-expired': breakExpired }
  if (!commands[command]) fail('usage: vault-lock.mjs acquire|heartbeat|release|inspect|break-expired --artifact <path> [options]')
  console.log(JSON.stringify(commands[command](options), null, 2))
}

try {
  main()
} catch (error) {
  console.error(`vault-lock: ${error.message}`)
  process.exitCode = 1
}

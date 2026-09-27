import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { integrationLink, integrationPlan, integrationStatus, integrationUnlink } from '../src/integration.mjs'

const candidateRoot = path.resolve('.')
const candidateEntrypoint = path.join(candidateRoot, 'bin', 'nextstep.mjs')
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')

function ownedRoot(t, label = 'nextstep-c1-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), label))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return root
}

function syntheticProduct(t, marker = 'A') {
  const root = ownedRoot(t, 'nextstep-c1-product-')
  fs.mkdirSync(path.join(root, 'bin'), { recursive: true })
  fs.mkdirSync(path.join(root, 'launchers', 'windows'), { recursive: true })
  fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify({ name: 'nextstep', version: 'test' })}\n`)
  fs.copyFileSync(path.join(candidateRoot, 'launchers', 'windows', 'nextstep.cmd'), path.join(root, 'launchers', 'windows', 'nextstep.cmd'))
  fs.copyFileSync(path.join(candidateRoot, 'launchers', 'windows', 'nextstep-launcher.mjs'), path.join(root, 'launchers', 'windows', 'nextstep-launcher.mjs'))
  writeEntrypoint(root, marker)
  return root
}

function writeEntrypoint(root, marker) {
  const file = path.join(root, 'bin', 'nextstep.mjs')
  const temporary = `${file}.replacement`
  fs.writeFileSync(temporary, `#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({marker:${JSON.stringify(marker)},argv:process.argv.slice(2),cwd:process.cwd()})+'\\n')\n`)
  fs.renameSync(temporary, file)
}

function writeLauncherMarker(root, marker) {
  const file = path.join(root, 'launchers', 'windows', 'nextstep-launcher.mjs')
  const source = fs.readFileSync(path.join(candidateRoot, 'launchers', 'windows', 'nextstep-launcher.mjs'), 'utf8')
  const temporary = `${file}.replacement`
  const newline = source.indexOf('\n')
  fs.writeFileSync(temporary, `${source.slice(0, newline + 1)}process.stderr.write(${JSON.stringify(`launcher:${marker}\n`)})\n${source.slice(newline + 1)}`)
  fs.renameSync(temporary, file)
}

function invoke(profile, args = ['capabilities', '--json'], cwd = os.tmpdir()) {
  return spawnSync(`nextstep.cmd ${args.join(' ')}`, { cwd, encoding: 'utf8', shell: true, env: { ...process.env, PATH: `${path.join(profile, 'bin')};${path.dirname(process.execPath)};${process.env.SystemRoot}\\System32;${process.env.SystemRoot}` } })
}

test('C1-01/02/03/05/11/14 plan, link, invoke, repeat, and unlink without copies', t => {
  const profile = path.join(ownedRoot(t), 'profile with spaces')
  const before = sha(candidateEntrypoint)
  const plan = integrationPlan({ productRoot: candidateRoot, profileRoot: profile })
  assert.equal(plan.state, 'not_linked')
  assert.equal(fs.existsSync(profile), false)

  const linked = integrationLink({ productRoot: candidateRoot, profileRoot: profile })
  assert.equal(linked.changed, true)
  assert.equal(fs.lstatSync(path.join(profile, 'bin')).isSymbolicLink(), true)
  const run = invoke(profile)
  assert.equal(run.status, 0, run.stderr)
  assert.equal(JSON.parse(run.stdout).interface, 'local-cli')
  const invalid = invoke(profile, ['no-such-command'])
  assert.equal(invalid.status, 64)
  assert.equal(JSON.parse(invalid.stderr).error.code, 'USAGE')

  const registry = JSON.parse(fs.readFileSync(path.join(profile, 'integration-v1.json'), 'utf8'))
  const repeated = integrationLink({ productRoot: candidateRoot, profileRoot: profile })
  assert.equal(repeated.changed, false)
  assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'integration-v1.json'), 'utf8')).installationId, registry.installationId)
  assert.deepEqual(fs.readdirSync(profile).sort(), ['bin', 'integration-v1.json', 'transactions'].sort())
  for (const name of fs.readdirSync(profile)) {
    const stat = fs.lstatSync(path.join(profile, name))
    if (name === 'bin') assert.equal(stat.isSymbolicLink(), true)
    else if (stat.isFile()) assert.equal(stat.nlink, 1)
    else assert.equal(stat.isDirectory(), true)
  }
  assert.deepEqual(fs.readdirSync(path.join(profile, 'transactions')), [])
  assert.equal(fs.statSync(path.join(profile, 'integration-v1.json')).nlink, 1)
  assert.equal(sha(candidateEntrypoint), before)

  const removed = integrationUnlink({ profileRoot: profile })
  assert.equal(removed.changed, true)
  assert.equal(fs.existsSync(path.join(profile, 'bin')), false)
  assert.equal(fs.existsSync(candidateEntrypoint), true)
})

test('C1-04 source entrypoint and launcher rename updates flow through the same junction', t => {
  const product = syntheticProduct(t, 'A'), profile = path.join(ownedRoot(t), 'profile')
  integrationLink({ productRoot: product, profileRoot: profile })
  let run = invoke(profile, ['probe'], ownedRoot(t, 'nextstep-c1-cwd-'))
  assert.equal(run.status, 0, run.stderr)
  assert.equal(JSON.parse(run.stdout).marker, 'A')

  writeEntrypoint(product, 'B')
  run = invoke(profile, ['probe'])
  assert.equal(JSON.parse(run.stdout).marker, 'B')
  writeLauncherMarker(product, 'L1')
  run = invoke(profile, ['probe'])
  assert.match(run.stderr, /launcher:L1/)
  writeLauncherMarker(product, 'L2')
  run = invoke(profile, ['probe'])
  assert.match(run.stderr, /launcher:L2/)
  assert.match(fs.readFileSync(path.join(profile, 'bin', 'nextstep-launcher.mjs'), 'utf8'), /launcher:L2/)
  integrationUnlink({ profileRoot: profile })
})

test('C1-06/07/12 preserve unknown objects and drifted junctions', t => {
  const root = ownedRoot(t), profile = path.join(root, 'profile')
  fs.mkdirSync(path.join(profile, 'bin'), { recursive: true })
  fs.writeFileSync(path.join(profile, 'bin', 'canary.txt'), 'keep')
  assert.throws(() => integrationLink({ productRoot: candidateRoot, profileRoot: profile }), error => error.code === 'INTEGRATION_CONFLICT')
  assert.equal(fs.readFileSync(path.join(profile, 'bin', 'canary.txt'), 'utf8'), 'keep')

  fs.rmSync(path.join(profile, 'bin'), { recursive: true })
  integrationLink({ productRoot: candidateRoot, profileRoot: profile })
  fs.unlinkSync(path.join(profile, 'bin'))
  const other = path.join(root, 'other'); fs.mkdirSync(other)
  fs.symlinkSync(other, path.join(profile, 'bin'), 'junction')
  assert.equal(integrationStatus({ profileRoot: profile }).state, 'drifted')
  assert.throws(() => integrationUnlink({ profileRoot: profile }), error => error.code === 'INTEGRATION_DRIFT')
  assert.equal(fs.realpathSync.native(path.join(profile, 'bin')), fs.realpathSync.native(other))
  fs.unlinkSync(path.join(profile, 'bin'))
})

test('C1-06 preserves unknown file and unknown junction destinations', t => {
  for (const kind of ['file', 'junction']) {
    const root = ownedRoot(t, `nextstep-c1-${kind}-`), profile = path.join(root, 'profile'), destination = path.join(profile, 'bin')
    fs.mkdirSync(profile)
    if (kind === 'file') fs.writeFileSync(destination, 'keep')
    else { const target = path.join(root, 'target'); fs.mkdirSync(target); fs.symlinkSync(target, destination, 'junction') }
    assert.throws(() => integrationLink({ productRoot: candidateRoot, profileRoot: profile }), error => error.code === 'INTEGRATION_CONFLICT')
    if (kind === 'file') assert.equal(fs.readFileSync(destination, 'utf8'), 'keep')
    else assert.equal(fs.lstatSync(destination).isSymbolicLink(), true)
  }
})

test('C1-12 rejects a crafted registry that targets an external junction', t => {
  const root = ownedRoot(t), profile = path.join(root, 'profile'), external = path.join(root, 'external-link'), target = path.join(root, 'target')
  fs.mkdirSync(profile, { recursive: true }); fs.mkdirSync(target)
  fs.symlinkSync(target, external, 'junction')
  const installationId = crypto.randomUUID(), rawLinkTarget = fs.readlinkSync(external)
  fs.writeFileSync(path.join(profile, 'integration-v1.json'), `${JSON.stringify({ schemaVersion: 1, installationId, productRoot: candidateRoot, productRootReal: candidateRoot, profileRoot: profile, managedLinks: [{ id: 'tool:nextstep', kind: 'tool', destination: external, source: target, sourceRealAtLink: target, rawLinkTarget, linkType: 'junction', ownerInstallationId: installationId }] })}\n`)
  assert.throws(() => integrationUnlink({ profileRoot: profile }), error => error.code === 'INTEGRATION_CONFLICT')
  assert.equal(fs.lstatSync(external).isSymbolicLink(), true)
})

test('C1-07 unlink blocks when the raw target is unchanged but its physical target drifted', t => {
  const product = syntheticProduct(t), profile = path.join(ownedRoot(t), 'profile')
  integrationLink({ productRoot: product, profileRoot: profile })
  const launchers = path.join(product, 'launchers', 'windows'), original = path.join(product, 'launchers', 'windows-original'), replacement = path.join(product, 'replacement-launchers')
  fs.renameSync(launchers, original)
  fs.mkdirSync(replacement)
  fs.copyFileSync(path.join(original, 'nextstep.cmd'), path.join(replacement, 'nextstep.cmd'))
  fs.copyFileSync(path.join(original, 'nextstep-launcher.mjs'), path.join(replacement, 'nextstep-launcher.mjs'))
  fs.symlinkSync(replacement, launchers, 'junction')
  assert.equal(integrationStatus({ profileRoot: profile }).state, 'drifted')
  assert.throws(() => integrationUnlink({ profileRoot: profile }), error => error.code === 'INTEGRATION_DRIFT')
  assert.equal(fs.lstatSync(path.join(profile, 'bin')).isSymbolicLink(), true)
  fs.unlinkSync(path.join(profile, 'bin')); fs.unlinkSync(launchers)
})

test('C1-08 broken source is diagnosed and unlink removes only the junction', t => {
  const product = syntheticProduct(t), profile = path.join(ownedRoot(t), 'profile')
  const moved = `${product}-moved`
  integrationLink({ productRoot: product, profileRoot: profile })
  fs.renameSync(product, moved)
  t.after(() => { if (fs.existsSync(moved)) fs.renameSync(moved, product) })
  assert.equal(integrationStatus({ profileRoot: profile }).state, 'broken')
  assert.equal(integrationUnlink({ profileRoot: profile }).changed, true)
  assert.equal(fs.existsSync(moved), true)
})

test('C1-09/10 lock and interrupted temporary link fail closed and recover', t => {
  const profile = path.join(ownedRoot(t), 'profile')
  fs.mkdirSync(profile, { recursive: true })
  fs.writeFileSync(path.join(profile, 'integration.lock'), 'owned-by-test')
  assert.throws(() => integrationLink({ productRoot: candidateRoot, profileRoot: profile }), error => error.code === 'INTEGRATION_BUSY')
  fs.unlinkSync(path.join(profile, 'integration.lock'))

  assert.throws(() => integrationLink({ productRoot: candidateRoot, profileRoot: profile, failAfter: 'temporary_link' }), error => error.code === 'INJECTED_FAILURE')
  assert.equal(integrationStatus({ profileRoot: profile }).state, 'recovery_required')
  const recovered = integrationLink({ productRoot: candidateRoot, profileRoot: profile })
  assert.equal(recovered.state, 'linked')
  assert.equal(fs.readdirSync(profile).some(name => name.startsWith('bin.nextstep-')), false)
  integrationUnlink({ profileRoot: profile })
})

test('C1-10 failure immediately after journal recovers without residue', t => {
  const profile = path.join(ownedRoot(t), 'profile')
  assert.throws(() => integrationLink({ productRoot: candidateRoot, profileRoot: profile, failAfter: 'journal' }), error => error.code === 'INJECTED_FAILURE')
  const journal = JSON.parse(fs.readFileSync(path.join(profile, 'transactions', 'active.json'), 'utf8'))
  assert.deepEqual({ planState: journal.preconditions.planState, destinationPresent: journal.preconditions.destinationPresent, registryPresent: journal.preconditions.registryPresent }, { planState: 'not_linked', destinationPresent: false, registryPresent: false })
  assert.equal(journal.preconditions.productRootReal, fs.realpathSync.native(candidateRoot))
  assert.equal(journal.preconditions.sourceReal, fs.realpathSync.native(path.join(candidateRoot, 'launchers', 'windows')))
  assert.equal(integrationStatus({ profileRoot: profile }).state, 'recovery_required')
  assert.equal(integrationLink({ productRoot: candidateRoot, profileRoot: profile }).state, 'linked')
  assert.equal(fs.existsSync(path.join(profile, 'transactions', 'active.json')), false)
  integrationUnlink({ profileRoot: profile })
})

test('C1-10 published link without registry requires explicit recovery', t => {
  const profile = path.join(ownedRoot(t), 'profile')
  assert.throws(() => integrationLink({ productRoot: candidateRoot, profileRoot: profile, failAfter: 'link_published' }), error => error.code === 'INJECTED_FAILURE')
  assert.equal(integrationStatus({ profileRoot: profile }).state, 'recovery_required')
  const journal = JSON.parse(fs.readFileSync(path.join(profile, 'transactions', 'active.json'), 'utf8'))
  assert.equal(journal.phase, 'link_published')
  assert.equal(fs.lstatSync(path.join(profile, 'bin')).isSymbolicLink(), true)
  assert.throws(() => integrationLink({ productRoot: candidateRoot, profileRoot: profile }), error => error.code === 'INTEGRATION_RECOVERY_REQUIRED')
  fs.unlinkSync(path.join(profile, 'bin'))
})

test('C1-13 rejects overlap and reports cloud-sync placement', t => {
  assert.throws(() => integrationPlan({ productRoot: candidateRoot, profileRoot: path.join(candidateRoot, '.profile') }), error => error.code === 'INVALID_PROFILE_ROOT')
  const cloud = ownedRoot(t, 'nextstep-c1-cloud-'), profile = path.join(cloud, 'profile')
  const plan = integrationPlan({ productRoot: candidateRoot, profileRoot: profile, env: { ...process.env, OneDrive: cloud } })
  assert.equal(plan.checks.cloudSyncProfile.status, 'warning')
  assert.equal(plan.checks.sourceVolume.value, path.parse(candidateRoot).root)
  assert.equal(plan.checks.profileVolume.value, path.parse(profile).root)
  assert.equal(plan.checks.runtime.minimumMajor, 20)
  const unsupportedProfile = path.join(cloud, 'old-node')
  assert.throws(() => integrationPlan({ productRoot: candidateRoot, profileRoot: unsupportedProfile, runtimeVersion: '19.9.0' }), error => error.code === 'INTEGRATION_UNSUPPORTED')
  assert.throws(() => integrationLink({ productRoot: candidateRoot, profileRoot: unsupportedProfile, runtimeVersion: '19.9.0' }), error => error.code === 'INTEGRATION_UNSUPPORTED')
  assert.equal(fs.existsSync(unsupportedProfile), false)
})

test('C1-13 rejects a profile path that traverses an intermediate junction', t => {
  const root = ownedRoot(t), lexical = path.join(root, 'lexical'), outside = path.join(root, 'outside')
  fs.mkdirSync(lexical); fs.mkdirSync(outside)
  fs.symlinkSync(outside, path.join(lexical, 'jump'), 'junction')
  assert.throws(() => integrationPlan({ productRoot: candidateRoot, profileRoot: path.join(lexical, 'jump', 'profile') }), error => error.code === 'INVALID_PROFILE_ROOT')
})

test('C1-08b link repairs a managed junction that was removed from disk', t => {
  const product = syntheticProduct(t), profile = path.join(ownedRoot(t), 'profile')
  integrationLink({ productRoot: product, profileRoot: profile })
  fs.unlinkSync(path.join(profile, 'bin'))
  assert.equal(integrationStatus({ profileRoot: profile }).state, 'broken')
  const repaired = integrationLink({ productRoot: product, profileRoot: profile })
  assert.equal(repaired.state, 'linked')
  assert.equal(repaired.managedLinks.length, 1)
  assert.equal(integrationStatus({ profileRoot: profile }).state, 'linked')
  integrationUnlink({ profileRoot: profile })
})

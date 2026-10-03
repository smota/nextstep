import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import {
  admitChild,
  cleanEnvironment,
  cleanupSuiteRoot,
  createOwnedCaseRoot,
  createOwnedSuiteRoot,
  productChild,
  runBaseline,
  safeTeardown,
  treeHash
} from '../scripts/c0-baseline.mjs'

const sentinel = '.c0-baseline-owned'

function expectCode(fn, code) {
  assert.throws(fn, error => error?.code === code)
}

test('C0 baseline covers B01-B10 with bounded evidence and the preserved candidate', () => {
  const report = runBaseline()
  assert.equal(report.status, 'passed')
  assert.deepEqual(report.cases.map(item => item.caseId), ['C0-B01', 'C0-B02', 'C0-B03', 'C0-B04', 'C0-B05', 'C0-B06', 'C0-B07', 'C0-B08', 'C0-B09', 'C0-B10'])
  for (const item of report.cases) assert.equal(item.status, 'passed', item.caseId)

  assert.equal(report.baseline.referenceCommit, 'baae1363398b3ce668aea5a40659b5888a245a06')
  assert.equal('commit' in report.baseline, false, 'historical reference must not be presented as an observed commit')
  assert.equal(report.baseline.candidateUnchanged, true)
  assert.match(report.baseline.binSha256, /^[A-F0-9]{64}$/)
  assert.ok(Object.keys(report.baseline.candidateFiles).includes('src/command-catalog.mjs'))
  assert.ok(Object.keys(report.baseline.candidateFiles).includes('src/strategy-catalog.mjs'))
  assert.ok(Object.keys(report.baseline.candidateFiles).every(name => name === 'package.json' || name === 'bin/nextstep.mjs' || name.startsWith('src/') || name.startsWith('skills/')))
  assert.deepEqual(report.cases.find(item => item.caseId === 'C0-B09').inventory.skills.map(item => item.path), [
    'skills/agentflow-auditor/SKILL.md',
    'skills/agentflow-collaborator/SKILL.md',
    'skills/agentflow-designer/SKILL.md',
    'skills/agentflow-migrator/SKILL.md',
    'skills/agentflow-orchestrator/SKILL.md',
    'skills/agentflow-scanner/SKILL.md',
    'skills/nxt-application/SKILL.md',
    'skills/nxt-context/SKILL.md',
    'skills/nxt-networking/SKILL.md',
    'skills/nxt-opportunity/SKILL.md',
    'skills/nxt-review/SKILL.md'
  ])
  assert.equal(JSON.stringify(report).match(/[A-Za-z]:[\\/]|\/Users\//i), null, 'report must not expose absolute host paths')
})

test('baseline evidence proves precedence, resolver failure, read-only behavior, and real B10 rejection', () => {
  const report = runBaseline()
  const explicit = report.cases.find(item => item.caseId === 'C0-B04')
  assert.deepEqual(explicit.argv, ['get', '--id', 'company:c0', '--data-root', 'fixtureA'])
  assert.deepEqual(explicit.env, { NEXTSTEP_DATA_ROOT: 'fixtureB' })
  assert.equal(explicit.result.value.name, 'fixture-A')
  assert.equal(explicit.resolution.vaultRoot, 'fixtureA')

  const missing = report.cases.find(item => item.caseId === 'C0-B06')
  assert.equal(missing.result.errorCode, 'NOT_FOUND')
  assert.equal(missing.resolution.ok, true)
  assert.equal(missing.noRootAncestorsMarkerFree, true)
  for (const item of report.cases.filter(item => 'readOnlyUnchanged' in item)) assert.equal(item.readOnlyUnchanged, true, item.caseId)

  const escaped = report.cases.find(item => item.caseId === 'C0-B10')
  assert.deepEqual(escaped.guardRejections, {
    directExternal: 'C0_UNSAFE_PATH',
    junctionEscape: 'C0_UNSAFE_PATH',
    externalTeardown: 'C0_UNSAFE_TEARDOWN'
  })
  assert.deepEqual(escaped.productGuardRejections, {
    directExternal: 'C0_UNSAFE_PATH',
    junctionEscape: 'C0_UNSAFE_PATH'
  })
  assert.equal(escaped.externalSentinelPreserved, true)
  assert.equal(escaped.executionCanaryAbsent, true)
  assert.equal(report.cases.find(item => item.caseId === 'C0-B09').hostDiscovery, 'not_run')
})

test('fixture hashes and candidate fingerprint are deterministic across isolated runs', () => {
  const first = runBaseline()
  const second = runBaseline()
  assert.equal(first.baseline.candidateFingerprint, second.baseline.candidateFingerprint)
  assert.deepEqual(first.cases.find(item => item.caseId === 'C0-B09').fixtureHashes, second.cases.find(item => item.caseId === 'C0-B09').fixtureHashes)
})

test('read-only tree hash detects newly created empty directories', () => {
  const suite = createOwnedSuiteRoot('nextstep-c0-test-suite-')
  const ownedCase = createOwnedCaseRoot(suite, 'tree-hash-')
  try {
    const before = treeHash(ownedCase.real)
    fs.mkdirSync(path.join(ownedCase.real, '.nextstep'))
    assert.notEqual(treeHash(ownedCase.real), before)
  } finally {
    if (fs.existsSync(ownedCase.root)) safeTeardown(ownedCase, suite)
    if (fs.existsSync(suite.root)) cleanupSuiteRoot(suite)
  }
})

test('environment cleaning strips every NEXTSTEP case variant and inherits PATH only when explicit', () => {
  const source = { Path: 'old-path', NEXTSTEP_DATA_ROOT: 'secret-a', NextStep_State_Root: 'secret-b', KEEP: 'yes' }
  assert.deepEqual(cleanEnvironment(source), { KEEP: 'yes' })
  assert.deepEqual(cleanEnvironment(source, { PATH: 'controlled' }), { KEEP: 'yes', PATH: 'controlled' })
})

test('standalone harness strips poisoned mixed-case NEXTSTEP variables and sanitizes evidence', () => {
  const script = path.resolve('scripts/c0-baseline.mjs')
  const poisonRoot = path.join(process.cwd(), 'c0-private-poison-root')
  const poisonState = path.join(process.cwd(), 'c0-private-poison-state')
  const poisonToken = 'c0-qa-token-must-not-appear'
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^NEXTSTEP_/i.test(key)))
  const env = {
    ...inherited,
    NextStep_Data_Root: poisonRoot,
    nExTsTeP_sTaTe_RoOt: poisonState,
    NEXTSTEP_QA_TOKEN: poisonToken
  }
  const result = spawnSync(process.execPath, [script], { cwd: process.cwd(), env, encoding: 'utf8', shell: false, timeout: 30_000 })
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.status, 'passed')
  assert.equal(report.cases.find(item => item.caseId === 'C0-B06').result.errorCode, 'NOT_FOUND')
  for (const forbidden of [poisonRoot, poisonState, poisonToken, process.cwd(), os.homedir(), os.tmpdir()]) {
    assert.equal(result.stdout.toLowerCase().includes(forbidden.toLowerCase()), false, `evidence leaked ${forbidden}`)
  }
})

test('admission accepts a real owned descendant and rejects direct and junction escapes', () => {
  const suite = createOwnedSuiteRoot('nextstep-c0-test-suite-')
  const ownedCase = createOwnedCaseRoot(suite, 'valid-')
  const external = createOwnedSuiteRoot('nextstep-c0-test-external-')
  try {
    const cwd = path.join(ownedCase.real, 'nested')
    const fixture = path.join(ownedCase.real, 'fixture')
    fs.mkdirSync(cwd)
    fs.mkdirSync(fixture)
    assert.equal(admitChild({ suite, caseRoot: ownedCase, cwd, dataRoot: fixture }), true)
    expectCode(() => admitChild({ suite, caseRoot: ownedCase, cwd, dataRoot: external.real }), 'C0_UNSAFE_PATH')

    const junction = path.join(ownedCase.real, 'escape')
    fs.symlinkSync(external.real, junction, 'junction')
    expectCode(() => admitChild({ suite, caseRoot: ownedCase, cwd, dataRoot: junction }), 'C0_UNSAFE_PATH')

    const aliasBack = path.join(external.real, 'alias-back')
    fs.symlinkSync(fixture, aliasBack, 'junction')
    expectCode(() => admitChild({ suite, caseRoot: ownedCase, cwd, dataRoot: aliasBack }), 'C0_UNSAFE_PATH')
  } finally {
    if (fs.existsSync(ownedCase.root)) safeTeardown(ownedCase, suite)
    if (fs.existsSync(external.root)) cleanupSuiteRoot(external)
    if (fs.existsSync(suite.root)) cleanupSuiteRoot(suite)
  }
})

test('product wrapper binds the actual --data-root operand to the shared admission guard', () => {
  const suite = createOwnedSuiteRoot('nextstep-c0-test-suite-')
  const ownedCase = createOwnedCaseRoot(suite, 'product-guard-')
  const external = createOwnedSuiteRoot('nextstep-c0-test-external-')
  try {
    const cwd = path.join(ownedCase.real, 'cwd')
    const localRoot = path.join(ownedCase.real, 'local')
    fs.mkdirSync(cwd)
    fs.mkdirSync(localRoot)
    const options = { suite, caseRoot: ownedCase, cwd, env: cleanEnvironment() }

    expectCode(() => productChild(['get', '--id', 'company:c0', '--data-root', external.real], options), 'C0_UNSAFE_PATH')
    expectCode(() => productChild(['get', '--id', 'company:c0', '--data-root', localRoot, '--data-root', localRoot], options), 'C0_UNSAFE_PATH')
    expectCode(() => productChild(['get', '--id', 'company:c0', '--data-root', 'relative-root'], options), 'C0_UNSAFE_PATH')
    expectCode(() => productChild(['get', '--id', 'company:c0', '--data-root', localRoot], { ...options, dataRoot: external.real }), 'C0_UNSAFE_PATH')

    const junction = path.join(ownedCase.real, 'product-escape')
    fs.symlinkSync(external.real, junction, 'junction')
    expectCode(() => productChild(['get', '--id', 'company:c0', '--data-root', junction], options), 'C0_UNSAFE_PATH')
  } finally {
    if (fs.existsSync(ownedCase.root)) safeTeardown(ownedCase, suite)
    if (fs.existsSync(external.root)) cleanupSuiteRoot(external)
    if (fs.existsSync(suite.root)) cleanupSuiteRoot(suite)
  }
})

test('owned-root factories reject path-bearing prefixes before creating anything', () => {
  expectCode(() => createOwnedSuiteRoot('../escape-'), 'C0_UNSAFE_PATH')
  const suite = createOwnedSuiteRoot('nextstep-c0-test-suite-')
  try {
    expectCode(() => createOwnedCaseRoot(suite, 'nested/escape-'), 'C0_UNSAFE_PATH')
  } finally { cleanupSuiteRoot(suite) }
})

test('teardown refuses equality, external sibling, missing/wrong/symlink marker, and a swapped root link', t => {
  const suite = createOwnedSuiteRoot('nextstep-c0-test-suite-')
  const external = createOwnedSuiteRoot('nextstep-c0-test-external-')
  const ownedCase = createOwnedCaseRoot(suite, 'guarded-')
  const marker = path.join(ownedCase.root, sentinel)
  const savedMarker = path.join(ownedCase.root, '.saved-marker')
  try {
    expectCode(() => safeTeardown(suite, suite), 'C0_UNSAFE_TEARDOWN')
    expectCode(() => safeTeardown(external, suite), 'C0_UNSAFE_TEARDOWN')

    fs.renameSync(marker, savedMarker)
    expectCode(() => safeTeardown(ownedCase, suite), 'C0_UNSAFE_OWNERSHIP')
    fs.renameSync(savedMarker, marker)

    const original = fs.readFileSync(marker, 'utf8')
    fs.writeFileSync(marker, '{"nonce":"wrong"}\n')
    expectCode(() => safeTeardown(ownedCase, suite), 'C0_UNSAFE_OWNERSHIP')
    fs.writeFileSync(marker, original)

    fs.renameSync(marker, savedMarker)
    try {
      fs.symlinkSync(savedMarker, marker, 'file')
      expectCode(() => safeTeardown(ownedCase, suite), 'C0_UNSAFE_OWNERSHIP')
      fs.unlinkSync(marker)
    } catch (error) {
      if (fs.existsSync(marker)) fs.unlinkSync(marker)
      if (error?.code === 'EPERM') t.diagnostic('file symlink creation unavailable; junction swap still validates link rejection')
      else throw error
    }
    fs.renameSync(savedMarker, marker)

    const parked = `${ownedCase.root}-parked`
    fs.renameSync(ownedCase.root, parked)
    fs.symlinkSync(external.real, ownedCase.root, 'junction')
    expectCode(() => safeTeardown(ownedCase, suite), 'C0_UNSAFE_OWNERSHIP')
    fs.unlinkSync(ownedCase.root)
    fs.renameSync(parked, ownedCase.root)

    safeTeardown(ownedCase, suite)
    assert.equal(fs.existsSync(ownedCase.root), false)
  } finally {
    if (fs.existsSync(ownedCase.root)) safeTeardown(ownedCase, suite)
    if (fs.existsSync(external.root)) cleanupSuiteRoot(external)
    if (fs.existsSync(suite.root)) cleanupSuiteRoot(suite)
  }
})

test('standalone harness rejects all arguments with sanitized structured JSON', () => {
  const script = path.resolve('scripts/c0-baseline.mjs')
  const supplied = path.join(process.cwd(), 'private-value')
  const result = spawnSync(process.execPath, [script, '--data-root', supplied], { cwd: process.cwd(), encoding: 'utf8', shell: false, timeout: 10_000 })
  const report = JSON.parse(result.stdout)
  assert.equal(result.status, 1)
  assert.deepEqual(report, { schemaVersion: 1, status: 'failed', error: { code: 'C0_ARGUMENTS_FORBIDDEN' }, cases: [] })
  assert.equal(result.stdout.includes(supplied), false)
})

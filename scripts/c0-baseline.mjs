import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const candidate = path.resolve(here, '..')
const candidateBin = path.join(candidate, 'bin', 'nextstep.mjs')
const baselineCommit = 'baae1363398b3ce668aea5a40659b5888a245a06'
const expectedBinHash = 'D0F54C08CB4C0F1A545B6EFFBD37EED6622AE47246A3A8ED6FE3851A9780D5D0'
const sentinel = '.c0-baseline-owned'
const requiredRecords = ['companies', 'opportunities', 'applicationAttempts', 'people', 'interactions', 'artifacts', 'strategies', 'experiments']
const recordFiles = {
  companies: 'companies.json', opportunities: 'opportunities.json', applicationAttempts: 'application-attempts.json',
  people: 'people.json', interactions: 'interactions.json', artifacts: 'artifacts.json', strategies: 'strategies.json', experiments: 'experiments.json'
}

function coded(message, code) { return Object.assign(new Error(message), { code }) }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex') }
function hashFile(file) { return sha256(fs.readFileSync(file)).toUpperCase() }
function parseJson(text) { try { return JSON.parse(text) } catch { return null } }
function contained(root, target) {
  const relative = path.relative(root, target)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}
function identity(stat) { return { dev: stat.dev, ino: stat.ino } }
function sameIdentity(left, right) { return left.dev === right.dev && left.ino === right.ino }

function captureOwnership(root, nonce, kind, tempBaseReal) {
  try {
    const rootStat = fs.lstatSync(root)
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw coded('Owned root must be a real directory', 'C0_UNSAFE_OWNERSHIP')
    const real = fs.realpathSync.native(root)
    const marker = path.join(root, sentinel)
    const markerStat = fs.lstatSync(marker)
    if (!markerStat.isFile() || markerStat.isSymbolicLink()) throw coded('Ownership marker must be a real file', 'C0_UNSAFE_OWNERSHIP')
    const value = parseJson(fs.readFileSync(marker, 'utf8'))
    if (value?.schemaVersion !== 1 || value?.nonce !== nonce || value?.kind !== kind) throw coded('Ownership marker does not match', 'C0_UNSAFE_OWNERSHIP')
    return { root, real, nonce, kind, tempBaseReal, rootIdentity: identity(rootStat), markerIdentity: identity(markerStat) }
  } catch (error) {
    if (error?.code === 'C0_UNSAFE_OWNERSHIP') throw error
    throw coded('Owned root or marker is unavailable', 'C0_UNSAFE_OWNERSHIP')
  }
}

function validateOwnership(ownership) {
  if (!ownership || typeof ownership !== 'object') throw coded('Ownership is required', 'C0_UNSAFE_OWNERSHIP')
  const current = captureOwnership(ownership.root, ownership.nonce, ownership.kind, ownership.tempBaseReal)
  if (current.real !== ownership.real || !sameIdentity(current.rootIdentity, ownership.rootIdentity) || !sameIdentity(current.markerIdentity, ownership.markerIdentity)) {
    throw coded('Owned root changed after capture', 'C0_UNSAFE_OWNERSHIP')
  }
  return current
}

function initializeOwnedRoot(root, kind, tempBaseReal) {
  const nonce = crypto.randomUUID()
  fs.writeFileSync(path.join(root, sentinel), `${JSON.stringify({ schemaVersion: 1, kind, nonce })}\n`, { flag: 'wx' })
  return captureOwnership(root, nonce, kind, tempBaseReal)
}

function safePrefix(prefix) {
  if (typeof prefix !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*-$/.test(prefix) || prefix.includes('..')) {
    throw coded('Temporary prefix must be a simple bounded name ending in a dash', 'C0_UNSAFE_PATH')
  }
  return prefix
}

export function createOwnedSuiteRoot(prefix = 'nextstep-c0-suite-') {
  const tempBaseReal = fs.realpathSync.native(os.tmpdir())
  const root = fs.mkdtempSync(path.join(tempBaseReal, safePrefix(prefix)))
  return initializeOwnedRoot(root, 'suite', tempBaseReal)
}

export function createOwnedCaseRoot(suite, prefix = 'case-') {
  const validSuite = validateOwnership(suite)
  const root = fs.mkdtempSync(path.join(validSuite.real, safePrefix(prefix)))
  return initializeOwnedRoot(root, 'case', validSuite.tempBaseReal)
}

function validateSyntheticPath(value, caseRoot, label, { mustExist = true } = {}) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw coded(`${label} must be an absolute synthetic path`, 'C0_UNSAFE_PATH')
  const absolute = path.resolve(value)
  if (!contained(caseRoot.root, absolute) && absolute !== caseRoot.root) throw coded(`${label} is lexically outside the synthetic case`, 'C0_UNSAFE_PATH')
  let existing = absolute
  while (!fs.existsSync(existing)) {
    if (mustExist) throw coded(`${label} does not exist`, 'C0_UNSAFE_PATH')
    const parent = path.dirname(existing)
    if (parent === existing) throw coded(`${label} has no existing ancestor`, 'C0_UNSAFE_PATH')
    existing = parent
  }
  const entry = fs.lstatSync(existing)
  if (entry.isSymbolicLink()) throw coded(`${label} is or descends from a link`, 'C0_UNSAFE_PATH')
  const realExisting = fs.realpathSync.native(existing)
  const physical = path.resolve(realExisting, path.relative(existing, absolute))
  if (!contained(caseRoot.real, physical) && physical !== caseRoot.real) throw coded(`${label} escapes the synthetic case`, 'C0_UNSAFE_PATH')
  return absolute
}

export function admitChild({ suite, caseRoot, cwd, dataRoot, env = {} }) {
  const validSuite = validateOwnership(suite)
  const validCase = validateOwnership(caseRoot)
  if (!contained(validSuite.real, validCase.real)) throw coded('Case root is outside the owned suite', 'C0_UNSAFE_PATH')
  validateSyntheticPath(cwd, validCase, 'cwd')
  if (dataRoot !== undefined) validateSyntheticPath(dataRoot, validCase, 'data root')
  for (const [key, value] of Object.entries(env)) {
    if (/^NEXTSTEP_DATA_ROOT$/i.test(key)) validateSyntheticPath(value, validCase, 'environment data root')
    if (/^NEXTSTEP_STATE_ROOT$/i.test(key)) validateSyntheticPath(value, validCase, 'environment state root', { mustExist: false })
  }
  return true
}

export function safeTeardown(target, suite) {
  const validSuite = validateOwnership(suite)
  const validTarget = validateOwnership(target)
  if (!contained(validSuite.real, validTarget.real)) throw coded('Teardown target must be a strict suite descendant', 'C0_UNSAFE_TEARDOWN')
  fs.rmSync(validTarget.real, { recursive: true, force: false })
}

export function cleanupSuiteRoot(suite) {
  const valid = validateOwnership(suite)
  if (!contained(valid.tempBaseReal, valid.real)) throw coded('Suite root must remain inside the captured temporary directory', 'C0_UNSAFE_TEARDOWN')
  fs.rmSync(valid.real, { recursive: true, force: false })
}

export function cleanEnvironment(source = process.env, extra = {}) {
  const extraKeys = Object.keys(extra).map(key => key.toUpperCase())
  const env = {}
  for (const [key, value] of Object.entries(source)) {
    if (/^NEXTSTEP_/i.test(key) || key.toUpperCase() === 'PATH' || extraKeys.includes(key.toUpperCase())) continue
    env[key] = value
  }
  return { ...env, ...extra }
}

function checkedSpawn(command, args, options) {
  admitChild(options)
  return spawnSync(command, args, {
    cwd: options.cwd, env: options.env, encoding: 'utf8', shell: false,
    timeout: 10_000, maxBuffer: 1024 * 1024
  })
}

export function productChild(argv, options) {
  const rootIndexes = argv.flatMap((value, index) => value === '--data-root' ? [index] : [])
  if (rootIndexes.length > 1) throw coded('Ambiguous data root operands', 'C0_UNSAFE_PATH')
  const argumentRoot = rootIndexes.length ? argv[rootIndexes[0] + 1] : undefined
  if (rootIndexes.length && (typeof argumentRoot !== 'string' || !path.isAbsolute(argumentRoot))) throw coded('Invalid data root operand', 'C0_UNSAFE_PATH')
  if (options.dataRoot !== undefined && options.dataRoot !== argumentRoot) throw coded('Data root metadata differs from invocation', 'C0_UNSAFE_PATH')
  const result = checkedSpawn(process.execPath, [candidateBin, ...argv], { ...options, dataRoot: argumentRoot })
  return { exitCode: result.status, stdout: parseJson(result.stdout), stderr: parseJson(result.stderr), spawnError: result.error?.code || null }
}

function resultSummary(result) {
  if (result.stdout) return {
    interface: result.stdout.interface, version: result.stdout.version,
    value: result.stdout.value ? { id: result.stdout.value.id, name: result.stdout.value.name } : undefined
  }
  return { errorCode: result.stderr?.error?.code || result.spawnError || null }
}

function labelFor(value, roots) {
  for (const [label, root] of Object.entries(roots)) if (value && path.resolve(value) === path.resolve(root)) return label
  return value ? '<redacted-path>' : null
}
function sanitizeArg(value, roots) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) return value
  return labelFor(value, roots)
}

function resolveProbe({ suite, caseRoot, cwd, env, dataRoot, roots }) {
  const probe = "const {resolvePaths}=await import(process.argv[1]);const input=JSON.parse(process.argv[2]);try{console.log(JSON.stringify({ok:true,vaultRoot:resolvePaths(input).vaultRoot}))}catch(error){console.log(JSON.stringify({ok:false,code:error.code||'NEXTSTEP_FAILED'}))}"
  const input = { cwd, ...(dataRoot ? { dataRoot } : {}) }
  const result = checkedSpawn(process.execPath, ['--input-type=module', '-e', probe, pathToFileURL(path.join(candidate, 'src', 'config.mjs')).href, JSON.stringify(input)], { suite, caseRoot, cwd, dataRoot, env })
  const output = parseJson(result.stdout)
  return output?.ok ? { ok: true, vaultRoot: labelFor(output.vaultRoot, roots) } : { ok: false, code: output?.code || result.error?.code || 'PROBE_FAILED' }
}

function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value)}\n`) }
function makeFixture(parent, directoryName, companyName) {
  const root = path.join(parent, directoryName)
  fs.mkdirSync(path.join(root, 'Master'), { recursive: true })
  const records = path.join(root, 'Candidatures', 'records')
  fs.mkdirSync(records, { recursive: true })
  const values = Object.fromEntries(requiredRecords.map(key => [key, key === 'companies' ? [{ id: 'company:c0', name: companyName }] : []]))
  for (const key of requiredRecords) writeJson(path.join(records, recordFiles[key]), values[key])
  writeJson(path.join(records, 'manifest.json'), { schema_version: 4, model: 'nextstep-opportunity-graph', counts: Object.fromEntries(requiredRecords.map(key => [key, values[key].length])) })
  return root
}

function treeEntries(root, prefix = '') {
  const entries = []
  for (const item of fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = path.join(prefix, item.name)
    if (item.isSymbolicLink()) entries.push([relative.split(path.sep).join('/'), 'link'])
    else if (item.isDirectory()) {
      entries.push([relative.split(path.sep).join('/'), 'directory'])
      entries.push(...treeEntries(root, relative))
    }
    else if (item.isFile()) entries.push([relative.split(path.sep).join('/'), hashFile(path.join(root, relative))])
  }
  return entries
}
export function treeHash(root) { return sha256(JSON.stringify(treeEntries(root))) }
function markerFreeAncestors(start) {
  let current = path.resolve(start)
  while (true) {
    const hasMarkers = fs.existsSync(path.join(current, 'Master')) && fs.existsSync(path.join(current, 'Candidatures', 'records', 'manifest.json'))
    if (hasMarkers) return false
    const parent = path.dirname(current)
    if (parent === current) return true
    current = parent
  }
}

function evidence(caseId, status, details = {}) { return { caseId, status, oracleSource: details.oracleSource || 'observed_candidate', ...details } }
function safeFailure(caseId, error) { return evidence(caseId, 'failed', { oracleSource: 'contract', result: { errorCode: error?.code || 'C0_UNEXPECTED' }, oracle: 'bounded harness execution' }) }

function withCase(suite, id, work) {
  let ownedCase
  try {
    ownedCase = createOwnedCaseRoot(suite, `${id.toLowerCase()}-`)
    const fixtureA = makeFixture(ownedCase.real, 'fixtureA', 'fixture-A')
    const fixtureB = makeFixture(ownedCase.real, 'fixtureB', 'fixture-B')
    const noRoot = path.join(ownedCase.real, 'no-root')
    fs.mkdirSync(noRoot)
    const fixtureHashes = { fixtureA: treeHash(fixtureA), fixtureB: treeHash(fixtureB) }
    const result = work({ suite, ownedCase, fixtureA, fixtureB, noRoot, roots: { fixtureA, fixtureB } })
    return { ...result, fixtureHashes }
  } catch (error) {
    return safeFailure(id, error)
  } finally {
    if (ownedCase && fs.existsSync(ownedCase.root)) safeTeardown(ownedCase, suite)
  }
}

function cliCase(suite, id, setup, verify) {
  return withCase(suite, id, ctx => {
    const spec = setup(ctx)
    const before = treeHash(ctx.ownedCase.real)
    const noRootSafe = spec.noRoot ? markerFreeAncestors(spec.cwd) : undefined
    if (noRootSafe === false) throw coded('No-root cwd has a vault-marked ancestor', 'C0_UNSAFE_PATH')
    const options = { suite, caseRoot: ctx.ownedCase, cwd: spec.cwd, dataRoot: spec.dataRoot, env: spec.env }
    const result = productChild(spec.argv, options)
    const probe = spec.probe ? resolveProbe({ ...options, roots: ctx.roots }) : null
    const after = treeHash(ctx.ownedCase.real)
    const unchanged = before === after
    const passed = unchanged && noRootSafe !== false && verify(result, probe, ctx)
    return evidence(id, passed ? 'passed' : 'failed', {
      argv: spec.argv.map(value => sanitizeArg(value, ctx.roots)), env: spec.envLabel || {},
      exitCode: result.exitCode, result: resultSummary(result), ...(probe ? { resolution: probe } : {}),
      readOnlyUnchanged: unchanged, ...(spec.noRoot ? { noRootAncestorsMarkerFree: noRootSafe } : {}), oracle: spec.oracle
    })
  })
}

function allowedCandidateFiles() {
  const files = ['package.json', 'bin/nextstep.mjs']
  for (const name of fs.readdirSync(path.join(candidate, 'src'), { withFileTypes: true })) if (name.isFile() && name.name.endsWith('.mjs')) files.push(`src/${name.name}`)
  const skillRoot = path.join(candidate, 'skills')
  for (const [relative, kind] of treeEntries(skillRoot)) {
    if (kind === 'link') throw coded('Candidate allowlist contains a link', 'C0_UNSAFE_CANDIDATE')
    if (kind === 'directory') continue
    files.push(`skills/${relative}`)
  }
  return files.sort()
}

export function candidateFingerprint() {
  const hashes = Object.fromEntries(allowedCandidateFiles().map(relative => [relative, hashFile(path.join(candidate, relative))]))
  const fingerprint = sha256(Object.entries(hashes).map(([name, hash]) => `${name}\0${hash}\n`).join(''))
  return { fingerprint, hashes }
}

function sourceInventory() {
  const all = candidateFingerprint().hashes
  return {
    skills: Object.entries(all).filter(([name]) => /^skills\/[^/]+\/SKILL\.md$/.test(name)).map(([name, hash]) => ({ path: name, sha256: hash })),
    references: Object.entries(all).filter(([name]) => name.startsWith('skills/references/')).map(([name, hash]) => ({ path: name, sha256: hash }))
  }
}

export function runBaseline() {
  const suite = createOwnedSuiteRoot()
  const results = []
  try {
    const initialCandidateState = candidateFingerprint()
    results.push(cliCase(suite, 'C0-B01', ctx => ({ argv: ['capabilities', '--json'], cwd: ctx.noRoot, env: cleanEnvironment(), noRoot: true, oracle: 'exit 0; local-cli; version 2.1.0' }), r => r.exitCode === 0 && r.stdout?.interface === 'local-cli' && r.stdout?.version === '2.1.0'))
    results.push(cliCase(suite, 'C0-B02', ctx => ({ argv: ['get', '--id', 'company:c0'], cwd: ctx.fixtureA, env: cleanEnvironment(), probe: true, oracle: 'fixtureA discovery' }), (r, p) => r.exitCode === 0 && r.stdout?.value?.id === 'company:c0' && r.stdout?.value?.name === 'fixture-A' && p?.vaultRoot === 'fixtureA'))
    results.push(cliCase(suite, 'C0-B03', ctx => { const cwd = path.join(ctx.fixtureA, 'work', 'nested'); fs.mkdirSync(cwd, { recursive: true }); return { argv: ['get', '--id', 'company:c0'], cwd, env: cleanEnvironment(), probe: true, oracle: 'subdirectory discovery' } }, (r, p) => r.exitCode === 0 && r.stdout?.value?.name === 'fixture-A' && p?.vaultRoot === 'fixtureA'))
    results.push(cliCase(suite, 'C0-B04', ctx => ({ argv: ['get', '--id', 'company:c0', '--data-root', ctx.fixtureA], cwd: ctx.fixtureB, dataRoot: ctx.fixtureA, env: cleanEnvironment(process.env, { NEXTSTEP_DATA_ROOT: ctx.fixtureB }), envLabel: { NEXTSTEP_DATA_ROOT: 'fixtureB' }, probe: true, oracle: 'argument wins environment and ancestor' }), (r, p) => r.exitCode === 0 && r.stdout?.value?.name === 'fixture-A' && p?.vaultRoot === 'fixtureA'))
    results.push(cliCase(suite, 'C0-B05', ctx => ({ argv: ['get', '--id', 'company:c0'], cwd: ctx.fixtureB, env: cleanEnvironment(process.env, { NEXTSTEP_DATA_ROOT: ctx.fixtureA }), envLabel: { NEXTSTEP_DATA_ROOT: 'fixtureA' }, probe: true, oracle: 'removed NEXTSTEP_DATA_ROOT is ignored; ancestor wins' }), (r, p) => r.exitCode === 0 && r.stdout?.value?.name === 'fixture-B' && p?.vaultRoot === 'fixtureB'))
    results.push(cliCase(suite, 'C0-B06', ctx => ({ argv: ['get', '--id', 'company:c0'], cwd: ctx.noRoot, env: cleanEnvironment(), probe: true, noRoot: true, oracle: 'DATA_ROOT_REQUIRED in CLI and resolver' }), (r, p) => r.exitCode === 1 && r.stderr?.error?.code === 'DATA_ROOT_REQUIRED' && p?.ok === false && p.code === 'DATA_ROOT_REQUIRED'))
    results.push(cliCase(suite, 'C0-B07', ctx => ({ argv: ['no-such-command'], cwd: ctx.noRoot, env: cleanEnvironment(), noRoot: true, oracle: 'USAGE exit 64' }), r => r.exitCode === 64 && r.stderr?.error?.code === 'USAGE'))
    results.push(withCase(suite, 'C0-B08', ctx => {
      const emptyPath = path.join(ctx.ownedCase.real, 'empty-path'); fs.mkdirSync(emptyPath)
      const before = treeHash(ctx.ownedCase.real)
      if (!markerFreeAncestors(ctx.noRoot)) throw coded('No-root cwd has a vault-marked ancestor', 'C0_UNSAFE_PATH')
      const missing = checkedSpawn('nextstep', ['capabilities', '--json'], { suite, caseRoot: ctx.ownedCase, cwd: ctx.noRoot, env: cleanEnvironment(process.env, { PATH: emptyPath }) })
      const absolute = productChild(['capabilities', '--json'], { suite, caseRoot: ctx.ownedCase, cwd: ctx.noRoot, env: cleanEnvironment() })
      const unchanged = before === treeHash(ctx.ownedCase.real)
      const passed = missing.error?.code === 'ENOENT' && absolute.exitCode === 0 && unchanged
      return evidence('C0-B08', passed ? 'passed' : 'failed', { probe: 'named PATH executable versus absolute candidate bin', observations: { named: missing.error?.code || missing.status, absoluteExitCode: absolute.exitCode }, readOnlyUnchanged: unchanged, oracle: 'ENOENT and absolute exit 0', limitation: 'tooling availability only' })
    }))
    results.push(withCase(suite, 'C0-B09', () => evidence('C0-B09', 'passed', { oracleSource: 'contract', inventory: sourceInventory(), hostDiscovery: 'not_run', oracle: 'checked-in source only; no installation claim' })))
    results.push(withCase(suite, 'C0-B10', ctx => {
      const external = createOwnedSuiteRoot('nextstep-c0-external-')
      try {
        const externalSentinel = path.join(external.real, 'external-sentinel.txt')
        const canary = path.join(external.real, 'execution-canary.txt')
        fs.writeFileSync(externalSentinel, 'preserve\n')
        const link = path.join(ctx.ownedCase.real, 'escape-junction')
        fs.symlinkSync(external.real, link, 'junction')
        const attempts = []
        const productAttempts = []
        for (const dataRoot of [external.real, link]) {
          try {
            productChild(['get', '--id', 'company:c0', '--data-root', dataRoot], { suite, caseRoot: ctx.ownedCase, cwd: ctx.noRoot, env: cleanEnvironment() })
            productAttempts.push('unexpected-execution')
          } catch (error) { productAttempts.push(error.code || 'C0_UNEXPECTED') }
          try {
            checkedSpawn(process.execPath, ['-e', 'require("node:fs").writeFileSync(process.argv[1],"ran")', canary], { suite, caseRoot: ctx.ownedCase, cwd: ctx.noRoot, dataRoot, env: cleanEnvironment() })
            attempts.push('unexpected-execution')
          } catch (error) { attempts.push(error.code || 'C0_UNEXPECTED') }
        }
        let teardownCode
        try { safeTeardown(external, suite); teardownCode = 'unexpected-delete' } catch (error) { teardownCode = error.code || 'C0_UNEXPECTED' }
        const preserved = fs.readFileSync(externalSentinel, 'utf8') === 'preserve\n'
        const canaryAbsent = !fs.existsSync(canary)
        const passed = attempts.length === 2 && attempts.every(code => code === 'C0_UNSAFE_PATH') && productAttempts.length === 2 && productAttempts.every(code => code === 'C0_UNSAFE_PATH') && teardownCode === 'C0_UNSAFE_TEARDOWN' && preserved && canaryAbsent
        return evidence('C0-B10', passed ? 'passed' : 'failed', { oracleSource: 'contract', guardRejections: { directExternal: attempts[0], junctionEscape: attempts[1], externalTeardown: teardownCode }, productGuardRejections: { directExternal: productAttempts[0], junctionEscape: productAttempts[1] }, externalSentinelPreserved: preserved, executionCanaryAbsent: canaryAbsent, oracle: 'external roots rejected before execution or teardown' })
      } finally { if (fs.existsSync(external.root)) cleanupSuiteRoot(external) }
    }))
    const candidateState = candidateFingerprint()
    const candidateUnchanged = candidateState.fingerprint === initialCandidateState.fingerprint
    const report = {
      schemaVersion: 1, status: results.every(item => item.status === 'passed') ? 'passed' : 'failed',
      baseline: { referenceCommit: baselineCommit, referenceObservedBinSha256: expectedBinHash, binSha256: candidateState.hashes['bin/nextstep.mjs'], candidateFingerprint: candidateState.fingerprint, candidateUnchanged, candidateFiles: candidateState.hashes },
      environment: { os: `${process.platform} ${os.release()}`, node: process.version, productVersion: '2.1.0' }, cases: results
    }
    if (!candidateUnchanged) report.status = 'failed'
    return report
  } catch (error) {
    return { schemaVersion: 1, status: 'failed', baseline: { referenceCommit: baselineCommit, referenceObservedBinSha256: expectedBinHash }, error: { code: error?.code || 'C0_UNEXPECTED' }, cases: results }
  } finally {
    if (fs.existsSync(suite.root)) cleanupSuiteRoot(suite)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let report
  try {
    report = process.argv.length === 2
      ? runBaseline()
      : { schemaVersion: 1, status: 'failed', error: { code: 'C0_ARGUMENTS_FORBIDDEN' }, cases: [] }
  } catch (error) {
    report = { schemaVersion: 1, status: 'failed', error: { code: error?.code?.startsWith('C0_') ? error.code : 'C0_UNEXPECTED' }, cases: [] }
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  process.exitCode = report.status === 'passed' ? 0 : 1
}

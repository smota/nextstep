import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { discoverHoloself, holoselfContext, runHoloself } from '../src/holoself.mjs'
import { resolveSelf } from '../src/candidate-profile.mjs'

test('global package discovery handles Windows-style Path casing and quoted search directories', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-holoself-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const entry = path.join(dir, 'node_modules', 'holoself', 'bin', 'holoself.mjs')
  fs.mkdirSync(path.dirname(entry), { recursive: true }); fs.writeFileSync(entry, 'console.log("ok")')
  const env = { Path: `"${dir}"` }
  assert.deepEqual(discoverHoloself(env).prefix, [fs.realpathSync.native(entry)])
  assert.equal(runHoloself([], { env }).stdout.trim(), 'ok')
})
test('missing installation reports actionable discovery diagnostics', () => {
  assert.throws(() => discoverHoloself({}), e => e.code === 'HOLOSELF_UNAVAILABLE' && e.details.phase === 'discovery' && e.details.nextAction.includes('PATH'))
})
test('timeout is distinct from discovery failure', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-holoself-timeout-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const entry = path.join(dir, 'wait.mjs'); fs.writeFileSync(entry, 'setTimeout(() => {}, 10000)')
  assert.throws(() => runHoloself([], { env: { HOLOSELF_EXECUTABLE: entry }, timeout: 100 }), e => e.code === 'HOLOSELF_TIMEOUT')
})

test('discovery considers duplicate PATH keys and quoted delimiter characters', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-quoted-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const quoted = path.join(dir, `segment${path.delimiter}with-delimiter`)
  const entry = path.join(quoted, 'node_modules', 'holoself', 'bin', 'holoself.mjs')
  fs.mkdirSync(path.dirname(entry), { recursive: true }); fs.writeFileSync(entry, '')
  assert.deepEqual(discoverHoloself({ PATH: path.join(dir, 'missing'), Path: `"${quoted}"` }).prefix, [fs.realpathSync.native(entry)])
})

test('Holoself resolves the lens without a caller override', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-holoself-argv-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const recordsDir = path.join(dir, 'records')
  fs.mkdirSync(recordsDir, { recursive: true })
  const argvLog = path.join(dir, 'argv.json')
  const script = path.join(dir, 'holoself.mjs')
  const arbitraryLens = 'synthetic-provider-lens'
  const body = `
import fs from 'node:fs'
fs.writeFileSync(${JSON.stringify(argvLog)}, JSON.stringify(process.argv.slice(2)))
process.stdout.write(JSON.stringify({
  lens: ${JSON.stringify(arbitraryLens)},
  validation: { status: 'passed' },
  warnings: [],
  self: {
    documents: [
      { path: 'profile/identity.md', content: 'Synthetic identity text.' },
      { path: 'context/narrative.md', content: 'Synthetic narrative text.' }
    ]
  }
}))
process.exit(0)
`
  fs.writeFileSync(script, `${body.trim()}\n`)
  const originalExecutable = process.env.HOLOSELF_EXECUTABLE
  process.env.HOLOSELF_EXECUTABLE = script
  t.after(() => {
    if (originalExecutable === undefined) delete process.env.HOLOSELF_EXECUTABLE
    else process.env.HOLOSELF_EXECUTABLE = originalExecutable
  })

  const paths = { vaultRoot: dir, recordsDir }

  // 1. holoselfContext: even when stale caller passes lens, child argv does NOT contain --lens
  const contextData = holoselfContext(paths, { task: 'test-task', lens: 'stale-career-override' })
  const childArgv1 = JSON.parse(fs.readFileSync(argvLog, 'utf8'))
  assert.deepEqual(childArgv1, ['context', '--project', dir, '--self-only', '--json', '--task', 'test-task'])
  assert.equal(contextData.lens, arbitraryLens, 'holoselfContext returns Holoself resolved lens')

  // 2. resolveSelf: even when stale caller passes lens, child argv does NOT contain --lens, and arbitrary returned lens survives
  const selfData = resolveSelf(paths, { intent: 'analyze', limits: { selfTotalChars: 1000 }, task: 'another-task', lens: 'stale-resolve-lens' })
  const childArgv2 = JSON.parse(fs.readFileSync(argvLog, 'utf8'))
  assert.deepEqual(childArgv2, ['context', '--project', dir, '--self-only', '--json', '--task', 'another-task'])
  assert.equal(selfData.lens, arbitraryLens, 'arbitrary Holoself-returned lens must survive resolveSelf')
  assert.equal(selfData.source, 'holoself')
})

test('resolveSelf preserves native fallback and error semantics', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-holoself-fallback-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const recordsDir = path.join(dir, 'records')
  fs.mkdirSync(recordsDir, { recursive: true })
  const cardPath = path.join(recordsDir, 'candidate-profile.json')
  const card = { display_name: 'Synthetic Candidate', target_roles: ['Staff Engineer'], positioning: 'Platform leadership', flagship_facts: ['Delivered core platform.'] }
  fs.writeFileSync(cardPath, JSON.stringify(card))

  const paths = { vaultRoot: dir, recordsDir }

  // When Holoself is unavailable and card exists, falls back to native card
  const originalExecutable = process.env.HOLOSELF_EXECUTABLE
  process.env.HOLOSELF_EXECUTABLE = path.join(dir, 'non-existent-executable.exe')
  t.after(() => {
    if (originalExecutable === undefined) delete process.env.HOLOSELF_EXECUTABLE
    else process.env.HOLOSELF_EXECUTABLE = originalExecutable
  })

  const fallback = resolveSelf(paths)
  assert.equal(fallback.source, 'native')
  assert.equal(fallback.displayName, 'Synthetic Candidate')

  // When Holoself fails with non-unavailable error (e.g. exit code 1), error is preserved and does NOT silently fall back to card
  const failingScript = path.join(dir, 'failing-holoself.mjs')
  fs.writeFileSync(failingScript, 'process.exit(1)\n')
  process.env.HOLOSELF_EXECUTABLE = failingScript

  assert.throws(() => resolveSelf(paths), error => error.code === 'HOLOSELF_FAILED')
})

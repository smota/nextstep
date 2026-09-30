import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { discoverHoloself, runHoloself } from '../src/holoself.mjs'

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

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { loadLocalEnv, parseLocalEnv } from './local-env.js'

test('parses comments, quoted values, and valid environment keys', () => {
  assert.deepEqual(parseLocalEnv('# comment\nDATA_ROOT = "C:\\Data Root"\nexport PORT=5175\ninvalid-key=value\n'), { DATA_ROOT: 'C:\\Data Root', PORT: '5175' })
})

test('loads a local file without replacing the process environment', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-env-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const filePath = path.join(root, '.env')
  fs.writeFileSync(filePath, 'NEXTSTEP_DATA_ROOT=C:\\private\nPORT=5175\n')
  const env = { PORT: '6000' }
  assert.deepEqual(loadLocalEnv({ filePath, env }), { NEXTSTEP_DATA_ROOT: 'C:\\private' })
  assert.deepEqual(env, { NEXTSTEP_DATA_ROOT: 'C:\\private', PORT: '6000' })
})

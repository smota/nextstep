import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

// Node 20 on Windows does not expand shell globs. Pass the same explicit
// test files on every supported host, without depending on the shell.
const root = path.resolve(import.meta.dirname, '..')
const files = fs.readdirSync(path.join(root, 'test')).filter(name => name.endsWith('.test.mjs')).sort().map(name => path.join(root, 'test', name))
if (!files.length) throw new Error('No test files found')
const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit', windowsHide: true })
if (result.error) throw result.error
process.exitCode = result.status ?? 1

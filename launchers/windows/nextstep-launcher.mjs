#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

try {
  const launcherDir = fs.realpathSync.native(path.dirname(fileURLToPath(import.meta.url)))
  const productRoot = path.resolve(launcherDir, '..', '..')
  const packageFile = path.join(productRoot, 'package.json')
  const entrypoint = path.join(productRoot, 'bin', 'nextstep.mjs')
  const manifest = JSON.parse(fs.readFileSync(packageFile, 'utf8'))
  if (manifest.name !== 'nextstep' || !fs.statSync(entrypoint).isFile()) throw new Error('linked product root is invalid')
  const result = spawnSync(process.execPath, [entrypoint, ...process.argv.slice(2)], { cwd: process.cwd(), env: process.env, stdio: 'inherit' })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} catch (error) {
  process.stderr.write(`Nextstep launcher failed: ${error.message}\n`)
  process.exitCode = 1
}

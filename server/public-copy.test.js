import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

async function sourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? sourceFiles(path.join(dir, entry.name)) : /\.(jsx|js)$/.test(entry.name) ? [path.join(dir, entry.name)] : []))
  return nested.flat()
}

test('public UI does not expose deprecated readiness-blocked or affiliation copy', async () => {
  const files = await sourceFiles(path.resolve('client/src'))
  const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n')
  assert.doesNotMatch(source, /Readiness blocked/)
  assert.doesNotMatch(source, /Part of Move the Needle/)
  assert.match(source, /Sponsored by Move the Needle/)
})

test('tracked product source does not contain personal identity hardcodes', async () => {
  const files = [...await sourceFiles(path.resolve('client/src')), ...await sourceFiles(path.resolve('server'))]
  const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n')
  const givenName = ['Samu', 'el'].join('')
  const familyName = ['Mo', 'ta'].join('')
  const personalBaseline = ['Guedes', familyName, 'Baseline', 'CV'].join('_')
  assert.doesNotMatch(source, new RegExp(`${givenName}\\s+${familyName}`, 'i'))
  assert.doesNotMatch(source, new RegExp(`${givenName}\\b`, 'i'))
  assert.doesNotMatch(source, new RegExp(personalBaseline, 'i'))
})

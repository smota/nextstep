import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import test from 'node:test'
import { readMasterDocuments } from '../src/master-files.mjs'
import { main } from '../src/cli.mjs'

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-master-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'Master'))
  fs.mkdirSync(path.join(root, 'Candidatures', 'records'), { recursive: true })
  fs.writeFileSync(path.join(root, 'Candidatures', 'records', 'manifest.json'), '{}')
  return root
}

test('catalog/query read current local guides with provenance, exclusions and no state writes', async t => {
  const root = fixture(t)
  const guide = path.join(root, 'Master', 'interview.md')
  fs.writeFileSync(guide, '# Interview guide\nPrepare questions about operating models.\n')
  fs.mkdirSync(path.join(root, 'Master', 'Archive'))
  fs.writeFileSync(path.join(root, 'Master', 'Archive', 'old.md'), 'Excluded secret needle')
  fs.writeFileSync(path.join(root, 'Master', '.hidden.md'), 'hidden')
  fs.writeFileSync(path.join(root, 'Master', 'binary.pdf'), 'binary')
  const before = fs.readFileSync(guide)
  let output = ''
  const io = { out: { write: text => { output += text } }, err: { write: text => { output += text } } }
  assert.equal(await main(['master', 'catalog', '--data-root', root, '--json'], io), 0)
  const catalog = JSON.parse(output)
  assert.equal(catalog.count, 1)
  assert.equal(catalog.documents[0].path, 'Master/interview.md')
  assert.equal(catalog.documents[0].sha256, crypto.createHash('sha256').update(before).digest('hex'))
  assert.equal('content' in catalog.documents[0], false)
  assert.equal(catalog.excluded.length, 3)
  output = ''
  assert.equal(await main(['master', 'query', '--data-root', root, '--query', 'operating', '--max-chars', '20', '--json'], io), 0)
  assert.equal(JSON.parse(output).totalMatches, 1)
  assert.ok(JSON.parse(output).results[0].excerpt.length <= 20)
  fs.writeFileSync(guide, '# Interview guide\nUpdated career guide.')
  output = ''
  assert.equal(await main(['master', 'query', '--data-root', root, '--query', 'operating', '--json'], io), 0)
  assert.equal(JSON.parse(output).totalMatches, 0)
  assert.equal(fs.existsSync(path.join(root, '.nextstep')), false)
  assert.equal(fs.existsSync(path.join(root, 'Candidatures', 'indexes')), false)
})

test('adapter never follows nested junctions and rejects a linked Master root', t => {
  const root = fixture(t), outside = fixture(t)
  fs.writeFileSync(path.join(outside, 'Master', 'outside.md'), 'never read')
  fs.symlinkSync(path.join(outside, 'Master'), path.join(root, 'Master', 'linked'), 'junction')
  const result = readMasterDocuments({ vaultRoot: root })
  assert.equal(result.documents.length, 0)
  assert.deepEqual(result.excluded, [{ path: 'Master/linked', reason: 'link' }])
  const other = path.join(root, 'other')
  fs.mkdirSync(other)
  fs.symlinkSync(path.join(outside, 'Master'), path.join(other, 'Master'), 'junction')
  assert.throws(() => readMasterDocuments({ vaultRoot: other }), { code: 'UNSAFE_PATH' })
})

test('adapter rejects invalid UTF-8 and oversized files instead of silently dropping evidence', t => {
  const root = fixture(t), file = path.join(root, 'Master', 'guide.md')
  fs.writeFileSync(file, Buffer.from([0xc3, 0x28]))
  assert.throws(() => readMasterDocuments({ vaultRoot: root }), { code: 'MASTER_ENCODING' })
  fs.writeFileSync(file, Buffer.alloc(2 * 1024 * 1024 + 1))
  assert.throws(() => readMasterDocuments({ vaultRoot: root }), { code: 'MASTER_LIMIT' })
})

test('adapter rejects a file swapped between path inspection and opening before reading bytes', t => {
  const root = fixture(t), outside = fixture(t)
  const file = path.join(root, 'Master', 'guide.md')
  const external = path.join(outside, 'Master', 'private.md')
  fs.writeFileSync(file, 'inside')
  fs.writeFileSync(external, 'secret')
  const originalOpen = fs.openSync, originalRead = fs.readSync
  let readAttempted = false
  fs.openSync = (candidate, ...args) => originalOpen(candidate === file ? external : candidate, ...args)
  fs.readSync = (...args) => { readAttempted = true; return originalRead(...args) }
  try {
    assert.throws(() => readMasterDocuments({ vaultRoot: root }), { code: 'MASTER_CHANGED' })
    assert.equal(readAttempted, false)
  } finally { fs.openSync = originalOpen; fs.readSync = originalRead }
})

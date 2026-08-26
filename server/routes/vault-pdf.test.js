import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createPdfHandler } from './vault.js'

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-route-')), applicationsRoot = path.join(root, 'active'), archiveRoot = path.join(root, 'archive'), folder = path.join(applicationsRoot, 'safe-role')
  fs.mkdirSync(folder, { recursive: true }); fs.mkdirSync(archiveRoot)
  fs.writeFileSync(path.join(folder, 'cv.md'), '# Current\n\nCurrent body with enough content to render.')
  fs.writeFileSync(path.join(folder, 'cv-follow-up-20260102T030405Z.md'), '# Selected version\n\nVersion body.')
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return { root, applicationsRoot, archiveRoot }
}
function response() { return { statusCode: 200, headers: {}, body: null, status(code) { this.statusCode = code; return this }, set(headers) { Object.assign(this.headers, headers); return this }, send(body) { this.body = body; return this }, json(body) { this.body = body; return this } } }

test('PDF endpoint handler selects versions, emits safe attachment headers, and never mutates vault', async t => {
  const f = fixture(t), before = fs.readdirSync(path.join(f.applicationsRoot, 'safe-role')).map(name => [name, fs.readFileSync(path.join(f.applicationsRoot, 'safe-role', name), 'utf8')])
  const res = response()
  await createPdfHandler(f)({ params: { scope: 'active', slug: 'safe-role', artifact: 'cv' }, query: { version: 'cv-follow-up-20260102T030405Z', paper: 'LETTER', style: 'compact' } }, res)
  assert.equal(res.statusCode, 200); assert.equal(res.headers['Content-Type'], 'application/pdf'); assert.match(res.headers['Content-Disposition'], /^attachment; filename="[A-Za-z0-9._-]+\.pdf"$/); assert.equal(res.body.subarray(0, 5).toString('ascii'), '%PDF-')
  assert.deepEqual(fs.readdirSync(path.join(f.applicationsRoot, 'safe-role')).map(name => [name, fs.readFileSync(path.join(f.applicationsRoot, 'safe-role', name), 'utf8')]), before)
})

test('PDF endpoint handler rejects malformed query and unsafe references', async t => {
  const f = fixture(t), handler = createPdfHandler(f)
  for (const request of [
    { params: { scope: 'active', slug: 'safe-role', artifact: 'cv' }, query: { paper: 'LEGAL' } },
    { params: { scope: 'active', slug: 'safe-role', artifact: 'cv' }, query: { style: 'professional', extra: 'x' } },
    { params: { scope: 'active', slug: '../safe-role', artifact: 'cv' }, query: {} },
    { params: { scope: 'active', slug: 'safe-role', artifact: 'cv' }, query: { version: '../secret' } },
  ]) { const res = response(); await handler(request, res); assert.equal(res.statusCode, 400) }
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { selectPersonalContext } from '../src/context-selection.mjs'

const paths = ['profile/identity.md', 'profile/preferences.md', 'profile/voice.md', 'context/career.md', 'context/claims.md', 'context/positioning.md', 'context/evidence.md', 'context/story-bank.md', 'context/leadership.md']
const data = { self: { documents: paths.map(path => ({ path, content: `${path}\n${'e'.repeat(9000)}`, sourceId: path })) } }
for (const [budget, max] of [['small', 1200], ['standard', 3600], ['deep', 48000]]) test(`${budget} covers every relevant category within its text budget`, () => {
  const result = selectPersonalContext(data, 'application', { selfTotalChars: max })
  assert.equal(result.documents.length, 9)
  assert.equal(result.documents.reduce((n, d) => n + d.content.length, 0), max)
  assert.ok(result.documents.every(d => d.truncated && d.sourceId === d.path))
  assert.ok(result.coverage.every(c => c.status === 'truncated' && c.nextAction))
})
test('missing source, omitted excerpt and upstream truncation remain distinguishable', () => {
  const result = selectPersonalContext({ self: { documents: [{ path: paths[0], content: 'identity', truncated: true }, { path: paths[1], content: 'preference' }] } }, 'drafting', { selfTotalChars: 128 })
  assert.equal(result.coverage.find(c => c.path === paths[0]).status, 'truncated')
  assert.equal(result.coverage.find(c => c.path === paths[1]).status, 'omitted_by_budget')
  assert.equal(result.coverage.find(c => c.path === paths[2]).status, 'missing_at_source')
})
test('short sources release budget to longer evidence without changing source text', () => {
  const result = selectPersonalContext({ self: { documents: [{ path: paths[0], content: 'ID' }, { path: paths[3], content: 'x'.repeat(1000) }] } }, 'analyze', { selfTotalChars: 300 })
  assert.equal(result.documents.find(d => d.path === paths[3]).content.length, 298)
})

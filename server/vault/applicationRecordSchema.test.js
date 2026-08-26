import test from 'node:test'
import assert from 'node:assert/strict'
import { canonicalizeApplicationMetadata, serializeApplicationIndex } from './applicationRecordSchema.js'

test('canonical metadata preserves evidence and represents unknown facts as null', () => {
  const record = canonicalizeApplicationMetadata({ company:'Acme', role:'Lead', status:'identified', evidence_score:0.7 })
  assert.equal(record.schema_version, 2)
  assert.equal(record.type, 'application')
  assert.equal(record.priority, 'none')
  assert.equal(record.created, null)
  assert.equal(record.updated, null)
  assert.equal(record.country, null)
  assert.equal(record.cv, null)
  assert.deepEqual(record.tags, ['application'])
  assert.equal(record.evidence_score, 0.7)
})

test('canonical metadata rejects invalid identity, lifecycle, type and revision with field errors', () => {
  for (const [field, patch] of [
    ['company',{company:''}], ['role',{role:''}], ['status',{status:'draft'}],
    ['type',{type:'note'}], ['application_revision',{application_revision:-1}],
  ]) assert.throws(() => canonicalizeApplicationMetadata({company:'Acme',role:'Lead',status:'identified',...patch}), error => error.field === field && error.message.includes(`"${field}"`))
})

test('local index serialization preserves the markdown body byte for byte', () => {
  const body = '# Rich body\r\n\r\n> authored prose  \r\n- [[link|Label]]\r\n'
  const serialized = serializeApplicationIndex({}, body, {application:'acme-lead',status:'identified',scope:'active',date:'2026-08-05'})
  assert.equal(serialized.slice(serialized.indexOf('---\n', 4) + 4), body)
  assert.match(serialized, /^---\nschema_version: 2\ntype: application-index\napplication: acme-lead\nstatus: identified\nstorage_scope: active\nupdated: '2026-08-05'\n---\n/)
})

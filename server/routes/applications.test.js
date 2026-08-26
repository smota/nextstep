import test from 'node:test'
import assert from 'node:assert/strict'
import { findApplication } from './applications.js'

test('scoped lookup disambiguates duplicate active and archive slugs while legacy lookup remains compatible', () => {
  const active = { slug: 'same-role', archived: false }
  const archive = { slug: 'same-role', archived: true }
  assert.equal(findApplication([active, archive], 'same-role', 'active'), active)
  assert.equal(findApplication([active, archive], 'same-role', 'archive'), archive)
  assert.equal(findApplication([active, archive], 'same-role'), active)
})

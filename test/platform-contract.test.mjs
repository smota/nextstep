import assert from 'node:assert/strict'
import test from 'node:test'
import { integrationPlan } from '../src/integration.mjs'

test('linked installation rejects unsupported platforms explicitly', { skip: process.platform === 'win32' }, () => {
  assert.throws(() => integrationPlan({}), { code: 'INTEGRATION_UNSUPPORTED' })
})

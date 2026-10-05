import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { loadModel, validateModel, WORK_MODELS, PAY_PERIODS } from '../src/model.mjs'
import { upsertEntity } from '../src/commands.mjs'
import { describeCommand } from '../src/command-catalog.mjs'
import { renderIndexes } from '../src/storage.mjs'


function tempVault() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-opp-test-'))
  const recordsDir = path.join(root, 'records')
  fs.mkdirSync(recordsDir, { recursive: true })
  
  const manifest = { schema_version: 4, model: 'nextstep-opportunity-graph', counts: { companies: 1, opportunities: 1, applicationAttempts: 0, people: 0, interactions: 0, artifacts: 0, strategies: 0, experiments: 0 } }
  const companies = [{ id: 'company:acme', name: 'Acme Corp', opportunity_ids: ['opportunity:role-1'], application_attempt_ids: [], person_ids: [], interaction_ids: [], artifact_ids: [] }]
  const opportunities = [{ id: 'opportunity:role-1', company_id: 'company:acme', title: 'Staff Engineer', posting_state: 'active', pursuit_status: 'identified', storage_scope: 'active', record_state: 'complete', created: '2026-10-05', updated: '2026-10-05', outcome: null, provenance: ['test'], application_attempt_ids: [], person_ids: [], interaction_ids: [], artifact_ids: [] }]
  const empty = []

  fs.writeFileSync(path.join(recordsDir, 'manifest.json'), JSON.stringify(manifest))
  fs.writeFileSync(path.join(recordsDir, 'companies.json'), JSON.stringify(companies))
  fs.writeFileSync(path.join(recordsDir, 'opportunities.json'), JSON.stringify(opportunities))
  fs.writeFileSync(path.join(recordsDir, 'application-attempts.json'), JSON.stringify(empty))
  fs.writeFileSync(path.join(recordsDir, 'people.json'), JSON.stringify(empty))
  fs.writeFileSync(path.join(recordsDir, 'interactions.json'), JSON.stringify(empty))
  fs.writeFileSync(path.join(recordsDir, 'artifacts.json'), JSON.stringify(empty))
  fs.writeFileSync(path.join(recordsDir, 'strategies.json'), JSON.stringify(empty))
  fs.writeFileSync(path.join(recordsDir, 'experiments.json'), JSON.stringify(empty))

  return {
    vaultRoot: root,
    recordsDir,
    indexesDir: path.join(root, 'indexes'),
    candidaturesDir: root,
    ledgerPath: path.join(root, 'ledger.json'),
    auditPath: path.join(root, 'audit.jsonl'),
    journalDir: path.join(root, 'journal'),
    lockPath: path.join(root, 'lock.json'),
    vaultState: 'ready'
  }

}

test('Opportunity structured fields: exports constants', () => {
  assert.deepEqual([...WORK_MODELS], ['onsite', 'hybrid', 'remote', 'unknown'])
  assert.deepEqual([...PAY_PERIODS], ['hourly', 'monthly', 'yearly', 'total', 'unknown'])
})

test('Opportunity structured fields: model validation accepts valid fields and legacy defaults', () => {
  const paths = tempVault()
  const model = loadModel(paths)

  // Legacy opportunity without structured fields is valid
  const validation = validateModel(model)
  assert.equal(validation.valid, true)

  // Opportunity with full structured fields is valid
  model.opportunities[0].work_model = 'hybrid'
  model.opportunities[0].location = { country: ['US'], city: 'San Francisco', raw: 'San Francisco, CA (Hybrid)' }
  model.opportunities[0].pay = { currency: 'USD', min: 150000, max: 200000, period: 'yearly', ote: true }

  const fullValidation = validateModel(model)
  assert.equal(fullValidation.valid, true)
})

test('Opportunity structured fields: model validation rejects invalid fields', () => {
  const paths = tempVault()
  const model = loadModel(paths)

  model.opportunities[0].work_model = 'invalid_model'
  assert.throws(() => validateModel(model), error => error.code === 'MODEL_INVALID')

  model.opportunities[0].work_model = 'remote'
  model.opportunities[0].location = { country: 'US' } // country must be array
  assert.throws(() => validateModel(model), error => error.code === 'MODEL_INVALID')

  model.opportunities[0].location = { country: ['US'] }
  model.opportunities[0].pay = { min: -500 } // min cannot be negative
  assert.throws(() => validateModel(model), error => error.code === 'MODEL_INVALID')
})

test('Opportunity structured fields: upsertEntity populates defaults and accepts full values', () => {
  const paths = tempVault()

  const payload = {
    schemaVersion: 1,
    requestId: 'req-1',
    idempotencyKey: 'key-1',
    payload: {
      type: 'opportunity',
      record: {
        id: 'opportunity:role-2',
        company_id: 'company:acme',
        title: 'Backend Lead',
        posting_state: 'active',
        pursuit_status: 'evaluating',
        people_relations: [],
        work_model: 'remote',
        location: { country: ['BR'], city: 'São Paulo', raw: 'São Paulo (Remote)' },
        pay: { currency: 'BRL', min: 20000, max: 30000, period: 'monthly', ote: false }
      }
    }
  }

  const result = upsertEntity(paths, payload)
  assert.equal(result.status, 'applied')

  const updatedModel = loadModel(paths)
  const opp = updatedModel.opportunities.find(o => o.id === 'opportunity:role-2')
  assert.equal(opp.work_model, 'remote')
  assert.equal(opp.location.city, 'São Paulo')
  assert.equal(opp.pay.currency, 'BRL')
})

test('Opportunity structured fields: renderIndexes formats structured fields in markdown', () => {
  const paths = tempVault()
  const model = loadModel(paths)
  model.opportunities[0].work_model = 'hybrid'
  model.opportunities[0].location = { country: ['US'], city: 'San Francisco', raw: 'San Francisco, CA (Hybrid)' }
  model.opportunities[0].pay = { currency: 'USD', min: 150000, max: 200000, period: 'yearly', ote: false }

  const indexes = renderIndexes(model)
  const oppMd = indexes.get('opportunities/role-1.md')

  assert.ok(oppMd.includes('- Work model: hybrid'))
  assert.ok(oppMd.includes('- Location: San Francisco, CA (Hybrid) [US]'))
  assert.ok(oppMd.includes('- Pay: USD 150,000 – 200,000 / yearly (OTE: no)'))
})

test('Opportunity structured fields: command describe exposes schemas', () => {
  const description = describeCommand('application-attempt register-package')
  const oppProps = description.contract.payload.properties.records.properties.opportunity.properties
  assert.ok(oppProps.work_model)
  assert.ok(oppProps.location)
  assert.ok(oppProps.pay)
})

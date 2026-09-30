import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { evaluateGuidance } from '../src/guidance.mjs'
const scenarios = JSON.parse(fs.readFileSync(new URL('./fixtures/applicant-scenarios.json', import.meta.url)))
for (const scenario of scenarios) test(`${scenario.profile}: known choice survives repeated refinement without interrogation`, () => {
  const source = { kind: 'user', reference: `synthetic:${scenario.profile}` }
  for (let revision = 0; revision < 3; revision++) {
    const result = evaluateGuidance({ schemaVersion: 1, operation: 'draft', observations: [{ criterion: scenario.criterion, state: 'unknown', source }], answers: [{ id: 'known', criterion: scenario.criterion, scope: 'conversation', kind: scenario.criterion === 'claim' ? 'fact' : scenario.criterion === 'career_tradeoff' ? 'decision' : 'preference', state: 'answered', value: scenario.answer, source }] })
    assert.equal(result.questions.length, 0)
    assert.equal(result.effectiveAnswers[0].value, scenario.answer)
  }
})

test('explicit headhunter observations route authority research and unconfirmed-event claims separately', () => {
  const source = { kind: 'agent', reference: 'synthetic:people-manager:baseline-review' }
  const result = evaluateGuidance({ schemaVersion: 1, operation: 'review', observations: [
    { criterion: 'hiring_authority', state: 'unknown', source },
    { criterion: 'claim', state: 'conflict', value: 'Draft says submitted; supplied evidence says not submitted.', source }
  ] })
  assert.equal(result.actions[0].answerer, 'researcher')
  assert.equal(result.actions[0].criterion, 'hiring_authority')
  assert.equal(result.questions[0].criterion, 'claim')
  assert.equal(result.questions[0].reasonCode, 'CONFLICT')
})

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { performance } from 'node:perf_hooks'
import { evaluateGuidance } from '../src/guidance.mjs'
import { main } from '../src/cli.mjs'
import { fixture } from './fixtures/career-vault.mjs'

const source = { kind: 'user', reference: 'synthetic-input' }
const observation = (criterion, extra = {}) => ({ criterion, state: 'unknown', source, ...extra })
const answer = (extra = {}) => ({ id: 'a1', criterion: 'presentation', scope: 'conversation', kind: 'preference', state: 'answered', value: 'chronological and plain list', source, ...extra })
const request = extra => ({ schemaVersion: 1, operation: 'draft', ...extra })

test('zero questions and no required linear workflow', () => {
  for (const operation of ['evaluate', 'draft', 'review', 'submit', 'follow_up', 'interview', 'decide', 'reflect']) assert.equal(evaluateGuidance({ schemaVersion: 1, operation }).questions.length, 0)
})
test('known preferences and skips survive edits until a relevant dependency changes', () => {
  for (const state of ['answered', 'unknown', 'deferred', 'declined']) {
    const a = answer({ state, ...(state === 'answered' ? {} : { value: undefined }), dependencies: { channel: 'a'.repeat(64) } })
    for (let i = 0; i < 3; i++) assert.equal(evaluateGuidance(request({ observations: [observation('presentation', { dependencies: a.dependencies })], answers: [a] })).questions.length, 0)
    const changed = evaluateGuidance(request({ observations: [observation('presentation', { dependencies: { channel: 'b'.repeat(64) } })], answers: [a] }))
    assert.equal(changed.questions.length, 1); assert.equal(changed.questions[0].changedDependency, true)
  }
})
test('research and repair are not applicant interrogation; optional round stops', () => {
  const result = evaluateGuidance(request({ observations: ['context', 'mandate', 'hiring_authority', 'channel', 'contribution'].map(c => observation(c)), optionalRounds: 1 }))
  assert.equal(result.actions.length, 4); assert.equal(result.questions.length, 0)
  assert.equal(result.actions.find(a => a.criterion === 'context').answerer, 'maintainer')
  const deep = evaluateGuidance(request({ observations: ['intent', 'contribution', 'claim', 'relationship'].map(c => observation(c)), maxQuestions: 3 }))
  assert.equal(deep.questions.length, 3); assert.equal(deep.remainingQuestionCount, 1)
})
test('narrow preferences override but contradictory facts remain visible', () => {
  const result = evaluateGuidance(request({ subject: 'opportunity:test', answers: [answer({ scope: 'shared' }), answer({ id: 'a2', scope: 'opportunity:test', value: 'domain table' })] }))
  assert.equal(result.effectiveAnswers[0].value, 'domain table')
  const conflict = evaluateGuidance(request({ subject: 'opportunity:test', answers: [answer({ scope: 'shared', kind: 'fact' }), answer({ id: 'a2', scope: 'opportunity:test', kind: 'fact', value: 'different fact' })] }))
  assert.equal(conflict.conflicts.length, 1); assert.equal(conflict.questions[0].reasonCode, 'CONFLICT')
})
test('schema rejects injected fields, unbounded answers and invalid flags', () => {
  for (const extra of [{ execute: 'something' }, { maxQuestions: 4 }, { essentialOnly: 'true' }, { answers: [answer({ value: 'x'.repeat(4097) })] }]) assert.throws(() => evaluateGuidance(request(extra)), e => e.code === 'INVALID_COMMAND')
})
test('CLI transient guidance needs no vault and writes nothing', async t => {
  const { root } = fixture(t), input = path.join(root, 'input.json')
  fs.writeFileSync(input, JSON.stringify(request({ observations: [observation('contribution')] })))
  let output = '', error = ''
  assert.equal(await main(['guidance', '--input', input, '--json'], { out: { write: s => output += s }, err: { write: s => error += s } }), 0, error)
  assert.equal(JSON.parse(output).questions.length, 1); assert.equal(fs.existsSync(path.join(root, '.nextstep')), false)
})
test('128-entry guidance stays below the 100ms p95 loaded-input target', () => {
  const answers = Array.from({ length: 128 }, (_, i) => answer({ id: `a${i}` }))
  const timings = Array.from({ length: 30 }, () => { const start = performance.now(); evaluateGuidance(request({ answers })); return performance.now() - start }).sort((a, b) => a - b)
  assert.ok(timings[28] < 100, `p95=${timings[28]}ms`)
  console.log(`Guidance 128 entries p95: ${timings[28].toFixed(2)} ms`)
})

test('all finite criteria expose actionable bounded suggestions', () => {
  for (const criterion of ['intent', 'mandate', 'career_tradeoff', 'channel', 'contribution', 'claim', 'relationship', 'hiring_authority', 'presentation', 'decision', 'context']) {
    const result = evaluateGuidance(request({ observations: [observation(criterion)] }))
    const action = [...result.actions, ...result.questions][0]
    assert.equal(action.criterion, criterion)
    assert.equal(typeof action.question, 'string')
    assert.ok(action.consequence)
  }
})

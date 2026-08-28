import test from 'node:test'
import assert from 'node:assert/strict'
import { addWorkflowProjections, derivePreparation } from './workflow.js'

const app = (extra={}) => ({ status:'identified', artifacts:{}, metadataExists:false, people:[], tags:[], ...extra })

test('preparation gates remain explicit and evidence-derived', () => {
  const value = derivePreparation(app({ artifacts:{ cv:true } }))
  assert.equal(value.steps.find((step) => step.id === 'job-source').complete, false)
  assert.equal(value.steps.find((step) => step.id === 'fit').complete, false)
  assert.equal(value.steps.find((step) => step.id === 'cv').complete, true)
})

test('explicit source does not imply completed reuse evidence', () => {
  const value = derivePreparation(app({ jobSource:'https://jobs.example/123', artifacts:{ fitAnalysis:true } }))
  assert.equal(value.steps.find((step) => step.id === 'job-source').complete, true)
  assert.equal(value.steps.find((step) => step.id === 'reuse-evidence').complete, false)
})

test('terminal lifecycle closes preparation and exposes governed actions', () => {
  for (const status of ['rejected','withdrawn','archived']) {
    const value = addWorkflowProjections([app({ status })])[0]
    assert.equal(value.lifecycle.terminal, true)
    assert.equal(value.preparation.state, 'closed')
    assert.deepEqual(value.actions.reopen, { target:'identified' })
    assert.equal(Object.hasOwn(value, 'readiness'), false)
    assert.equal(Object.hasOwn(value, 'workflow'), false)
  }
})

test('complete evidence yields ready preparation', () => {
  const value = derivePreparation(app({ metadataExists:true, reuseChecks:'completed', dominantNarrative:'AI Transformation Leader', artifacts:{ jobDescription:true, fitAnalysis:true, cv:true, coverLetter:true, index:true } }))
  assert.equal(value.state, 'ready_for_next_step')
  assert.equal(value.percent, 100)
})

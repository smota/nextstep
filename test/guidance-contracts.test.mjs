import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { workflowBundle } from '../src/workflow-templates.mjs'
test('portable context includes optional guidance and applicant-neutral review', () => {
  for (const intent of ['analyze', 'outreach', 'drafting', 'application', 'interview']) {
    const bundle = workflowBundle(intent)
    assert.ok(bundle.templates.some(t => t.id === 'workflow-template:applicant-guidance'))
    assert.ok(bundle.templates.some(t => t.id === 'workflow-template:applicant-review'))
  }
  for (const name of ['nxt-context', 'nxt-opportunity', 'nxt-application', 'nxt-networking', 'nxt-review']) assert.match(fs.readFileSync(new URL(`../skills/${name}/SKILL.md`, import.meta.url), 'utf8'), /references\/guidance.md/)
})

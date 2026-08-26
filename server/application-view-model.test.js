import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { applicationActionsView, applicationHref, preparationView } from '../client/src/applicationViewModel.js'

const preparation = (complete) => ({ percent: Math.round(complete / 7 * 100), steps: Array.from({ length: 7 }, (_, index) => ({ complete: index < complete })) })
const terminal = (status, archived = false) => ({ slug: `${status}-role`, status, archived, lifecycle: { status, terminal: true, logicallyArchived: archived || status === 'archived' }, preparation: preparation(6), actions: { reopen: { target: 'identified' }, archive: status === 'archived' ? false : true } })

test('preparation copy preserves exact seven-gate evidence percentages', () => {
  assert.deepEqual(preparationView(preparation(5)), { completed: 5, total: 7, percent: 71, valueText: '5 of 7 preparation steps', helper: 'Process completeness — not role fit' })
  assert.deepEqual(preparationView(preparation(6)), { completed: 6, total: 7, percent: 86, valueText: '6 of 7 preparation steps', helper: 'Process completeness — not role fit' })
})

test('terminal lifecycle exposes Reopen and suppresses preparation writes', () => {
  for (const status of ['rejected', 'withdrawn', 'archived']) {
    const view = applicationActionsView(terminal(status, status === 'archived'))
    assert.equal(view.terminal, true)
    assert.equal(view.preparationWritable, false)
    assert.deepEqual(view.primary, { type: 'reopen', label: 'Reopen', target: 'identified' })
  }
})

test('ApplicationDetail source enforces terminal document immutability while preserving read/export controls',()=>{const source=fs.readFileSync(new URL('../client/src/pages/ApplicationDetail.jsx',import.meta.url),'utf8');for(const contract of ['Reopen to edit preparation documents','readOnly={!actionView.preparationWritable||!doc.editable}','disabled={!actionView.preparationWritable||!dirty||saving}','Export PDF','Print','Version <select'])assert.ok(source.includes(contract),contract);assert.ok(source.includes("if(!doc||!dirty||!app||!applicationActionsView(app).preparationWritable)return"))})

test('named application hrefs always carry explicit active or archive scope', () => {
  for (const slug of ['allianz-benelux-head-ai-strategy-transformation', 'booking-com-director-engineering-ecosystems', 'cjr-renewables-chief-transformation-officer']) {
    assert.equal(applicationHref({ slug, archived: false, lifecycle: { logicallyArchived: false } }), `/opportunities/${slug}?scope=active`)
  }
  assert.equal(applicationHref({ slug: 'archived-role', archived: true }), '/opportunities/archived-role?scope=archive')
})

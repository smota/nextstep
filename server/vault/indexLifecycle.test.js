import test from 'node:test'
import assert from 'node:assert/strict'
import { locateApplicationIndexRow, updateApplicationIndexLifecycle } from './indexLifecycle.js'

const slug='astrazeneca-senior-director-enterprise-ai-platforms'
test('AstraZeneca bullet replaces only canonical leading status and preserves prose',()=>{
 const raw=`- [[${slug}/index|AstraZeneca — Senior Director]] — withdrawn; not applied because timing; previously archived discussion; interview preparation\n`
 const output=updateApplicationIndexLifecycle(raw,slug,'archived','Applications index')
 assert.equal(output,raw.replace('— withdrawn;','— archived;'))
})
test('AstraZeneca table uses Status header and ignores lifecycle words in role and Notes',()=>{
 const raw=`| Company | Role | Status | Notes | Workspace |\n|---|---|---|---|---|\n| AstraZeneca | Interview Platform Leader | withdrawn | Not applied; previously archived context | [[applications/${slug}/index|open]] |\n`
 const output=updateApplicationIndexLifecycle(raw,slug,'archived','Main index')
 assert.equal(output,raw.replace('| withdrawn |','| archived |'))
})
test('table fallback accepts exactly one whole-cell lifecycle status and ignores prose',()=>{
 const raw=`| [[${slug}]] | withdrawn | Not applied after interview; previously archived |\n`
 assert.match(updateApplicationIndexLifecycle(raw,slug,'archived'),/\| archived \| Not applied/)
})
test('rejects duplicate exact rows, missing slot, invalid status, and ambiguous schema with fields',()=>{
 const bullet=`- [[${slug}/index|AZ]] — withdrawn; prose\n`
 assert.throws(()=>locateApplicationIndexRow(bullet+bullet,slug),e=>e.field==='reference'&&/found 2/.test(e.message))
 assert.throws(()=>locateApplicationIndexRow(`- [[${slug}/index|AZ]] prose previously archived\n`,slug),e=>e.field==='status'&&/missing/.test(e.message))
 assert.throws(()=>locateApplicationIndexRow(`- [[${slug}/index|AZ]] — newly; identified later\n`,slug),e=>e.field==='status'&&/invalid/.test(e.message))
 const table=`| Status | status | Link |\n|---|---|---|\n| withdrawn | identified | [[${slug}]] |\n`
 assert.throws(()=>locateApplicationIndexRow(table,slug),e=>e.field==='schema'&&/ambiguous/.test(e.message))
})
test('exact slug reference does not match a longer slug',()=>{
 assert.throws(()=>locateApplicationIndexRow(`- [[${slug}-extra/index|AZ]] — withdrawn\n`,slug),/found 0/)
})

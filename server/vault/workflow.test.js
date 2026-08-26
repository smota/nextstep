import assert from 'node:assert/strict'
import test from 'node:test'
import { addWorkflowProjections, derivePreparation, deriveReadiness, deriveWorkflow } from './workflow.js'
const app=(overrides={})=>({status:'to_apply',metadataExists:false,archived:false,reuseChecks:null,artifacts:{},...overrides})
test('prior stage gates remain explicit without conflating readiness and lifecycle',()=>{const value=deriveReadiness(app({artifacts:{cv:true}}));assert.equal(value.gates.hasJobSource,false);assert.equal(value.gates.hasFitAnalysis,false);assert.ok(value.blockers.some(x=>x.gate==='job-source'));assert.ok(value.blockers.some(x=>x.gate==='fit'))})
test('explicit source satisfies job source without inferring reuse evidence',()=>{const value=deriveReadiness(app({jobSource:'https://jobs.example/123',artifacts:{fitAnalysis:true}}));assert.equal(value.gates.hasJobSource,true);assert.equal(value.gates.reusableChecksComplete,false);assert.equal(value.evidence.reuseChecks,'unknown')})
test('explicit completed reuse evidence remains accepted',()=>{const value=deriveReadiness(app({reuseChecks:'completed'}));assert.equal(value.gates.reusableChecksComplete,true);assert.equal(value.evidence.reuseChecks,'evidenced')})
test('readiness is evidence-derived and lifecycle remains independent',()=>{const value=addWorkflowProjections([app({status:'interview'})])[0];assert.equal(value.lifecycle.status,'interview');assert.equal(value.readiness.ready,false);assert.equal(value.actions.advance.target,'offer')})
test('all v2 readiness gates produce deterministic ready compatibility workflow',()=>{const ready=app({metadataExists:true,reuseChecks:'completed',dominantNarrative:'AI Transformation Leader',artifacts:{jobDescription:true,fitAnalysis:true,cv:true,coverLetter:true,index:true}});assert.equal(deriveReadiness(ready).ready,true);assert.equal(deriveWorkflow(ready).stage,'ready')})
for(const status of ['rejected','withdrawn','archived'])test(`terminal ${status} lifecycle remains terminal without becoming readiness`,()=>{const value=addWorkflowProjections([app({status})])[0];assert.equal(value.lifecycle.status,status);assert.equal(value.lifecycle.terminal,true);assert.equal(value.readiness.ready,false);assert.equal(value.preparation.state,'closed');assert.equal(value.preparation.percent,0);assert.deepEqual(value.actions.reopen,{target:'identified'});assert.equal(value.actions.advance,null);assert.equal(value.actions.archive,status!=='archived')})
test('legacy archive location is logically archived regardless of frontmatter',()=>{const value=addWorkflowProjections([app({status:'rejected',archived:true})])[0];assert.equal(value.lifecycle.logicallyArchived,true)})
test('preparation derives every public state deterministically',()=>{
 assert.equal(derivePreparation(app()).state,'not_started')
 assert.equal(derivePreparation(app({jobSource:'https://example.test',dominantNarrative:'Leader'})).state,'in_progress')
 assert.equal(derivePreparation(app({artifacts:{fitAnalysis:true}})).state,'needs_input')
 const prepared=app({metadataExists:true,reuseChecks:'completed',dominantNarrative:'Leader',jobSource:'https://example.test',artifacts:{fitAnalysis:true,cv:true,coverLetter:true,index:true}})
 assert.equal(derivePreparation(prepared).state,'ready_for_next_step')
 assert.equal(derivePreparation({...prepared,status:'archived'}).state,'closed')
})
test('preparation contract exposes progress, steps, input and next action',()=>{const value=derivePreparation(app());for(const key of ['state','percent','currentStep','steps','needsInput','nextAction'])assert.ok(Object.hasOwn(value,key));assert.equal(value.percent,0);assert.equal(value.steps.length,7);assert.ok(value.needsInput.length)})
test('preparation percentage is exact evidence completeness for five and six of seven gates',()=>{const base={metadataExists:true,dominantNarrative:'Leader',jobSource:'https://example.test'};assert.equal(derivePreparation(app({...base,artifacts:{fitAnalysis:true,cv:true,index:true}})).percent,71);assert.equal(derivePreparation(app({...base,reuseChecks:'completed',artifacts:{fitAnalysis:true,cv:true,index:true}})).percent,86)})

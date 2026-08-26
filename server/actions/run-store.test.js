import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { RunStore } from './run-store.js'
import { hashApplyIntent } from './artifacts.js'

function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'run-store-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return new RunStore(root)}
function applying(store){const id=crypto.randomUUID(),stage=store.stage(id,[{artifact:'cv',content:'# CV'}]),intent={runId:id,keyHash:'a'.repeat(64),stageDigest:stage.digest,expectedRevision:0,actionId:'create-cv',application:{slug:'safe',scope:'active'}};intent.intentDigest=hashApplyIntent(intent);const run={id,actionId:'create-cv',application:intent.application,harnessId:'codex',state:'applying',createdAt:new Date().toISOString(),applyIntent:intent,stageDigest:stage.digest,stageExpiresAt:stage.expiresAt,stagedArtifacts:stage.metadata};store.create(run);return{run,intent}}

test('startup finalizes interrupted applying from matching durable receipt and erases stage',t=>{const store=fixture(t),{run,intent}=applying(store),receipt={version:1,...intent,intentDigest:hashApplyIntent(intent),resultingRevision:1,artifactLinks:[{path:'Candidatures/applications/safe/cv.md'}],committedAt:new Date().toISOString()};store.recover({receiptReader:id=>id===run.id?receipt:null});const recovered=store.get(run.id);assert.equal(recovered.state,'completed');assert.equal(recovered.applyKeyHash,intent.keyHash);assert.equal(recovered.resultingRevision,1);assert.equal(fs.existsSync(store.stageFile(run.id)),false);assert.equal(JSON.stringify(recovered).includes('idempotencyKey'),false)})

test('startup exposes rolled-back applying as idempotently retryable awaiting_apply and retains stage',t=>{const store=fixture(t),{run}=applying(store);store.recover({receiptReader:()=>null});assert.equal(store.get(run.id).state,'awaiting_apply');assert.equal(fs.existsSync(store.stageFile(run.id)),true)})

test('startup stage cleanup removes orphan stages and keeps valid awaiting_apply stages',t=>{const store=fixture(t),orphan=crypto.randomUUID();store.stage(orphan,[{artifact:'cv',content:'orphan'}]);const id=crypto.randomUUID(),stage=store.stage(id,[{artifact:'cv',content:'kept'}]);store.create({id,actionId:'create-cv',application:{slug:'safe',scope:'active'},harnessId:'codex',state:'awaiting_apply',createdAt:new Date().toISOString(),stageDigest:stage.digest,stageExpiresAt:stage.expiresAt,stagedArtifacts:stage.metadata});store.recover();assert.equal(fs.existsSync(store.stageFile(orphan)),false);assert.equal(fs.existsSync(store.stageFile(id)),true)})

test('mismatched durable apply receipt fails startup closed',t=>{const store=fixture(t),{intent}=applying(store);assert.throws(()=>store.recover({receiptReader:()=>({...intent,keyHash:'b'.repeat(64),resultingRevision:1,artifactLinks:[]})}),/does not match/)})

test('startup and access atomically recover expired, missing, and tampered stages',t=>{for(const kind of ['expired','missing','tampered']){const store=fixture(t),id=crypto.randomUUID(),stage=store.stage(id,[{artifact:'cv',content:'# CV'}]);store.create({id,actionId:'create-cv',application:{slug:'safe',scope:'active'},harnessId:'codex',state:'awaiting_apply',createdAt:new Date().toISOString(),input:{slug:'safe'},stageDigest:stage.digest,stageExpiresAt:stage.expiresAt,stagedArtifacts:stage.metadata});if(kind==='expired'){const file=store.stageFile(id),value=JSON.parse(fs.readFileSync(file));value.expiresAt=new Date(0).toISOString();fs.writeFileSync(file,JSON.stringify(value))}else if(kind==='missing')fs.rmSync(store.stageFile(id));else fs.appendFileSync(store.stageFile(id),'tamper');const recovered=kind==='expired'?(store.recover(),store.get(id)):store.get(id);assert.equal(recovered.state,kind==='expired'?'expired':'interrupted');assert.equal(recovered.errorCode,kind==='expired'?'STAGE_EXPIRED':'STAGE_MISSING');assert.equal(recovered.retryable,true);assert.equal(fs.existsSync(store.stageFile(id)),false)}})

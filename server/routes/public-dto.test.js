import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { publicRunDto } from '../actions/runner.js'
import { HarnessRuntime } from '../actions/runtime.js'
import { IntakeStore } from '../intakes.js'
import { loadPeople } from '../vault/people.js'
import { publicVaultHealth } from '../vault/index.js'
import { streamRunEvents } from './actions.js'
import { sendPublicError } from './public.js'

const FORBIDDEN=new Set(['output','input','applyIntent','applyKey','applyKeyHash','owner_token','command','commands','filePath','root','child','preimages','stack'])
function assertPrivate(value){const visit=item=>{if(Array.isArray(item))return item.forEach(visit);if(!item||typeof item!=='object')return;if(typeof item==='string')return;for(const [key,child] of Object.entries(item)){assert.equal(FORBIDDEN.has(key),false,`forbidden key ${key}`);if(typeof child==='string')assert.doesNotMatch(child,/(?:[A-Za-z]:[\\/]|\/(?:home|Users|tmp|var|opt|private|mnt|workspace)\/)/i);visit(child)}};visit(value)}
function response(){return{statusCode:200,body:null,writes:[],ended:false,status(code){this.statusCode=code;return this},json(body){this.body=body;return this},write(value){this.writes.push(value)},end(){this.ended=true}}}

test('recursive public DTO matrix excludes execution, filesystem, lock, and receipt internals',t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'privacy-matrix-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const raw={id:'00000000-0000-4000-8000-000000000000',actionId:'create-cv',application:{slug:'safe-role',scope:'active',filePath:'C:\\private\\metadata.md'},harnessId:'codex',state:'awaiting_apply',createdAt:new Date().toISOString(),output:'raw transcript',input:{prompt:'secret'},child:{pid:1},applyIntent:{keyHash:'secret'},applyKeyHash:'secret',result:{status:'completed',summary:'see C:\\Users\\secret\\prompt.txt',blockers:['/home/private/token'],next_recommended_action:null},stagedArtifacts:[{artifact:'cv',bytes:3,digest:'abc',content:'stage secret'}],artifactLinks:[]};assertPrivate(publicRunDto(raw));const runtime=new HarnessRuntime({harnesses:[{id:'codex',label:'Codex',available:true,command:{executable:'C:\\private\\codex.exe'},commands:['codex'],capabilities:[]}],settings:{value:{selectedHarness:'codex'}}});assertPrivate(runtime.list());const intake=new IntakeStore(path.join(root,'intakes')).public({id:raw.id,type:'file',filename:'safe.md',size:1,createdAt:raw.createdAt,source:{path:'C:\\private\\source.md',mime:'text/markdown',pdf:false}});assertPrivate(intake);const people=path.join(root,'people');fs.mkdirSync(people);fs.writeFileSync(path.join(people,'person.md'),'---\ntype: person\nname: Safe\n---\n');assertPrivate(loadPeople(people));assertPrivate(publicVaultHealth({available:false,indexState:{state:'rebuild_required',indexedAt:null,manifestEntries:0}}))})

test('SSE snapshot and terminal frames always pass through the public run projection',()=>{const raw={id:'1',actionId:'position-analysis',application:null,harnessId:'codex',state:'generating',createdAt:new Date().toISOString(),output:'PRIVATE',input:{prompt:'PRIVATE'},events:[]},runner=new EventEmitter();runner.publicRun=publicRunDto;runner.store={events:()=>[]};runner.get=()=>publicRunDto(raw);const req=new EventEmitter(),res=response();req.get=()=>null;req.query={};streamRunEvents({runner,run:raw,req,res});runner.emit('run:1',{event:'completed',run:{...raw,state:'completed',output:'PRIVATE',owner_token:'PRIVATE'}});for(const frame of res.writes.filter(line=>line.startsWith('event:'))){const data=JSON.parse(frame.match(/data: (.*)\n\n/s)[1]);assertPrivate(data);assert.equal(JSON.stringify(data).includes('PRIVATE'),false)}assert.equal(res.ended,true)})

test('controlled errors redact absolute paths and unexpected errors are generic',()=>{const controlled=response();sendPublicError(controlled,Object.assign(new Error('Bad C:\\Users\\private\\secret.txt\nowner_token'),{statusCode:409}));assert.equal(controlled.statusCode,409);assertPrivate(controlled.body);const unexpected=response();sendPublicError(unexpected,new Error('stack /home/private/secret prompt'));assert.deepEqual({status:unexpected.statusCode,body:unexpected.body},{status:500,body:{error:'Request failed safely'}})})

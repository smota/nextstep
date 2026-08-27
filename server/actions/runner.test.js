import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ActionRunner, discoverPi, resolveWindowsWrapper, terminateProcessTree } from './runner.js'
import { parseFinalPayload } from './artifacts.js'

const PROJECT_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const APP_ROOT=PROJECT_ROOT
const TEST_SKILLS_ROOT=fs.mkdtempSync(path.join(os.tmpdir(),'nextstep-external-skills-'))
for(const skill of ['job-description-analyzer','resume-tailor','cover-letter-generator','interview-prep-generator','holoself']){const dir=path.join(TEST_SKILLS_ROOT,skill);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'SKILL.md'),`---\nname: ${skill}\ndescription: Synthetic external test skill\n---\nHonor the supplied output schema and workflow boundaries.\n`)}
after(()=>fs.rmSync(TEST_SKILLS_ROOT,{recursive:true,force:true}))
const makeRunner=options=>new ActionRunner({skillsRoot:TEST_SKILLS_ROOT,...options})
function fakeSpawn(record, autoClose=true) { return (exe,args,options)=>{ record.push({exe,args,options}); const child=new EventEmitter(); child.stdout=new PassThrough(); child.stderr=new PassThrough(); child.kill=()=>{ child.killed=true; queueMicrotask(()=>child.emit('close',null)); return true }; if(autoClose) queueMicrotask(()=>child.emit('close',0)); return child } }
test('runner rejects non-allowlisted actions and unsafe slug input',()=>{ const runner=makeRunner({vaultRoot:process.cwd(),executable:'pi',spawnFn:fakeSpawn([])}); assert.throws(()=>runner.start('shell'),/Unknown action ID/); assert.throws(()=>runner.start('create-cv',{slug:'x; rm -rf'}),/valid application slug/) })
test('runner uses argument array, ignored stdin, shell false, vault cwd and keeps stderr out of structured stdout',async t=>{ const root=await mkdtemp(path.join(os.tmpdir(),'runner-spawn-'));t.after(()=>import('node:fs/promises').then(x=>x.rm(root,{recursive:true,force:true})));const calls=[]; const runner=makeRunner({vaultRoot:root,executable:'/bin/pi',outputLimit:5,spawnFn:fakeSpawn(calls,false)}); const run=runner.start('position-analysis',{intake:{type:'text',source:{path:'cache/source.txt'}}}); await new Promise(r=>setImmediate(r)); assert.equal(calls[0].options.shell,false); assert.equal(calls[0].options.cwd,root); assert.deepEqual(calls[0].options.stdio,['ignore','pipe','pipe']); assert.ok(Array.isArray(calls[0].args)); assert.equal(calls[0].args.length,2); runner.active.child.stderr.write('warning');runner.active.child.stdout.write('123456789');assert.equal(runner.active.output,'12345'); runner.active.child.emit('close',0); await new Promise(r=>setImmediate(r)); assert.equal(Object.hasOwn(runner.get(run.id),'output'),false); assert.equal(Object.hasOwn(runner.get(run.id),'stderr'),false); assert.equal(Object.hasOwn(runner.get(run.id),'truncated'),false) })
test('runner serializes concurrency and supports cancellation',async t=>{ const root=await mkdtemp(path.join(os.tmpdir(),'runner-queue-'));t.after(()=>import('node:fs/promises').then(x=>x.rm(root,{recursive:true,force:true})));const calls=[]; const runner=makeRunner({vaultRoot:root,executable:'pi',spawnFn:fakeSpawn(calls,false)}); const first=runner.start('position-analysis',{intake:{type:'text',source:{path:'cache/source.txt'}}}); const second=runner.start('position-analysis',{intake:{type:'text',source:{path:'cache/source.txt'}}}); assert.equal(calls.length,1); assert.equal(runner.cancel(second.id),true); assert.equal(runner.get(second.id).state,'cancelled'); assert.equal(runner.cancel(first.id),true); assert.equal(runner.get(first.id).state,'cancel_requested'); assert.equal(calls.length,1); runner.active.child.emit('close',null); await new Promise(r=>setImmediate(r)); assert.equal(runner.get(first.id).state,'cancelled'); assert.equal(calls.length,1) })

test('no-close cancellation retains serialization; repeated cancel is inert and late close drains once',async t=>{const root=await mkdtemp(path.join(os.tmpdir(),'runner-cancel-'));t.after(()=>import('node:fs/promises').then(x=>x.rm(root,{recursive:true,force:true})));const calls=[],children=[],spawnFn=(exe,args,options)=>{calls.push({exe,args,options});const child=new EventEmitter();child.pid=9876;child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{child.killCalls=(child.killCalls||0)+1;return true};children.push(child);return child};const runner=makeRunner({vaultRoot:root,executable:'pi',spawnFn,cancellationTimeoutMs:10,platform:'linux'}),input={intake:{type:'text',source:{path:'missing'}}},first=runner.start('position-analysis',input),second=runner.start('position-analysis',input);assert.equal(calls.length,1);assert.equal(runner.cancel(first.id),true);const killCalls=children[0].killCalls;assert.equal(runner.cancel(first.id),true);assert.equal(children[0].killCalls,killCalls);await new Promise(resolve=>setTimeout(resolve,25));assert.equal(runner.get(first.id).state,'cancellation_failed');assert.equal(calls.length,1);assert.equal(runner.active?.id,first.id);assert.equal(runner.cancel(first.id),true);children[0].emit('close',null);children[0].emit('close',null);await new Promise(resolve=>setImmediate(resolve));assert.equal(runner.get(first.id).state,'cancelled');assert.equal(calls.length,2);assert.equal(runner.active?.id,second.id);children[1].emit('close',1)})

test('Windows termination uses taskkill argument array with shell disabled',()=>{ const calls=[]; const killer=new EventEmitter(); terminateProcessTree({pid:4321},{platform:'win32',spawnFn:(exe,args,options)=>{calls.push({exe,args,options});return killer}}); assert.equal(calls[0].exe,'taskkill.exe'); assert.deepEqual(calls[0].args,['/PID','4321','/T','/F']); assert.equal(calls[0].options.shell,false) })
test('non-Windows termination signals the detached process group',()=>{ let pid,signal; terminateProcessTree({pid:4321,kill:()=>false},{platform:'linux',killFn:(p,s)=>{pid=p;signal=s}}); assert.equal(pid,-4321);assert.equal(signal,'SIGTERM') })

test('resolves trusted npm Windows wrapper to node plus fixed JS entrypoint', async()=>{ const root=await mkdtemp(path.join(os.tmpdir(),'pi-wrapper-')); const entry=path.join(root,'node_modules','pkg','cli.js'); await mkdir(path.dirname(entry),{recursive:true}); await writeFile(entry,''); const wrapper=path.join(root,'pi.cmd'); await writeFile(wrapper,'@ECHO off\r\n"%~dp0\\node.exe" "%~dp0\\node_modules\\pkg\\cli.js" %*\r\n'); const resolved=await resolveWindowsWrapper(wrapper); assert.equal(resolved.executable,process.execPath); assert.deepEqual(resolved.argsPrefix,[entry]) })

test('resolves npm Windows wrapper using a dp0 variable', async()=>{ const root=await mkdtemp(path.join(os.tmpdir(),'pi-wrapper-')); const entry=path.join(root,'node_modules','pkg','cli.js'); await mkdir(path.dirname(entry),{recursive:true}); await writeFile(entry,''); const wrapper=path.join(root,'pi.cmd'); await writeFile(wrapper,'SET dp0=%~dp0\r\nnode "%dp0%\\node_modules\\pkg\\cli.js" %*\r\n'); const resolved=await resolveWindowsWrapper(wrapper); assert.equal(resolved.executable,process.execPath); assert.deepEqual(resolved.argsPrefix,[entry]) })

test('rejects Windows wrapper entrypoints outside trusted installation root', async()=>{ const parent=await mkdtemp(path.join(os.tmpdir(),'pi-wrapper-')); const root=path.join(parent,'bin'); await mkdir(root); const outside=path.join(parent,'evil.js'); await writeFile(outside,''); const wrapper=path.join(root,'pi.cmd'); await writeFile(wrapper,'node "%~dp0\\..\\evil.js" %*'); assert.equal(await resolveWindowsWrapper(wrapper),null) })

test('Windows discovery returns safe node descriptor for cmd shim', async()=>{ const root=await mkdtemp(path.join(os.tmpdir(),'pi-discover-')); const entry=path.join(root,'node_modules','pkg','cli.js'); await mkdir(path.dirname(entry),{recursive:true}); await writeFile(entry,''); await writeFile(path.join(root,'pi.cmd'),'node "%~dp0\\node_modules\\pkg\\cli.js" %*'); const found=await discoverPi({env:{PATH:root},platform:'win32',probeFn:async()=>true}); assert.equal(found.executable,process.execPath); assert.deepEqual(found.argsPrefix,[entry]) })

test('catalog exposes six harness-neutral action contracts', () => {
  const runner = makeRunner({ vaultRoot: process.cwd(), executable: 'pi', spawnFn: fakeSpawn([]) })
  const catalog = runner.catalog()
  assert.deepEqual(catalog.map(a => a.id), ['position-analysis','generate-fit-analysis','create-application-analysis','create-cv','generate-cover-letter','interview-prep'])
  for (const action of catalog) {
    assert.match(action.skill,/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    assert.ok(['analyze','create-artifact'].includes(action.profile))
    assert.ok(action.prerequisites.length)
    assert.deepEqual(action.completionEnvelope, ['status','summary','artifacts','blockers','next_recommended_action'])
    assert.equal(action.selectedHarness, 'pi')
  }
  assert.equal(catalog[0].mutability, 'read_only')
  assert.equal(catalog.some(a=>a.mutability==='proposal_only'),false)
  assert.equal(catalog.find(a=>a.id==='create-cv').skill, 'resume-tailor')
})

test('validation returns exact structured prerequisite states for every action', async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'runner-prereqs-'));t.after(()=>import('node:fs/promises').then(x=>x.rm(root,{recursive:true,force:true})))
  const app=path.join(root,'Candidatures','applications','role');await mkdir(app,{recursive:true})
  const runner=makeRunner({vaultRoot:root,executable:'pi',spawnFn:fakeSpawn([])})
  const state=(id,input={slug:'role'})=>Object.fromEntries(runner.validate(id,input).prerequisites.map(x=>[x.id,x.state]))
  assert.equal(state('generate-fit-analysis')['fit-source'],'missing');await writeFile(path.join(app,'job-description.md'),'job');assert.equal(state('generate-fit-analysis')['fit-source'],'ready')
  assert.equal(state('create-cv')['cv-fit'],'missing');await writeFile(path.join(app,'fit-analysis.md'),'fit');assert.equal(state('create-cv')['cv-fit'],'ready')
  let cover=state('generate-cover-letter');assert.equal(cover['cover-job'],'ready');assert.equal(cover['cover-fit'],'ready');assert.equal(cover['cover-narrative'],'missing')
  await writeFile(path.join(app,'metadata.md'),'---\ndominant_narrative: Platform leader\n---');cover=state('generate-cover-letter');assert.equal(cover['cover-narrative'],'ready')
  const interview=state('interview-prep');assert.equal(interview['interview-job'],'ready');assert.equal(interview['interview-fit'],'ready')
  assert.equal(state('position-analysis',{intake:{source:{pdf:true}}})['pdf-support'],'unavailable')
  const unavailable=makeRunner({vaultRoot:root,runtime:{selected:()=>({available:false,unavailableReason:'not installed'})},spawnFn:fakeSpawn([])}).validate('position-analysis',{intake:{source:{path:'source.txt'}}});assert.equal(unavailable.prerequisites.find(x=>x.id==='execution-harness').state,'unavailable')
  const review=runner.validate('create-cv',{slug:'missing'});assert.equal(review.valid,false);assert.equal(review.prerequisites.find(x=>x.id==='cv-fit').state,'missing');assert.throws(()=>runner.start('create-cv',{slug:'missing'}),error=>error.statusCode===409)
})

test('every action prompt preserves data, skill, schema and mutation boundaries', async t => {
  const root=await mkdtemp(path.join(os.tmpdir(),'runner-prompts-'));t.after(()=>import('node:fs/promises').then(x=>x.rm(root,{recursive:true,force:true})))
  await mkdir(path.join(root,'Candidatures','applications','existing'),{recursive:true});await writeFile(path.join(root,'Candidatures','applications','existing','fit-analysis.md'),'fit');await writeFile(path.join(root,'Candidatures','applications','existing','job-description.md'),'jd')
  const cases=[['position-analysis',{intake:{type:'text',source:{path:'cache/source.txt'}}}],['create-application-analysis',{slug:'new-role',company:'Acme',role:'Lead',intake:{type:'text',source:{path:'cache/source.txt'}}}],['create-cv',{slug:'existing'}],['interview-prep',{slug:'existing'}]]
  for(const [id,input] of cases){const calls=[];makeRunner({vaultRoot:root,executable:'pi',spawnFn:fakeSpawn(calls)}).start(id,input);await new Promise(resolve=>setImmediate(resolve));const prompt=calls[0].args[1];for(const key of ['status','summary','artifacts','blockers','next_recommended_action'])assert.ok(prompt.includes(key),`${id} missing ${key}`);for(const boundary of ['<OUTPUT_SCHEMA>','<SKILL_CONTRACT>','<UNTRUSTED_DATA>','Return data only','Do not use tools to write files','Never emit paths'])assert.ok(prompt.includes(boundary),`${id} missing ${boundary}`);assert.match(prompt,/untrusted/i)}
})

test('runner stages, applies, erases, verifies and durably replays apply idempotency',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'runner-apply-e2e-'));t.after(()=>import('node:fs/promises').then(x=>x.rm(root,{recursive:true,force:true})))
 const apps=path.join(root,'Candidatures','applications'),folder=path.join(apps,'role'),coord=path.join(root,'.coordination');await mkdir(folder,{recursive:true});await mkdir(path.join(coord,'locks'),{recursive:true});await writeFile(path.join(folder,'metadata.md'),'---\nstatus: identified\napplication_revision: 0\n---\n');await writeFile(path.join(folder,'fit-analysis.md'),'fit');await writeFile(path.join(coord,'audit-log.md'),'# Audit\n')
 const paths={vaultRoot:root,applicationsDir:apps,archiveApplicationsDir:path.join(root,'Candidatures','archive','applications'),candidaturesDir:path.join(root,'Candidatures'),locksDir:path.join(coord,'locks'),auditLogPath:path.join(coord,'audit-log.md')},output=`<<<FINAL_JSON>>>{"status":"completed","summary":"ok","artifacts":[{"artifact":"cv","content":"# Verified CV"}],"blockers":[],"next_recommended_action":null}<<<END_FINAL_JSON>>>`
 const spawnFn=()=>{const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>true;queueMicrotask(()=>{child.stdout.write(output);child.emit('close',0)});return child},runner=makeRunner({vaultRoot:root,paths,executable:'pi',spawnFn}),started=runner.start('create-cv',{slug:'role'});await new Promise(r=>setTimeout(r,30));const staged=runner.get(started.id);assert.equal(staged.state,'awaiting_apply');assert.equal(staged.applyRevision,0)
 const applied=runner.apply(started.id,{expectedRevision:staged.applyRevision,idempotencyKey:'apply-key'});assert.equal(applied.state,'completed');assert.equal((await readFile(path.join(folder,'cv.md'),'utf8')),'# Verified CV');assert.equal(applied.artifactLinks[0].url.includes('/opportunities/role'),true);assert.throws(()=>runner.store.readStage(started.id,runner.runs.get(started.id).stageDigest),error=>error.code==='STAGE_MISSING')
 const restarted=makeRunner({vaultRoot:root,paths,executable:'pi',spawnFn});assert.equal(restarted.apply(started.id,{expectedRevision:0,idempotencyKey:'apply-key'}).state,'completed');assert.throws(()=>restarted.apply(started.id,{expectedRevision:1,idempotencyKey:'apply-key'}),e=>e.statusCode===409);assert.throws(()=>restarted.apply(started.id,{expectedRevision:0,idempotencyKey:'other-key'}),e=>e.statusCode===409)
})

test('prose and expectedWrites never become artifact links',async()=>{const output='prose Candidatures/applications/acme/cv.md\n<<<FINAL_JSON>>>{"status":"completed","summary":"ok","artifacts":[],"blockers":[],"next_recommended_action":null}<<<END_FINAL_JSON>>>';const spawnFn=()=>{const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>true;queueMicrotask(()=>{child.stdout.write(output);child.emit('close',0)});return child};const runner=makeRunner({vaultRoot:process.cwd(),executable:'pi',spawnFn});const run=runner.start('position-analysis',{intake:{type:'text',source:{path:'missing'}}});await new Promise(r=>setImmediate(r));assert.deepEqual(runner.get(run.id).artifactLinks,[]);assert.equal(Object.hasOwn(runner.get(run.id),'expectedWrites'),false)})

test('external skills are required and remain substitutable behind capability IDs', () => {
  const configured=makeRunner({vaultRoot:process.cwd(),executable:'pi',spawnFn:fakeSpawn([])})
  assert.equal(configured.catalog().every(action=>action.skillAvailable&&action.available),true)
  const missing=new ActionRunner({vaultRoot:process.cwd(),executable:'pi',spawnFn:fakeSpawn([])})
  assert.equal(missing.catalog().every(action=>!action.skillAvailable&&!action.available),true)
  const validation=missing.validate('position-analysis',{intake:{type:'text',source:{path:'missing'}}})
  assert.equal(validation.prerequisites.find(item=>item.id==='external-skill').state,'unavailable')
  assert.throws(()=>missing.start('position-analysis',{intake:{type:'text',source:{path:'missing'}}}),error=>error.statusCode===422)
})

test('Holoself adapter preserves the external context boundary', async () => {
  const adapter=await readFile(path.join(APP_ROOT,'server','holoself','adapter.js'),'utf8')
  assert.match(adapter,/\.holoself[^\n]+proposal-sources/)
  assert.doesNotMatch(adapter,/writeFile\([^\n]*(?:profile|context)\//i)
})

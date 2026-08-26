import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp,readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { ADAPTERS,HarnessRuntime,RuntimeSettings } from './runtime.js'

const prompt='Fixed prompt for acme-role'
test('all adapter fixtures emit exact safe headless arguments',()=>{
 const cwd=path.resolve('/vault'), fixtures={
  pi:['--print','--mode','json',prompt],
  claude:['--print','--output-format','json','--permission-mode','plan','--tools','Read,Glob,Grep',prompt],
  codex:['exec','--json','-C',cwd,'--sandbox','read-only',prompt],
  agy:['--print','--output-format','json','--mode','plan',prompt],
  grok:['--single','--output-format','json','--cwd',cwd,'--sandbox','read-only','--tools','Read,Glob,Grep',prompt],
 }
 for(const [id,expected] of Object.entries(fixtures))assert.deepEqual(ADAPTERS[id].buildArgs({prompt,profile:'analyze',cwd}),expected)
})
test('all artifact generators remain read-only and never receive unsafe/write flags',()=>{for(const adapter of Object.values(ADAPTERS)){const args=adapter.buildArgs({prompt,profile:'create-artifact',cwd:'/vault'});const joined=args.join(' ');assert.doesNotMatch(joined,/dangerously|bypass|full-auto|yolo|skip-permission|workspace-write|acceptEdits|accept-edits/i);if(['codex','grok'].includes(adapter.id))assert.ok(args.includes('read-only'));if(adapter.id==='claude')assert.ok(args.includes('plan'))}})
test('runtime keeps unavailable selected harness and rejects unknown override',()=>{const settings={value:{selectedHarness:'grok'}},runtime=new HarnessRuntime({settings,harnesses:Object.values(ADAPTERS).map(a=>({...a,available:a.id==='pi',command:a.id==='pi'?{executable:'pi',argsPrefix:[]}:null,unavailableReason:'missing'}))});assert.equal(runtime.selected().id,'grok');assert.equal(runtime.selected().available,false);assert.throws(()=>runtime.selected('other'),/Unknown harness/)})
test('settings validate, persist atomically, omit obsolete public fields, and preserve state on atomic failure',async()=>{const dir=await mkdtemp(path.join(os.tmpdir(),'runtime-settings-')),file=path.join(dir,'settings.json'),settings=new RuntimeSettings({filePath:file});await settings.load();await settings.update({selectedHarness:'claude',maxBudgetUsd:99});assert.deepEqual(settings.public(),{selectedHarness:'claude'});assert.deepEqual(JSON.parse(await readFile(file,'utf8')),{selectedHarness:'claude'});await assert.rejects(()=>settings.update({selectedHarness:'unknown'}),/known harness/);const failed=new RuntimeSettings({filePath:path.join(dir,'failed.json'),renameFn:async()=>{throw new Error('atomic fail')}});await assert.rejects(()=>failed.update({selectedHarness:'pi'}),/atomic fail/);assert.equal(failed.value.selectedHarness,'pi')})

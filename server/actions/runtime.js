import { spawn } from 'node:child_process'
import { access, mkdir, readFile, realpath, rename, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

// Harnesses are generators, never mutation authorities. Every profile is read-only;
// the backend alone validates and applies returned artifacts.
export const PROFILES = Object.freeze({ analyze: 'read-only', 'create-artifact': 'read-only' })
const safeTools = 'Read,Glob,Grep'
export const ADAPTERS = Object.freeze({
  pi: { id:'pi', label:'Pi', commands:['pi'], disabledReason:'Pi has no verified read-only filesystem mode.', capabilities:['json-output'], buildArgs:({prompt})=>['--print','--mode','json',prompt] },
  claude: { id:'claude', label:'Claude', commands:['claude'], capabilities:['analyze','create-artifact','json-output','tool-restrictions'], buildArgs:({prompt})=>[prompt,'--print','--output-format','json','--permission-mode','plan','--tools',safeTools] },
  codex: { id:'codex', label:'Codex', commands:['codex'], capabilities:['analyze','create-artifact','json-lines','sandbox'], buildArgs:({prompt,profile,cwd})=>['exec','--json','-C',cwd,'--sandbox',PROFILES[profile],'--skip-git-repo-check',prompt] },
  agy: { id:'agy', label:'AGY', commands:['agy'], disabledReason:'AGY has no verified read-only filesystem mode.', capabilities:['json-output'], buildArgs:({prompt})=>['--print','--output-format','json','--mode','plan',prompt] },
  grok: { id:'grok', label:'Grok', commands:['grok'], capabilities:['analyze','create-artifact','json-output','sandbox','tool-restrictions'], buildArgs:({prompt,profile,cwd})=>['--single','--output-format','json','--cwd',cwd,'--sandbox',PROFILES[profile],'--tools',safeTools,prompt] },
})

export async function resolveWindowsWrapper(wrapper) {
  const wrapperPath=await realpath(wrapper), root=path.dirname(wrapperPath), text=await readFile(wrapperPath,'utf8')
  for(const match of text.matchAll(/["']([^"'\r\n]*(?:%~dp0|%dp0%)[^"'\r\n]*\.(?:m?js))["']/gi)){
    const expanded=match[1].replaceAll(/(?:%~dp0|%dp0%)[\\/]?/gi,`${root}${path.sep}`).replaceAll(/[\\/]/g,path.sep)
    const entry=await realpath(path.resolve(expanded)).catch(()=>null); if(!entry)continue
    const rel=path.relative(root,entry); if(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel))return {executable:process.execPath,argsPrefix:[entry]}
  } return null
}
function invoke(executable,argsPrefix,args,{spawnFn=spawn,timeoutMs=3000}={}){return new Promise(resolve=>{let output='';const child=spawnFn(executable,[...argsPrefix,...args],{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});const done=(result)=>{clearTimeout(timer);resolve(result)};const timer=setTimeout(()=>{child.kill?.('SIGTERM');done({ok:false,reason:'Probe timed out'})},timeoutMs);child.stdout?.on('data',c=>output+=c);child.stderr?.on('data',c=>output+=c);child.once('error',e=>done({ok:false,reason:e.code==='ENOENT'?'Command not found':e.message}));child.once('close',code=>done(code===0?{ok:true,version:output.trim().split(/\r?\n/)[0]||'version unavailable'}:{ok:false,reason:`Version probe exited ${code}`}))})}
export async function findCommand(names,{env=process.env,platform=process.platform,probeFn=invoke}={}){
  for(const name of names){const variants=platform==='win32'?[`${name}.exe`,name,`${name}.cmd`]:[name];const override=env[`${name.toUpperCase()}_EXECUTABLE`];const candidates=override?[override]:(env.PATH||'').split(path.delimiter).flatMap(dir=>variants.map(v=>path.join(dir,v)))
    for(const candidate of candidates){try{await access(candidate);let descriptor={executable:candidate,argsPrefix:[]};if(platform==='win32'&&candidate.toLowerCase().endsWith('.cmd'))descriptor=await resolveWindowsWrapper(candidate);if(!descriptor)continue;const result=await probeFn(descriptor.executable,descriptor.argsPrefix,['--version']);if(result===true)return {...descriptor,version:'available'};if(result?.ok)return {...descriptor,version:result.version}}catch{}}
  } return null
}
export async function probeHarnesses(options={}){const values=[];for(const adapter of Object.values(ADAPTERS)){const command=adapter.disabledReason?null:await findCommand(adapter.commands,options);values.push({...adapter,buildArgs:undefined,available:Boolean(command),version:command?.version||null,command:command?{executable:command.executable,argsPrefix:command.argsPrefix}:null,unavailableReason:adapter.disabledReason||(command?null:`${adapter.label} command was not found or failed its version probe.`)})}return values}

export class RuntimeSettings {
  constructor({filePath,renameFn=rename}={}){this.filePath=filePath;this.renameFn=renameFn;this.value={selectedHarness:'pi'}}
  async load(){try{const stored=JSON.parse(await readFile(this.filePath,'utf8'));if(ADAPTERS[stored.selectedHarness])this.value.selectedHarness=stored.selectedHarness}catch(error){if(error.code!=='ENOENT')throw error}return this.public()}
  public(){return {selectedHarness:this.value.selectedHarness}}
  async update(input){if(!input||!ADAPTERS[input.selectedHarness])throw Object.assign(new Error('selectedHarness must be a known harness ID'),{statusCode:400});const next={selectedHarness:input.selectedHarness};await mkdir(path.dirname(this.filePath),{recursive:true});const temp=`${this.filePath}.${crypto.randomUUID()}.tmp`;try{await writeFile(temp,JSON.stringify(next,null,2)+'\n',{flag:'wx'});await this.renameFn(temp,this.filePath)}catch(error){await unlink(temp).catch(()=>{});throw error}this.value=next;return this.public()}
}
export class HarnessRuntime {
  constructor({harnesses,settings}){this.harnesses=harnesses;this.settings=settings}
  list(){return this.harnesses.map(({commands,command,buildArgs,disabledReason,...h})=>h)}
  selected(id){const harnessId=id||this.settings.value.selectedHarness;if(!ADAPTERS[harnessId])throw Object.assign(new Error('Unknown harness ID'),{statusCode:400});return this.harnesses.find(h=>h.id===harnessId)}
  args(id,context){return ADAPTERS[id].buildArgs(context)}
}

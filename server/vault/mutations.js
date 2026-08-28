import fs from 'node:fs'
import * as fsPromises from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { LIFECYCLE_STATUSES, validateTransition } from './lifecycle.js'
import { acquireVaultLocks } from './lockAdapter.js'
import { runVaultTransaction } from './transactionJournal.js'
import { moveApplicationStorage } from './lifecycleMove.js'
import { updateApplicationIndexLifecycle } from './indexLifecycle.js'

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
function contained(root, candidate) { const relative = path.relative(path.resolve(root), path.resolve(candidate)); return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative) }
export async function mutationCapability(paths) { try { await fsPromises.stat(path.join(paths.vaultRoot,'.coordination','tools','vault-lock.mjs')); await fsPromises.stat(paths.applicationsDir); await fsPromises.stat(paths.auditLogPath); await fsPromises.stat(paths.locksDir); return {available:true,reason:null} } catch { return {available:false,reason:'Vault mutation is disabled because the coordination lock tool or applications root is unavailable.'} } }
function updateFrontmatter(raw, status, reason, now = new Date(), incrementRevision = true) { const parsed=matter(raw); const revision=Number.isSafeInteger(parsed.data.application_revision)?parsed.data.application_revision:0;parsed.data={...parsed.data,status,application_revision:incrementRevision?revision+1:revision,updated:now.toISOString().slice(0,10)}; if(reason)parsed.data.close_reason=reason;else if(!['rejected','withdrawn'].includes(status))delete parsed.data.close_reason;return matter.stringify(parsed.content,parsed.data) }
function verifyOutput(file, output, slug, target, kind) { if(kind==='frontmatter'){if(matter(output).data.status!==target)throw new Error(`Post-write verification failed for ${file}`)}else{const checked=updateApplicationIndexLifecycle(output,slug,target,file);if(checked!==output)throw new Error(`Post-write verification failed for ${file}`)} }
export function buildLifecycleOutputs({metadataPath,localIndex,globalIndexes,raws,slug,target,reason=null,now=new Date()}) {
  matter.clearCache();const previous=matter(raws.get(metadataPath)).data.status
  validateTransition(previous,target)
  const outputs=new Map()
  const metadataOut=updateFrontmatter(raws.get(metadataPath),target,reason,now,true)
  verifyOutput(metadataPath,metadataOut,slug,target,'frontmatter');outputs.set(metadataPath,metadataOut)
  const localOut=updateFrontmatter(raws.get(localIndex),target,null,now,false)
  verifyOutput(localIndex,localOut,slug,target,'frontmatter');outputs.set(localIndex,localOut)
  for(const file of globalIndexes){const output=updateApplicationIndexLifecycle(raws.get(file),slug,target,file);verifyOutput(file,output,slug,target,'index');outputs.set(file,output)}
  return {previous,outputs,revision:matter(metadataOut).data.application_revision}
}
export async function transitionApplication({ paths, slug, target, reason, scope = 'active', taskId = 'application-transition', agent = 'nextstep-api', invalidate = () => {}, now = new Date(), deps = {} }) {
  if(!SLUG.test(slug||''))throw Object.assign(new Error('Invalid application slug'),{statusCode:400});if(!LIFECYCLE_STATUSES.includes(target))throw Object.assign(new Error('Invalid application status'),{statusCode:400});if(reason!=null&&(typeof reason!=='string'||reason.length>1000||/[\u0000-\u001f\u007f|]/.test(reason)))throw Object.assign(new Error('Invalid transition reason'),{statusCode:400})
  if((scope==='active'&&target==='archived')||(scope==='archive'&&target!=='archived'))return moveApplicationStorage({paths,slug,scope,target,reason,taskId,agent,invalidate,now,deps})
  const root=scope==='archive'?paths.archiveApplicationsDir:paths.applicationsDir,folder=path.join(root||'',slug),metadataPath=path.join(folder,'metadata.md')
  if(!root||!contained(root,metadataPath))throw Object.assign(new Error('Application path escapes vault root'),{statusCode:400})
  const localIndex=path.join(folder,'index.md'),globalIndexes=[path.join(paths.candidaturesDir||path.dirname(paths.applicationsDir),'index.md'),path.join(paths.applicationsDir,'index.md')],files=[metadataPath,localIndex,...globalIndexes],lockDir=paths.locksDir||path.join(paths.vaultRoot,'.coordination','locks')
  const lease=acquireVaultLocks({vaultRoot:paths.vaultRoot,lockDir,targets:[...files,paths.auditLogPath],agent,taskId,operation:'lifecycle-transition',runTool:deps.lockCommand})
  let primaryError
  try {
    let metadataRaw
    try{metadataRaw=fs.readFileSync(metadataPath,'utf8')}catch(error){throw Object.assign(new Error('Application metadata not found'),{statusCode:error.code==='ENOENT'?404:500})}
    const raws=new Map([[metadataPath,metadataRaw]])
    for(const file of files.slice(1)){try{raws.set(file,fs.readFileSync(file,'utf8'))}catch(error){throw Object.assign(new Error(`Required lifecycle file missing: ${path.basename(file)}`),{statusCode:error.code==='ENOENT'?409:500})}}
    const {previous,outputs}=buildLifecycleOutputs({metadataPath,localIndex,globalIndexes,raws,slug,target,reason,now})
    const auditOriginal=fs.existsSync(paths.auditLogPath)?fs.readFileSync(paths.auditLogPath):Buffer.alloc(0),relative=path.relative(paths.vaultRoot,metadataPath).replaceAll('\\','/')
    outputs.set(paths.auditLogPath,Buffer.concat([Buffer.from(auditOriginal),Buffer.from(`\n- ${now.toISOString()} | ${agent} | ${taskId} | lifecycle-transition | ${relative} | ${previous} -> ${target}${reason?` | reason: ${reason}`:''}\n`)]))
    runVaultTransaction({paths:{...paths,locksDir:lockDir},kind:'lifecycle-transition',context:{scope,slug,target},outputs,lease,deps})
    try{invalidate()}catch{}
    return{slug,previousStatus:previous,status:target,lifecycle:target}
  }catch(error){primaryError=error;throw error}
  finally{lease.releaseAll({suppress:Boolean(primaryError)})}
}

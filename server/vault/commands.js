import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import matter from 'gray-matter'
import { LIFECYCLE_STATUSES, TERMINAL_STATUSES, TRANSITIONS, validateTransition } from './lifecycle.js'
import { buildLifecycleOutputs } from './mutations.js'
import { acquireVaultLocks } from './lockAdapter.js'
import { durableAtomicWrite, recoverVaultTransactions, runVaultTransaction } from './transactionJournal.js'
import { canonicalizeApplicationMetadata, serializeApplicationIndex, serializeApplicationMetadata } from './applicationRecordSchema.js'

const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/
const TYPES=new Set(['application.setPriority','application.setLocation','application.setSource','application.recordReuseAssessment','application.selectDominantNarrative','application.recordSubmission','application.recordEmployerResponse','application.recordInterview','application.addNote','application.transitionStatus','application.repairRecord'])
const PRIORITIES=new Set(['very_high','high','medium','low','none'])
const NARRATIVES=new Set(['AI Transformation Leader','Enterprise Architecture Leader','Platform Engineering / Observability Leader','Digital Delivery Governance Leader','Solution / Consulting Director','Operational Excellence / Services Transformation Leader','Life Sciences Technology Leader'])
const RESPONSE_TYPES=new Set(['acknowledged','rejected','screening','interview','offer','other'])
const INTERVIEW_TYPES=new Set(['recruiter','hiring_manager','technical','panel','case','executive','other'])
function error(message,statusCode=422){throw Object.assign(new Error(message),{statusCode})}
function exact(obj,keys){return obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).length===keys.length&&keys.every(k=>Object.hasOwn(obj,k))}
function text(v,max,label,{nullable=false}={}){if(nullable&&v==null)return null;if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))error(`Invalid ${label}`);return v.trim()}
function date(v,label,{nullable=false}={}){if(nullable&&v==null)return null;if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(v)||Number.isNaN(Date.parse(v)))error(`Invalid ${label}`);return v}
function contained(root,file){const r=path.relative(path.resolve(root),path.resolve(file));return !!r&&!r.startsWith('..')&&!path.isAbsolute(r)}
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value}
function digest(command){return crypto.createHash('sha256').update(JSON.stringify(stable(command))).digest('hex')}
function cacheRoot(paths){return path.join(paths.stateRoot||path.join(paths.vaultRoot,'.nextstep'),'transactions','application-commands')}
function validateEnvelope(c){if(!exact(c,['schemaVersion','commandId','idempotencyKey','expectedRevision','type','payload']))error('Unknown command field');if(c.schemaVersion!==1)error('Unsupported schemaVersion');for(const [k,v] of [['commandId',c.commandId],['idempotencyKey',c.idempotencyKey]])if(typeof v!=='string'||v.length<1||v.length>128||/[\u0000-\u001f\u007f|]/.test(v))error(`Invalid ${k}`);if(!Number.isSafeInteger(c.expectedRevision)||c.expectedRevision<0)error('expectedRevision is required');if(!TYPES.has(c.type))error('Unsupported command type');if(!c.payload||typeof c.payload!=='object'||Array.isArray(c.payload))error('Invalid payload')}
function apply(type,p,d,now){switch(type){
case'application.setPriority':if(!exact(p,['priority'])||!PRIORITIES.has(p.priority))error('Invalid priority');d.priority=p.priority;break
case'application.setLocation':if(!exact(p,['country','location']))error('Invalid location payload');d.country=text(p.country,100,'country',{nullable:true});d.location=text(p.location,200,'location',{nullable:true});break
case'application.setSource':if(!exact(p,['url','reference']))error('Invalid source payload');if(p.url!=null){let u;try{u=new URL(p.url)}catch{error('Invalid source URL')}if(!['http:','https:'].includes(u.protocol))error('Invalid source URL');d.source=u.href}else d.source=text(p.reference,500,'source reference');break
case'application.recordReuseAssessment':if(!exact(p,['reviewed','note','reviewed_at'])||typeof p.reviewed!=='boolean')error('Invalid reuse assessment');d.reuse_assessment={reviewed:p.reviewed,note:p.note==null?null:text(p.note,2000,'note'),reviewed_at:date(p.reviewed_at,'reviewed_at')};break
case'application.selectDominantNarrative':if(!exact(p,['narrative'])||!NARRATIVES.has(p.narrative))error('Invalid dominant narrative');d.dominant_narrative=p.narrative;break
case'application.recordSubmission':{const compatible=exact(p,['occurredAt','channel','note'])||exact(p,['occurredAt','channel','note','artifactVersions']);if(!compatible||(Object.hasOwn(p,'artifactVersions')&&(!p.artifactVersions||Array.isArray(p.artifactVersions)||Object.keys(p.artifactVersions).length)))error('Invalid submission');d.submission={occurred_at:date(p.occurredAt,'occurredAt'),channel:text(p.channel,100,'channel'),note:p.note==null?null:text(p.note,2000,'note'),confirmed:true};break}
case'application.recordEmployerResponse':if(!exact(p,['responseType','occurredAt','note','lifecycleTarget'])||!RESPONSE_TYPES.has(p.responseType))error('Invalid employer response');d.employer_response={type:p.responseType,occurred_at:date(p.occurredAt,'occurredAt'),note:p.note==null?null:text(p.note,2000,'note')};if(p.lifecycleTarget!=null){if(!LIFECYCLE_STATUSES.includes(p.lifecycleTarget))error('Invalid lifecycle target');validateTransition(d.status,p.lifecycleTarget);d.status=p.lifecycleTarget}break
case'application.recordInterview':if(!exact(p,['occurredAt','interviewType','outcome','note','lifecycleTarget'])||!INTERVIEW_TYPES.has(p.interviewType))error('Invalid interview');d.interview={occurred_at:date(p.occurredAt,'occurredAt'),type:p.interviewType,outcome:p.outcome==null?null:text(p.outcome,200,'outcome'),note:p.note==null?null:text(p.note,2000,'note')};if(p.lifecycleTarget!=null){if(!LIFECYCLE_STATUSES.includes(p.lifecycleTarget))error('Invalid lifecycle target');validateTransition(d.status,p.lifecycleTarget);d.status=p.lifecycleTarget}break
case'application.addNote':if(!exact(p,['note']))error('Invalid note payload');d.activity_notes=[...(Array.isArray(d.activity_notes)?d.activity_notes:[]),{at:now.toISOString(),note:text(p.note,4000,'activity note')}];break
case'application.transitionStatus':if(!exact(p,['target','reason'])||!LIFECYCLE_STATUSES.includes(p.target))error('Invalid lifecycle target');validateTransition(d.status,p.target);d.status=p.target;if(p.reason!=null)d.status_reason=text(p.reason,1000,'reason');break
case'application.repairRecord':if(!exact(p,['target'])||!['metadata','index'].includes(p.target))error('Invalid repair target');break}}
export function recoverCommandTransactions({paths,deps={},includeShared=true}){
  const root=cacheRoot(paths)
  if(fs.existsSync(root))for(const name of fs.readdirSync(root)){
    if(!name.endsWith('.journal'))continue
    const file=path.join(root,name);let j
    try{j=JSON.parse(fs.readFileSync(file,'utf8'))}catch{throw new Error('Unsafe command journal')}
    if(j.version!==1||!exact(j.context,['scope','slug'])||!['active','archive'].includes(j.context.scope)||!SLUG.test(j.context.slug)||!Array.isArray(j.preimages))throw new Error('Unsafe command journal')
    const appRoot=j.context.scope==='active'?paths.applicationsDir:paths.archiveApplicationsDir
    const expected=[path.join(appRoot,j.context.slug,'metadata.md'),paths.auditLogPath,path.join(root,'ledger.json')].map(x=>path.relative(paths.vaultRoot,x).replaceAll('\\','/')).sort()
    const actual=j.preimages.map(x=>x?.relative).sort()
    if(new Set(actual).size!==actual.length||JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('Unsafe command journal targets')
    for(const x of j.preimages){const target=path.join(paths.vaultRoot,x.relative);if(!contained(paths.vaultRoot,target)||typeof x.data!=='string')throw new Error('Unsafe command journal path');durableAtomicWrite(fs,target,Buffer.from(x.data,'base64'))}
    fs.rmSync(file,{force:true})
  }
  if(includeShared)recoverVaultTransactions({paths,deps})
}
function ymd(v){return v instanceof Date?v.toISOString().slice(0,10):typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null}
function validIdentity(d,scope){
  if(d.type!==undefined&&d.type!=='application')error('Malformed counterpart',409)
  for(const k of ['company','role'])if(typeof d[k]!=='string'||!d[k].trim()||d[k].length>200)error(`Invalid ${k}`,409)
  if(!LIFECYCLE_STATUSES.includes(d.status))error('Invalid status',409)
  if((scope==='archive')!==(d.status==='archived'))error('Record status conflicts with physical storage scope',409)
}
function repairRecord({paths,slug,scope,command,actor,now,deps,invalidate}){
 const root=scope==='active'?paths.applicationsDir:paths.archiveApplicationsDir,folder=path.join(root,slug),metadata=path.join(folder,'metadata.md'),index=path.join(folder,'index.md'),target=command.payload.target==='metadata'?metadata:index,counterpart=target===metadata?index:metadata
 if(!contained(root,target)||!fs.existsSync(folder))error('Application not found',404)
 const cr=cacheRoot(paths),ledger=path.join(cr,'ledger.json'),audit=paths.auditLogPath,lockDir=paths.locksDir||path.join(paths.vaultRoot,'.coordination','locks')
 const lease=acquireVaultLocks({vaultRoot:paths.vaultRoot,lockDir,targets:[metadata,index,audit,ledger],taskId:`command-${command.commandId}`,operation:'application-repair',runTool:deps.lockCommand});let primary
 try{
  let led;try{led=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):{version:1,entries:{}}}catch{error('Invalid command ledger',409)}
  if(led.version!==1||!led.entries||typeof led.entries!=='object')error('Invalid command ledger',409)
  const key=`${scope}/${slug}/${command.idempotencyKey}`,dg=digest({scope,slug,command}),prior=led.entries[key]
  if(prior){if(prior.digest!==dg)error('Idempotency key conflict',409);return prior.result}
  if(fs.existsSync(target))error('Repair target already exists',409);if(!fs.existsSync(counterpart))error('Repair counterpart is missing',409)
  let parsed;try{matter.clearCache();parsed=matter(fs.readFileSync(counterpart,'utf8'));}catch{error('Malformed counterpart',409)}
  const d=structuredClone(parsed.data);let outputs=new Map(),revision
  if(target===metadata){
   // The sole legacy derivation without an explicit role is the validated migration rule.
   if((typeof d.role!=='string'||!d.role.trim())&&slug==='wonderfulai-technical-interview'&&scope==='archive'&&d.company==='WonderfulAI'&&d.status==='archived'&&ymd(d.created)==='2026-07-22'&&ymd(d.updated)==='2026-08-05')d.role='Technical Interview'
   validIdentity(d,scope);if(!ymd(d.created)||!ymd(d.updated))error('Insufficient provenance for metadata repair',409)
   if(command.expectedRevision!==0)error('Stale application revision',412)
   const seed={...d,application_revision:1,storage_scope:scope,migration:d.migration||{name:'normalize-records-v2',source:'index.md'}};delete seed.type;delete seed.schema_version
   const canonical=canonicalizeApplicationMetadata(seed,{company:d.company,role:d.role,status:d.status,scope})
   outputs.set(metadata,serializeApplicationMetadata(canonical));outputs.set(index,fs.readFileSync(index));revision=1;Object.assign(d,canonical)
  }else{
   validIdentity(d,scope);const before=Number.isSafeInteger(d.application_revision)?d.application_revision:0
   if(command.expectedRevision!==before)error('Stale application revision',412)
   const canonical=canonicalizeApplicationMetadata({...d,application_revision:before+1,updated:now.toISOString().slice(0,10)},{company:d.company,role:d.role,status:d.status,scope})
   outputs.set(metadata,serializeApplicationMetadata(canonical)+parsed.content)
   outputs.set(index,serializeApplicationIndex({},`# ${canonical.company} — ${canonical.role}\n`,{application:slug,status:canonical.status,scope,date:canonical.updated}));revision=before+1;Object.assign(d,canonical)
  }
  const result={slug,scope,commandId:command.commandId,type:command.type,target:command.payload.target,revision,previousRevision:target===metadata?0:revision-1,status:d.status,allowedTransitions:[...(TRANSITIONS[d.status]||[])]}
  led.entries[key]={digest:dg,result};outputs.set(ledger,JSON.stringify(led));const old=fs.existsSync(audit)?fs.readFileSync(audit):Buffer.alloc(0),rel=path.relative(paths.vaultRoot,target).replaceAll('\\','/')
  outputs.set(audit,Buffer.concat([old,Buffer.from(`\n- ${now.toISOString()} | ${text(actor,100,'actor')} | command ${command.commandId} | application.repairRecord | target ${rel}\n`)]))
  runVaultTransaction({paths:{...paths,locksDir:lockDir},kind:'application-repair',context:{scope,slug,commandId:command.commandId,target:command.payload.target},outputs,lease,deps});try{invalidate()}catch{};return result
 }catch(e){primary=e;throw e}finally{lease.releaseAll({suppress:Boolean(primary)})}
}
export function executeApplicationCommand({paths,slug,scope,command,actor='local-user',invalidate=()=>{},now=new Date(),deps={}}){
  validateEnvelope(command)
  if(!SLUG.test(slug)||!['active','archive'].includes(scope))error('Explicit valid scope is required',422)
  if(command.type==='application.repairRecord')return repairRecord({paths,slug,scope,command,actor,now,deps,invalidate})
  const root=scope==='active'?paths.applicationsDir:paths.archiveApplicationsDir,folder=path.join(root,slug),metadata=path.join(folder,'metadata.md')
  if(!contained(root,metadata))error('Application not found',404)
  const cr=cacheRoot(paths),ledger=path.join(cr,'ledger.json'),audit=paths.auditLogPath
  const lifecycleTarget=command.type==='application.recordSubmission'?'applied':(['application.recordEmployerResponse','application.recordInterview'].includes(command.type)?command.payload.lifecycleTarget:null)
  if(lifecycleTarget!=null&&!LIFECYCLE_STATUSES.includes(lifecycleTarget))error('Invalid lifecycle target')
  const localIndex=path.join(folder,'index.md'),globalIndexes=[path.join(paths.candidaturesDir||path.dirname(paths.applicationsDir),'index.md'),path.join(paths.applicationsDir,'index.md')]
  const lifecycleFiles=lifecycleTarget?[metadata,localIndex,...globalIndexes]:[metadata]
  const artifactFiles=command.type==='application.recordSubmission'?['cv.md','cover-letter.md'].map(name=>path.join(folder,name)):[]
  const lockDir=paths.locksDir||path.join(paths.vaultRoot,'.coordination','locks')
  const lease=acquireVaultLocks({vaultRoot:paths.vaultRoot,lockDir,targets:[...lifecycleFiles,...artifactFiles,ledger,audit].sort(),taskId:`command-${command.commandId}`,operation:'application-command',runTool:deps.lockCommand})
  let primary
  try{
    if(!fs.existsSync(metadata))error('Application not found',404)
    const led=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):{version:1,entries:{}}
    const ledgerKey=`${scope}/${slug}/${command.idempotencyKey}`,dg=digest({scope,slug,command}),prior=led.entries[ledgerKey]
    if(prior){if(prior.digest!==dg)error('Idempotency key conflict',409);return prior.result}
    const raw=fs.readFileSync(metadata,'utf8');matter.clearCache();const parsed=matter(raw);parsed.data=structuredClone(parsed.data)
    const before=Number.isSafeInteger(parsed.data.application_revision)?parsed.data.application_revision:0
    if(before!==command.expectedRevision)error('Stale application revision',412)
    if(scope==='archive'&&fs.existsSync(path.join(folder,'legacy-files')))error('Legacy archive is read-only',409)
    if(TERMINAL_STATUSES.has(parsed.data.status)&&!['application.addNote','application.transitionStatus'].includes(command.type))error('Terminal application is read-only',409)
    const oldStatus=parsed.data.status
    if(command.type==='application.recordSubmission'&&oldStatus!=='applied')validateTransition(oldStatus,'applied')
    apply(command.type,command.payload,parsed.data,now)
    if(command.type==='application.recordSubmission'){
      const artifacts={}
      for(const file of artifactFiles)if(fs.existsSync(file)){const content=fs.readFileSync(file);const stat=fs.statSync(file);artifacts[path.basename(file,'.md')]={file:path.basename(file),sha256:crypto.createHash('sha256').update(content).digest('hex'),revision:`${Math.trunc(stat.mtimeMs)}-${crypto.createHash('sha256').update(content).digest('hex')}`,capturedAt:now.toISOString()}}
      parsed.data.submission.snapshot={capturedAt:now.toISOString(),artifacts};parsed.data.status='applied'
    }
    parsed.data.application_revision=before+1;parsed.data.updated=now.toISOString().slice(0,10)
    const outputs=new Map(),targetStatus=parsed.data.status
    if(lifecycleTarget&&oldStatus!==targetStatus){
      const raws=new Map([[metadata,raw]])
      for(const file of [localIndex,...globalIndexes]){if(!fs.existsSync(file))error(`Required lifecycle file missing: ${path.basename(file)}`,409);raws.set(file,fs.readFileSync(file,'utf8'))}
      const built=buildLifecycleOutputs({metadataPath:metadata,localIndex,globalIndexes,raws,slug,target:targetStatus,now})
      const lifecycleParsed=matter(built.outputs.get(metadata));lifecycleParsed.data={...parsed.data,application_revision:before+1};outputs.set(metadata,matter.stringify(lifecycleParsed.content,lifecycleParsed.data))
      for(const [file,value] of built.outputs)if(file!==metadata)outputs.set(file,value)
    }else outputs.set(metadata,matter.stringify(parsed.content,parsed.data))
    const auditOld=fs.existsSync(audit)?fs.readFileSync(audit):Buffer.alloc(0)
    const result={slug,scope,commandId:command.commandId,type:command.type,revision:before+1,previousRevision:before,status:targetStatus,allowedTransitions:[...(TRANSITIONS[targetStatus]||[])]}
    led.entries[ledgerKey]={digest:dg,result}
    const auditOut=Buffer.concat([auditOld,Buffer.from(`\n- ${now.toISOString()} | ${actor} | command ${command.commandId} | ${command.type} | revision ${before} -> ${before+1} | files: ${path.relative(paths.vaultRoot,metadata).replaceAll('\\','/')} | status ${oldStatus??'unset'} -> ${targetStatus??'unset'}\n`)])
    outputs.set(audit,auditOut);outputs.set(ledger,JSON.stringify(led))
    runVaultTransaction({paths:{...paths,locksDir:lockDir},kind:'application-command',context:{scope,slug,commandId:command.commandId,lifecycle:Boolean(lifecycleTarget&&oldStatus!==targetStatus)},outputs,lease,deps})
    // Index removal is explicitly post-commit maintenance. A disposable index
    // failure must never make a durable command look rolled back to its caller;
    // the next load detects the changed source manifest and rebuilds it.
    try { invalidate() } catch {}
    return result
  }catch(errorValue){primary=errorValue;throw errorValue}
  finally{lease.releaseAll({suppress:Boolean(primary)})}
}

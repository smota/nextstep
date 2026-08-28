import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import matter from 'gray-matter'
import { readApplicationDocument } from '../vault/documents.js'
import { acquireVaultLocks, canonicalLockManifest, canonicalVaultIdentity } from '../vault/lockAdapter.js'
import { runVaultTransaction } from '../vault/transactionJournal.js'
import { serializeApplicationIndex, serializeApplicationMetadata } from '../vault/applicationRecordSchema.js'

export const FINAL_PAYLOAD_SCHEMA = Object.freeze({
 type:'object',additionalProperties:false,required:['status','summary','artifacts','blockers','next_recommended_action'],
 properties:{
  status:{type:'string',enum:['completed','blocked','failed']},
  summary:{type:'string',maxLength:4000},
  artifacts:{type:'array',maxItems:2,items:{type:'object',additionalProperties:false,required:['artifact','content'],properties:{artifact:{type:'string',enum:['jobDescription','fitAnalysis','cv','coverLetter','interviewPrep']},content:{type:'string',maxLength:250000}}}},
  blockers:{type:'array',maxItems:20,items:{type:'string',maxLength:1000}},
  next_recommended_action:{type:['string','null'],maxLength:1000}
 }
})
const START='<<<FINAL_JSON>>>'; const END='<<<END_FINAL_JSON>>>'; const MAX=512*1024
const DANGEROUS=new Set(['__proto__','prototype','constructor','path','filename','frontmatter','profile','status_frontmatter'])
const ALLOWED=Object.freeze({'position-analysis':[],'generate-fit-analysis':['fitAnalysis'],'create-application-analysis':['jobDescription','fitAnalysis'],'create-cv':['cv'],'generate-cover-letter':['coverLetter'],'interview-prep':['interviewPrep'],'review-pipeline':[]})
function fail(message){throw Object.assign(new Error(`Invalid final payload: ${message}`),{statusCode:422})}
function plainObject(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype}
function exact(obj,keys){return plainObject(obj)&&Object.keys(obj).length===keys.length&&keys.every(k=>Object.hasOwn(obj,k))}
function cleanString(x,max,label){if(typeof x!=='string'||x.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x))fail(`${label} is invalid`)}
function inspect(value){if(!value||typeof value!=='object')return;for(const key of Object.keys(value)){if(DANGEROUS.has(key))fail(`forbidden key ${key}`);inspect(value[key])}}
function exactEnvelopeText(value){
 if(typeof value!=='string')fail('harness result text is invalid')
 const text=value.trim()
 if(!text.startsWith(START)||!text.endsWith(END))fail('harness result must contain only the delimited payload')
 return text
}
export function normalizeHarnessOutput(output,harnessId){
 const raw=String(output??'');if(Buffer.byteLength(raw)>MAX)fail('output exceeds limit')
 if(harnessId==='claude'){
  let result;try{result=JSON.parse(raw)}catch{fail('malformed Claude JSON output')}
  if(!plainObject(result)||result.type!=='result'||result.subtype!=='success'||result.is_error!==false)fail('unexpected Claude JSON output')
  return exactEnvelopeText(result.result)
 }
 if(harnessId==='codex'){
  const lines=raw.split(/\r?\n/).filter(line=>line.trim());if(!lines.length)fail('empty Codex JSONL output')
  const messages=[]
  for(const line of lines){let event;try{event=JSON.parse(line)}catch{fail('malformed Codex JSONL output')};if(!plainObject(event)||typeof event.type!=='string')fail('unexpected Codex JSONL event');if(event.type==='item.completed'&&plainObject(event.item)&&event.item.type==='agent_message'&&typeof event.item.text==='string'&&event.item.text.includes(START))messages.push(event.item.text)}
  if(messages.length!==1)fail('exactly one Codex final agent message is required')
  return exactEnvelopeText(messages[0])
 }
 return raw
}
export function parseFinalPayload(output,actionId,{existingSlug=false}={}){
 const raw=String(output??'');if(Buffer.byteLength(raw)>MAX)fail('output exceeds limit')
 const starts=raw.split(START).length-1,ends=raw.split(END).length-1;if(starts!==1||ends!==1)fail('exactly one explicitly delimited payload is required')
 const a=raw.indexOf(START)+START.length,b=raw.indexOf(END);if(b<a)fail('delimiter order');const json=raw.slice(a,b).trim();if(!json)fail('empty payload')
 let value;try{value=JSON.parse(json)}catch{fail('malformed JSON')}inspect(value)
 const keys=['status','summary','artifacts','blockers','next_recommended_action'];if(!exact(value,keys))fail('top-level keys must match schema exactly')
 if(!['completed','blocked','failed'].includes(value.status))fail('status');cleanString(value.summary,4000,'summary');if(!Array.isArray(value.artifacts)||value.artifacts.length>2)fail('artifacts');if(!Array.isArray(value.blockers)||value.blockers.length>20)fail('blockers');value.blockers.forEach(x=>cleanString(x,1000,'blocker'));if(value.next_recommended_action!==null)cleanString(value.next_recommended_action,1000,'next action')
 const allowed=ALLOWED[actionId];if(!allowed)fail('unknown action')
 const seen=new Set();for(const item of value.artifacts){if(!exact(item,['artifact','content']))fail('artifact keys');if(!allowed.includes(item.artifact)||seen.has(item.artifact))fail('artifact not allowed for action');seen.add(item.artifact);cleanString(item.content,250000,'artifact content')}
 if(value.status==='completed'&&actionId!=='review-pipeline'&&actionId!=='position-analysis'&&seen.size!==allowed.length)fail('completed payload is missing required artifacts')
 return value
}
function link(slug,saved){const q=new URLSearchParams();if(saved.version)q.set('version',saved.version);const suffix=q.size?`?${q}`:'';return {path:`Candidatures/applications/${slug}/${saved.filename}`,label:saved.filename,url:`/api/vault/documents/active/${slug}/${saved.artifact}${suffix}`,artifact:saved.artifact,version:saved.version||null,revision:saved.revision}}
const FILES=Object.freeze({jobDescription:'job-description.md',fitAnalysis:'fit-analysis.md',cv:'cv.md',coverLetter:'cover-letter.md',interviewPrep:'interview-prep.md'})
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/
function contained(root,file){const r=path.relative(path.resolve(root),path.resolve(file));return r&&!r.startsWith('..')&&!path.isAbsolute(r)}
function revision(content){return crypto.createHash('sha256').update(content).digest('hex')}
function verifiedLink(slug,artifact,filename,content){return link(slug,{artifact,filename,revision:revision(content),version:null})}
function section(raw,heading,label){const hits=[...raw.matchAll(new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*$`,'gm'))];if(hits.length!==1)throw Object.assign(new Error(`${label} must contain exactly one ${heading} section; found ${hits.length}`),{statusCode:409});return hits[0]}
function insertPipelineRow(raw,{slug,company,role}){if(raw.includes(slug))throw Object.assign(new Error(`Candidatures index already references ${slug}`),{statusCode:409});const h=section(raw,'## Active Pipeline','Candidatures index'),start=h.index+h[0].length,next=raw.indexOf('\n## ',start),bodyEnd=next<0?raw.length:next,body=raw.slice(start,bodyEnd),delimiter=/^\|(?:---|:--)[^\n]*\|\s*$/gm,matches=[...body.matchAll(delimiter)];if(matches.length!==1)throw Object.assign(new Error('Candidatures index Active Pipeline table is missing or ambiguous'),{statusCode:409});const at=start+matches[0].index+matches[0][0].length;return raw.slice(0,at)+`\n| ${company} | ${role} | identified |  | Validation intentionally partial | [[applications/${slug}/index|open]] |`+raw.slice(at)}
function insertIdentified(raw,{slug,company,role}){if(raw.includes(slug))throw Object.assign(new Error(`Applications index already references ${slug}`),{statusCode:409});const h=section(raw,'## identified','Applications index'),at=h.index+h[0].length;return raw.slice(0,at)+`\n\n- [[${slug}/index|${company} — ${role}]] — identified; source validation and reuse assessment intentionally partial`+raw.slice(at)}
function acquireAll(paths,artifacts,deps,taskId,operation='create-artifact'){return acquireVaultLocks({vaultRoot:paths.vaultRoot,lockDir:paths.locksDir||path.join(paths.vaultRoot,'.coordination','locks'),targets:artifacts,agent:'nextstep-api',taskId,operation,runTool:deps.lockCommand})}
function releaseAll(lock,paths,primary){lock.releaseAll({suppress:Boolean(primary)})}
export function createBackendDocuments({slug,company,role,source,now=new Date()}){const clean=x=>String(x).replace(/[\r\n]/g,' ').trim(),date=now.toISOString().slice(0,10),metadata=serializeApplicationMetadata({priority:'medium',job_description:'[[job-description]]',fit_analysis:'[[fit-analysis]]',cv:'[[cv]]',cover_letter:'[[cover-letter]]',company_profile:'[[company-profile]]',source:source||'user intake',source_validation:'partial',reuse_state:'partial'},{company,role,status:'identified',scope:'active',date}),body=`# ${clean(role)} at ${clean(company)}\n\n- Status: identified\n- [[job-description|Job description]]\n- [[fit-analysis|Fit analysis]]\n`;return {metadata,index:serializeApplicationIndex({},body,{application:slug,status:'identified',scope:'active',date})}}
function syncFile(io,file){const fd=io.openSync(file,'r+');try{io.fsyncSync(fd)}finally{io.closeSync(fd)}}
function syncDir(io,dir){let fd;try{fd=io.openSync(dir,'r');io.fsyncSync(fd)}catch(error){if(process.platform!=='win32'||error.code!=='EPERM')throw error}finally{if(fd!==undefined)io.closeSync(fd)}}
function durableWrite(io,file,data,flag='wx'){io.writeFileSync(file,data,{flag});syncFile(io,file)}
function atomicRestore(io,target,data,txDir){const temp=path.join(path.dirname(target),`.recover-${path.basename(target)}-${crypto.randomUUID()}`);durableWrite(io,temp,data);io.renameSync(temp,target);syncDir(io,path.dirname(target))}
const stateRoot=paths=>paths.stateRoot||path.join(paths.vaultRoot,'.nextstep')
function txRoot(paths){return path.join(stateRoot(paths),'transactions','application-artifacts')}
export function applyReceiptPath(paths,runId){if(!/^[0-9a-f-]{36}$/i.test(runId||''))throw new Error('Invalid run receipt ID');return path.join(stateRoot(paths),'receipts',`${runId}.json`)}
export function hashApplyKey(value){return crypto.createHash('sha256').update(String(value)).digest('hex')}
export function hashApplyIntent({expectedRevision,stageDigest,actionId,application}){return crypto.createHash('sha256').update(JSON.stringify({expectedRevision,stageDigest,actionId,slug:application?.slug||null,scope:application?.scope||null})).digest('hex')}
function validReceipt(value,runId){return value&&value.version===1&&value.runId===runId&&/^[a-f0-9]{64}$/.test(value.keyHash||'')&&/^[a-f0-9]{64}$/.test(value.intentDigest||'')&&value.intentDigest===hashApplyIntent(value)&&/^[a-f0-9]{64}$/.test(value.stageDigest||'')&&Number.isSafeInteger(value.expectedRevision)&&Number.isSafeInteger(value.resultingRevision)&&Array.isArray(value.artifactLinks)}
export function readApplyReceipt(paths,runId){const file=applyReceiptPath(paths,runId);if(!fs.existsSync(file))return null;let value;try{value=JSON.parse(fs.readFileSync(file,'utf8'))}catch{throw new Error('Invalid durable apply receipt')};if(!validReceipt(value,runId))throw new Error('Invalid durable apply receipt');return value}
function safeJournal(value){return value&&value.version===1&&/^[a-f0-9-]{36}$/.test(value.id)&&SLUG.test(value.slug)&&['prepared','folder','candidatures','applications','audit','receipt','committed'].includes(value.state)&&Array.isArray(value.manifest)&&JSON.stringify(value.manifest)===JSON.stringify([...new Set(value.manifest)].sort())}
function writeJournal(io,file,journal){const temp=`${file}.tmp`;io.writeFileSync(temp,JSON.stringify(journal),{flag:'w'});syncFile(io,temp);io.renameSync(temp,file);syncDir(io,path.dirname(file))}
export function recoverApplicationTransactions({paths,deps={}}){const io={...fs,...deps.io},root=txRoot(paths);if(!io.existsSync(root))return;for(const name of io.readdirSync(root)){if(!name.endsWith('.json'))continue;const journalFile=path.join(root,name);let j;try{j=JSON.parse(io.readFileSync(journalFile,'utf8'))}catch{throw new Error(`Invalid application transaction journal: ${name}`)}if(!safeJournal(j)||name!==`${j.id}.json`)throw new Error(`Unsafe application transaction journal: ${name}`);const folder=path.join(paths.applicationsDir,j.slug),work=path.join(root,j.id),receipt=j.receiptRunId?applyReceiptPath(paths,j.receiptRunId):null;if(!contained(paths.applicationsDir,folder)||!contained(root,work))throw new Error('Transaction journal path escapes managed roots');const expected=canonicalLockManifest(paths.vaultRoot,[folder,...['metadata.md','index.md','job-description.md','fit-analysis.md'].map(x=>path.join(folder,x)),path.join(paths.candidaturesDir||path.dirname(paths.applicationsDir),'index.md'),path.join(paths.applicationsDir,'index.md'),paths.auditLogPath,...(receipt?[receipt]:[])]);if(JSON.stringify(expected)!==JSON.stringify(j.manifest))throw new Error(`Unsafe application transaction manifest: ${name}`);const lock=acquireAll(paths,j.manifest,deps,`recover-create-${j.slug}`,'application-create-recovery');let primary;try{if(j.state!=='committed'){for(const [target,key] of [[path.join(paths.candidaturesDir||path.dirname(paths.applicationsDir),'index.md'),'candidatures'],[path.join(paths.applicationsDir,'index.md'),'applications'],[paths.auditLogPath,'audit']]){const backup=path.join(work,`${key}.bak`);if(io.existsSync(backup))atomicRestore(io,target,io.readFileSync(backup),work)}io.rmSync(folder,{recursive:true,force:true});if(receipt)io.rmSync(receipt,{force:true});syncDir(io,paths.applicationsDir)}io.rmSync(work,{recursive:true,force:true});io.rmSync(journalFile,{force:true});syncDir(io,root)}catch(error){primary=error;throw error}finally{releaseAll(lock,paths,primary)}}}
function makeApplyReceipt({runId,keyHash,stageDigest,expectedRevision,resultingRevision,actionId,application,artifactLinks,now}){
 const value={version:1,runId,keyHash,intentDigest:hashApplyIntent({expectedRevision,stageDigest,actionId,application}),stageDigest,expectedRevision,resultingRevision,actionId,application,artifactLinks,committedAt:now.toISOString()}
 if(!validReceipt(value,runId))throw new Error('Invalid apply receipt context')
 return value
}
function sameReceipt(receipt,context){return receipt.keyHash===context.keyHash&&receipt.intentDigest===hashApplyIntent(context)&&receipt.stageDigest===context.stageDigest&&receipt.expectedRevision===context.expectedRevision&&receipt.actionId===context.actionId&&receipt.application?.slug===context.application?.slug&&receipt.application?.scope===context.application?.scope}
export function createApplicationArtifacts({paths,slug,company,role,source,payload,artifactNames,payloadReader,invalidate=()=>{},now=new Date(),applyContext=null,deps={}}){
 if(!SLUG.test(slug||''))throw Object.assign(new Error('Invalid application slug'),{statusCode:400})
 for(const value of [company,role])if(typeof value!=='string'||!value.trim()||/[\r\n|]/.test(value))throw Object.assign(new Error('Invalid application metadata'),{statusCode:400})
 const io={...fs,...deps.io},folder=path.join(paths.applicationsDir,slug)
 if(!contained(paths.applicationsDir,folder))throw Object.assign(new Error('Application path escapes applications root'),{statusCode:400})
 const names=artifactNames||payload?.artifacts?.map(item=>item.artifact)||[]
 if(names.length!==2||!names.includes('jobDescription')||!names.includes('fitAnalysis'))throw new Error('New application requires job description and fit analysis')
 const cIndex=path.join(paths.candidaturesDir||path.dirname(paths.applicationsDir),'index.md'),aIndex=path.join(paths.applicationsDir,'index.md'),receiptFile=applyContext?applyReceiptPath(paths,applyContext.runId):null
 const targets=[folder,...['metadata.md','index.md','job-description.md','fit-analysis.md'].map(x=>path.join(folder,x)),cIndex,aIndex,paths.auditLogPath,...(receiptFile?[receiptFile]:[])]
 const manifest=canonicalLockManifest(paths.vaultRoot,targets),lock=acquireAll(paths,manifest,deps,'create-application-analysis')
 let primary,journalFile,journal,workPath
 try{
  if(receiptFile&&io.existsSync(receiptFile)){const prior=readApplyReceipt(paths,applyContext.runId);if(sameReceipt(prior,applyContext))return {links:prior.artifactLinks,resultingRevision:prior.resultingRevision,receipt:prior,idempotent:true};throw Object.assign(new Error('Apply idempotency key conflict'),{statusCode:409})}
  if(io.existsSync(folder))throw Object.assign(new Error('Application slug already exists'),{statusCode:409})
  const loaded=payloadReader?payloadReader():payload,wanted=new Map(loaded?.artifacts?.map(x=>[x.artifact,x.content])||[])
  if(wanted.size!==2||!wanted.has('jobDescription')||!wanted.has('fitAnalysis'))throw Object.assign(new Error('Staged artifacts do not match locked targets'),{statusCode:409})
  const originals={candidatures:io.readFileSync(cIndex),applications:io.readFileSync(aIndex),audit:io.existsSync(paths.auditLogPath)?io.readFileSync(paths.auditLogPath):Buffer.alloc(0)}
  const cOut=insertPipelineRow(String(originals.candidatures),{slug,company:company.trim(),role:role.trim()}),aOut=insertIdentified(String(originals.applications),{slug,company:company.trim(),role:role.trim()}),auditOut=Buffer.concat([originals.audit,Buffer.from(`\n- ${now.toISOString()} | nextstep-api | create-application-analysis | Candidatures/applications/${slug} | crash-recoverable transaction\n`)]),docs=createBackendDocuments({slug,company,role,source,now})
  const links=[...wanted].map(([artifact,content])=>verifiedLink(slug,artifact,FILES[artifact],content)),receipt=applyContext?makeApplyReceipt({...applyContext,resultingRevision:0,artifactLinks:links,now}):null
  const root=txRoot(paths),id=crypto.randomUUID(),work=path.join(root,id),tempFolder=path.join(work,'folder');workPath=work;io.mkdirSync(tempFolder,{recursive:true})
  for(const [key,data] of Object.entries(originals))durableWrite(io,path.join(work,`${key}.bak`),data)
  for(const [name,content] of Object.entries({'metadata.md':docs.metadata,'index.md':docs.index,'job-description.md':wanted.get('jobDescription'),'fit-analysis.md':wanted.get('fitAnalysis')}))durableWrite(io,path.join(tempFolder,name),content)
  for(const [key,data] of [['candidatures',cOut],['applications',aOut],['audit',auditOut]])durableWrite(io,path.join(work,`${key}.new`),data)
  if(receipt)durableWrite(io,path.join(work,'receipt.new'),`${JSON.stringify(receipt)}\n`)
  syncDir(io,tempFolder);syncDir(io,work)
  journal={version:1,id,slug,state:'prepared',manifest,receiptRunId:applyContext?.runId||null};journalFile=path.join(root,`${id}.json`);writeJournal(io,journalFile,journal);deps.afterStep?.('prepared')
  io.renameSync(tempFolder,folder);syncDir(io,paths.applicationsDir);journal.state='folder';writeJournal(io,journalFile,journal);deps.afterStep?.('folder')
  for(const [state,target] of [['candidatures',cIndex],['applications',aIndex],['audit',paths.auditLogPath]]){io.renameSync(path.join(work,`${state}.new`),target);syncDir(io,path.dirname(target));journal.state=state;writeJournal(io,journalFile,journal);lock.heartbeatAll();deps.afterStep?.(state)}
  if(receipt){io.mkdirSync(path.dirname(receiptFile),{recursive:true});io.renameSync(path.join(work,'receipt.new'),receiptFile);syncDir(io,path.dirname(receiptFile));journal.state='receipt';writeJournal(io,journalFile,journal);deps.afterStep?.('receipt')}
  journal.state='committed';writeJournal(io,journalFile,journal);deps.afterStep?.('committed');io.rmSync(work,{recursive:true,force:true});io.rmSync(journalFile,{force:true});syncDir(io,root)
  try{invalidate()}catch{}
  return applyContext?{links,resultingRevision:0,receipt}:links
 }catch(error){
  primary=error
  if(!error.simulatedCrash)try{
   if(journalFile&&io.existsSync(journalFile)){
    if(journal?.state!=='committed'){
     for(const [target,key] of [[cIndex,'candidatures'],[aIndex,'applications'],[paths.auditLogPath,'audit']]){const backup=path.join(workPath,`${key}.bak`);if(io.existsSync(backup))atomicRestore(io,target,io.readFileSync(backup),workPath)}
     io.rmSync(folder,{recursive:true,force:true});if(receiptFile)io.rmSync(receiptFile,{force:true})
    }
    io.rmSync(workPath,{recursive:true,force:true});io.rmSync(journalFile,{force:true})
   }else if(workPath)io.rmSync(workPath,{recursive:true,force:true})
  }catch{}
  throw error
 }finally{releaseAll(lock,paths,primary)}
}
const PROTECTED_APPLY_STATES=new Set(['applied','recruiter_screen','interview','offer','rejected','withdrawn','archived'])
function followUpName(artifact,now){return `${artifact}-follow-up-${now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')}.md`}
export function applyExistingArtifacts({paths,slug,payload,artifactNames,payloadReader,expectedRevision,applyContext=null,invalidate=()=>{},now=new Date(),deps={}}){
 if(!SLUG.test(slug||''))throw Object.assign(new Error('Invalid application slug'),{statusCode:400})
 const names=artifactNames||payload?.artifacts?.map(item=>item.artifact)||[]
 if(!names.length||new Set(names).size!==names.length||names.some(name=>!FILES[name]))throw Object.assign(new Error('Invalid artifact apply targets'),{statusCode:400})
 const folder=path.join(paths.applicationsDir,slug),metadata=path.join(folder,'metadata.md'),receiptFile=applyContext?applyReceiptPath(paths,applyContext.runId):null
 const candidates=names.flatMap(name=>[path.join(folder,FILES[name]),path.join(folder,followUpName(name,now))])
 const lock=acquireAll(paths,[metadata,...candidates,paths.auditLogPath,...(receiptFile?[receiptFile]:[])],deps,`apply-${applyContext?.runId||slug}`,'artifact-apply')
 let primary
 try{
  if(receiptFile&&fs.existsSync(receiptFile)){const prior=readApplyReceipt(paths,applyContext.runId);if(sameReceipt(prior,applyContext))return {links:prior.artifactLinks,resultingRevision:prior.resultingRevision,receipt:prior,idempotent:true};throw Object.assign(new Error('Apply idempotency key conflict'),{statusCode:409})}
  if(!fs.existsSync(metadata))throw Object.assign(new Error('Governed application target unavailable'),{statusCode:404})
  const metadataRaw=fs.readFileSync(metadata,'utf8');matter.clearCache();const parsed=matter(metadataRaw),currentRevision=Number.isSafeInteger(parsed.data.application_revision)?parsed.data.application_revision:0,wantedRevision=expectedRevision??applyContext?.expectedRevision??currentRevision
  if(currentRevision!==wantedRevision||applyContext&&currentRevision!==applyContext.expectedRevision)throw Object.assign(new Error('Stale application revision'),{statusCode:412})
  const loaded=payloadReader?payloadReader():payload,items=loaded?.artifacts
  if(!Array.isArray(items)||items.length!==names.length||items.some((item,index)=>item.artifact!==names[index]||typeof item.content!=='string'))throw Object.assign(new Error('Staged artifacts do not match locked targets'),{statusCode:409})
  const outputs=new Map(),links=[]
  for(const item of items){const canonical=path.join(folder,FILES[item.artifact]),protectedTarget=PROTECTED_APPLY_STATES.has(parsed.data.status)&&['cv','coverLetter'].includes(item.artifact),target=protectedTarget?path.join(folder,followUpName(item.artifact,now)):canonical;if(protectedTarget&&fs.existsSync(target))throw Object.assign(new Error('Follow-up artifact already exists'),{statusCode:409});outputs.set(target,item.content);links.push(verifiedLink(slug,item.artifact,path.basename(target),item.content));if(protectedTarget){links.at(-1).version=path.basename(target,'.md');links.at(-1).url=`/api/vault/documents/active/${slug}/${item.artifact}?${new URLSearchParams({version:links.at(-1).version})}`}}
  parsed.data={...parsed.data,application_revision:currentRevision+1,updated:now.toISOString().slice(0,10)};const metadataOutput=matter.stringify(parsed.content,parsed.data);matter.clearCache();outputs.set(metadata,metadataOutput)
  const auditOld=fs.existsSync(paths.auditLogPath)?fs.readFileSync(paths.auditLogPath):Buffer.alloc(0),files=[...outputs.keys()].filter(file=>file!==metadata).map(file=>canonicalVaultIdentity(paths.vaultRoot,file)).join(', ');outputs.set(paths.auditLogPath,Buffer.concat([Buffer.from(auditOld),Buffer.from(`\n- ${now.toISOString()} | nextstep-api | artifact-apply | ${slug} | revision ${currentRevision} -> ${currentRevision+1} | files: ${files}\n`)]))
  const receipt=applyContext?makeApplyReceipt({...applyContext,resultingRevision:currentRevision+1,artifactLinks:links,now}):null;if(receipt)outputs.set(receiptFile,`${JSON.stringify(receipt)}\n`)
  runVaultTransaction({paths,kind:'artifact-apply',context:{slug,runId:applyContext?.runId||null,expectedRevision:wantedRevision,targets:links.map(link=>({artifact:link.artifact,version:link.version||null}))},outputs,lease:lock,deps})
  try{invalidate()}catch{}
  return applyContext?{links,resultingRevision:currentRevision+1,receipt}:links
 }catch(error){primary=error;throw error}finally{releaseAll(lock,paths,primary)}
}
export const FINAL_PAYLOAD_DELIMITERS=Object.freeze({start:START,end:END})

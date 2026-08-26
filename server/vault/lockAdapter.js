import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const SLUG = value => path.posix.basename(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'artifact'
const fail = message => Object.assign(new Error(message), { statusCode: 423 })

function realRoot(vaultRoot) { try { return fs.realpathSync(path.resolve(vaultRoot)) } catch { throw fail('Canonical vault root is unavailable') } }
function within(root, candidate) { const relative=path.relative(root,candidate); return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative) }
function verifyPhysicalContainment(root, absolute) {
  let cursor=absolute
  while (!fs.existsSync(cursor)) { const parent=path.dirname(cursor); if(parent===cursor)throw fail('Vault target has no existing parent'); cursor=parent }
  const stat=fs.lstatSync(cursor)
  if (stat.isSymbolicLink()) throw fail('Vault target symlink or junction alias is forbidden')
  const resolved=fs.realpathSync(cursor)
  if (resolved!==root && !within(root,resolved)) throw fail('Vault target resolves outside the vault')
  let child=absolute
  while(child!==cursor){const parent=path.dirname(child);if(parent===child)break;child=parent;if(fs.existsSync(child)){const s=fs.lstatSync(child);if(s.isSymbolicLink())throw fail('Vault target symlink or junction alias is forbidden')}}
}

export function canonicalVaultIdentity(vaultRoot, candidate) {
  if (typeof candidate !== 'string' || !candidate || candidate.includes('\0')) throw Object.assign(new Error('Invalid vault lock target'), { statusCode: 400 })
  const root=realRoot(vaultRoot), normalized=candidate.replaceAll('\\',path.sep).replaceAll('/',path.sep)
  const absolute=path.isAbsolute(normalized)?path.resolve(normalized):path.resolve(root,normalized)
  if(!within(root,absolute))throw Object.assign(new Error('Vault lock target escapes the vault'),{statusCode:400})
  verifyPhysicalContainment(root,absolute)
  return path.relative(root,absolute).split(path.sep).join('/')
}
export function canonicalLockManifest(vaultRoot,candidates){if(!Array.isArray(candidates)||!candidates.length)throw new Error('A non-empty lock manifest is required');return [...new Set(candidates.map(x=>canonicalVaultIdentity(vaultRoot,x)))].sort((a,b)=>a.localeCompare(b))}
export function lockFileName(identity){const digest=crypto.createHash('sha256').update(identity).digest('hex').slice(0,12);return `${SLUG(identity)}-${digest}.lock.json`}
function parseLease(value){const n=Number(value);if(!Number.isInteger(n)||n<1||n>86400)throw fail('Invalid lock lease');return n}
function lockPathFor(root,lockDir,identity){
  const dir=path.resolve(lockDir);if(!within(root,dir))throw fail('Lock directory escapes the vault');fs.mkdirSync(dir,{recursive:true});verifyPhysicalContainment(root,dir)
  const result=path.join(dir,lockFileName(identity));if(fs.existsSync(result)&&fs.lstatSync(result).isSymbolicLink())throw fail('Lock alias is forbidden');return result
}
function readLock(file){let x;try{x=JSON.parse(fs.readFileSync(file,'utf8'))}catch{throw fail('Invalid vault lock record')}const keys=['artifact_path','claimed_at','distributed_boundary','heartbeat_at','intended_operation','lease_expires_at','lease_seconds','owner_token','owning_agent','schema_version','task_id'];if(!x||Array.isArray(x)||Object.keys(x).sort().join('|')!==keys.sort().join('|'))throw fail('Invalid vault lock record');for(const k of ['artifact_path','owning_agent','owner_token','task_id','claimed_at','heartbeat_at','lease_expires_at','intended_operation'])if(typeof x[k]!=='string'||!x[k])throw fail('Invalid vault lock record');if(x.schema_version!==1||x.distributed_boundary!=='local-filesystem-only')throw fail('Invalid vault lock record');parseLease(x.lease_seconds);for(const k of ['claimed_at','heartbeat_at','lease_expires_at'])if(!Number.isFinite(Date.parse(x[k]))||new Date(x[k]).toISOString()!==x[k])throw fail('Invalid vault lock record');if(Date.parse(x.heartbeat_at)<Date.parse(x.claimed_at)||Date.parse(x.lease_expires_at)!==Date.parse(x.heartbeat_at)+x.lease_seconds*1000)throw fail('Invalid vault lock record');return x}
function atomicReplace(file,data){const temp=`${file}.tmp-${process.pid}-${crypto.randomUUID()}`;fs.writeFileSync(temp,data,{flag:'wx',mode:0o600});try{fs.renameSync(temp,file)}finally{fs.rmSync(temp,{force:true})}}
function mutateGuarded(file,action){const guard=`${file}.guard`;if(fs.existsSync(guard)&&fs.lstatSync(guard).isSymbolicLink())throw fail('Lock guard alias is forbidden');let fd;try{fd=fs.openSync(guard,'wx',0o600);return action()}finally{if(fd!==undefined){fs.closeSync(fd);fs.rmSync(guard,{force:true})}}}
function canonicalRun(root,lockDir,command,options){
 const identity=canonicalVaultIdentity(root,options.artifact);if(identity!==options.artifact)throw fail('Non-canonical lock identity');const file=lockPathFor(root,lockDir,identity)
 if(command==='acquire'){const lease=parseLease(options.leaseSeconds),now=new Date(),lock={schema_version:1,artifact_path:identity,owning_agent:options.agent,owner_token:crypto.randomUUID(),task_id:options.taskId,claimed_at:now.toISOString(),heartbeat_at:now.toISOString(),lease_seconds:lease,lease_expires_at:new Date(now.getTime()+lease*1000).toISOString(),intended_operation:options.operation||'update',distributed_boundary:'local-filesystem-only'};try{fs.writeFileSync(file,`${JSON.stringify(lock,null,2)}\n`,{flag:'wx',mode:0o600});return lock}catch(error){if(error.code!=='EEXIST')throw error;return mutateGuarded(file,()=>{const existing=readLock(file);if(existing.artifact_path!==identity)throw fail('Lock identity mismatch');if(Date.parse(existing.lease_expires_at)>Date.now())throw fail('Vault lock is locked and already held');const observed=`${existing.owner_token}:${existing.heartbeat_at}`;const check=readLock(file);if(`${check.owner_token}:${check.heartbeat_at}`!==observed)throw fail('Lock changed during reclamation');const quarantine=`${file}.expired-${crypto.randomUUID()}`;fs.renameSync(file,quarantine);try{fs.writeFileSync(file,`${JSON.stringify(lock,null,2)}\n`,{flag:'wx',mode:0o600});fs.rmSync(quarantine,{force:true});return lock}catch(e){if(!fs.existsSync(file))fs.renameSync(quarantine,file);throw e}})}}
 return mutateGuarded(file,()=>{const lock=readLock(file);if(lock.artifact_path!==identity||lock.owner_token!==options.token)throw fail('owner token mismatch; refusing mutation');if(command==='heartbeat'){const lease=parseLease(options.leaseSeconds||lock.lease_seconds),now=new Date(),next={...lock,heartbeat_at:now.toISOString(),lease_seconds:lease,lease_expires_at:new Date(now.getTime()+lease*1000).toISOString()};atomicReplace(file,`${JSON.stringify(next,null,2)}\n`);return next}if(command==='release'){const tomb=`${file}.released-${crypto.randomUUID()}`;fs.renameSync(file,tomb);const moved=readLock(tomb);if(moved.owner_token!==options.token)throw fail('owner token mismatch; refusing mutation');fs.rmSync(tomb,{force:true});return moved}throw fail('Unsupported lock operation')})
}
export function acquireVaultLocks({vaultRoot,lockDir,targets,agent='nextstep-ui',taskId='vault-mutation',operation='update',leaseSeconds=60,runTool}){
 const root=realRoot(vaultRoot),manifest=canonicalLockManifest(root,targets),held=[],invoke=(command,item)=>runTool?runTool(path.join(root,'.coordination','tools','vault-lock.mjs'),[command,'--artifact',item.identity,'--lock-dir',lockDir,'--owner-token',item.token||'','--agent',agent,'--task',taskId,'--operation',operation,'--lease-seconds',String(leaseSeconds)],root):canonicalRun(root,lockDir,command,{artifact:item.identity,token:item.token,agent,taskId,operation,leaseSeconds})
 try{for(const identity of manifest){const result=invoke('acquire',{identity});const token=result?.lock?.owner_token||result?.owner_token;if(!token)throw fail('Vault lock acquisition omitted owner token');held.push({identity,token})}}catch(error){for(const item of [...held].reverse())try{invoke('release',item)}catch{}throw error}
 let released=false,unsafe=null;const beat=()=>{if(released)return;try{for(const item of held){const result=invoke('heartbeat',item);const token=result?.lock?.owner_token||result?.owner_token;if(token&&token!==item.token)throw fail('Heartbeat owner token changed')}}catch(e){unsafe=e;clearInterval(timer)}};const timer=setInterval(beat,Math.max(50,Math.floor(leaseSeconds*1000/3)));timer.unref?.()
 return{manifest,held,assertSafe(){if(unsafe)throw fail(`Vault lease became unsafe: ${unsafe.message}`);if(released)throw fail('Vault lock lease is already released')},heartbeatAll(){this.assertSafe();beat();this.assertSafe()},releaseAll({suppress=false}={}){if(released)return;clearInterval(timer);let failure=unsafe;for(const item of [...held].reverse())try{invoke('release',item)}catch(e){failure||=e}released=true;if(failure&&!suppress)throw failure}}
}
export function inferVaultRoot({vaultRoot,applicationsRoot,archiveRoot,auditLogPath,lockDir}){if(vaultRoot)return realRoot(vaultRoot);const values=[applicationsRoot,archiveRoot,auditLogPath,lockDir].filter(Boolean).map(value=>path.resolve(value));if(!values.length)throw new Error('Vault root is required');let current=values[0];while(!values.every(v=>v===current||v.startsWith(`${current}${path.sep}`))){const parent=path.dirname(current);if(parent===current)throw new Error('Unable to infer vault root');current=parent}return realRoot(current)}
export function ensureLockToolFixture(){return true}

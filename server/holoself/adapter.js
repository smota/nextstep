import { spawn } from 'node:child_process'
import { access, mkdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import yaml from 'js-yaml'
import { PATHS } from '../config/paths.js'

const TIMEOUT_MS = 8_000
const OUTPUT_CAP = 2 * 1024 * 1024
const CLAIM_MAX = 2_000
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PRIVATE = /(compensation|salary|remuneration|secret|password|token|api[_-]?key)/i

export class HoloselfError extends Error { constructor(message, code = 'HOLOSELF_ERROR', status = 502) { super(message); this.code = code; this.status = status } }

async function exists(file) { try { await access(file); return true } catch { return false } }

export async function discoverHoloself(env = process.env, platform = process.platform) {
  const override = env.HOLOSELF_EXECUTABLE
  if (override) {
    if (!path.isAbsolute(override)) throw new HoloselfError('Holoself executable override must be absolute', 'UNTRUSTED_EXECUTABLE', 503)
    const resolved = await realpath(override).catch(() => null)
    if (!resolved || !(await stat(resolved)).isFile()) throw new HoloselfError('Holoself CLI is unavailable', 'CLI_UNAVAILABLE', 503)
    if (resolved.endsWith('.mjs') || resolved.endsWith('.js')) return { command: process.execPath, prefix: [resolved] }
    if (platform === 'win32' && !resolved.toLowerCase().endsWith('.exe')) throw new HoloselfError('Unsafe Windows Holoself wrapper', 'UNTRUSTED_EXECUTABLE', 503)
    return { command: resolved, prefix: [] }
  }
  const dirs = (env.PATH || '').split(path.delimiter).filter(Boolean)
  for (const dir of dirs) {
    if (platform === 'win32') {
      const exe = path.join(dir, 'holoself.exe')
      if (await exists(exe)) return { command: await realpath(exe), prefix: [] }
      // npm's .cmd wrapper is never executed. Resolve its fixed package entry with Node.
      const cli = path.join(dir, 'node_modules', 'holoself-ai', 'bin', 'holoself.mjs')
      if (await exists(path.join(dir, 'holoself.cmd')) && await exists(cli)) return { command: process.execPath, prefix: [await realpath(cli)] }
    } else {
      const file = path.join(dir, 'holoself')
      if (await exists(file)) return { command: await realpath(file), prefix: [] }
    }
  }
  throw new HoloselfError('Holoself CLI is unavailable', 'CLI_UNAVAILABLE', 503)
}

export async function runHoloself(args, options = {}) {
  const executable = await discoverHoloself(options.env)
  return new Promise((resolve, reject) => {
    const child = spawn(executable.command, [...executable.prefix, ...args], { cwd: options.cwd || PATHS.vaultRoot, env: options.env || process.env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), settled = false
    const finish = (err, value) => { if (settled) return; settled = true; clearTimeout(timer); err ? reject(err) : resolve(value) }
    const collect = (which) => (chunk) => {
      if (stdout.length + stderr.length + chunk.length > (options.outputCap || OUTPUT_CAP)) { child.kill(); finish(new HoloselfError('Holoself output exceeded safe limit', 'OUTPUT_LIMIT')) ; return }
      if (which === 'out') stdout = Buffer.concat([stdout, chunk]); else stderr = Buffer.concat([stderr, chunk])
    }
    child.stdout.on('data', collect('out')); child.stderr.on('data', collect('err'))
    child.on('error', () => finish(new HoloselfError('Holoself CLI is unavailable', 'CLI_UNAVAILABLE', 503)))
    child.on('close', (code) => code === 0 ? finish(null, stdout.toString('utf8')) : finish(new HoloselfError(`Holoself command failed (${code})`, 'COMMAND_FAILED')))
    const timer = setTimeout(() => { child.kill(); finish(new HoloselfError('Holoself command timed out', 'TIMEOUT', 504)) }, options.timeout || TIMEOUT_MS)
  })
}

function parseJson(raw) { try { return JSON.parse(raw) } catch { throw new HoloselfError('Holoself returned malformed output', 'MALFORMED_OUTPUT') } }
function safeText(value, max = 50_000) { return typeof value === 'string' ? value.slice(0, max).replace(/(?:bearer\s+|token[=:]\s*)[A-Za-z0-9._~-]{12,}/gi, '[redacted]') : '' }
const INTERNAL_KEY=/(^|_)(path|file|filename|directory|root|cwd|key)$/i
const ABSOLUTE=/(?:[A-Za-z]:[\\/]|^\/|file:\/\/)/
function safeLabel(value){const text=safeText(String(value??''),300);if(ABSOLUTE.test(text))return path.basename(text.replaceAll('\\','/'));return text}
export function sanitizePublicProvenance(value){if(Array.isArray(value))return value.map(sanitizePublicProvenance).filter(v=>v!==undefined);if(value&&typeof value==='object'){const out={};for(const [key,item] of Object.entries(value)){if(INTERNAL_KEY.test(key))continue;const clean=sanitizePublicProvenance(item);if(clean!==undefined)out[key]=clean}return out}if(typeof value==='string')return safeLabel(value);if(['number','boolean'].includes(typeof value)||value===null)return value;return undefined}
function permitted(meta = {}) { const lenses = meta.access_lenses; const careerAllowed = Array.isArray(lenses) ? lenses.includes('career') : Boolean(lenses && typeof lenses === 'object' && !Array.isArray(lenses) && lenses.career === true); return !PRIVATE.test(meta.path || '') && careerAllowed }

export async function getContext(run = runHoloself) {
  const data = parseJson(await run(['context', '--project', PATHS.vaultRoot, '--lens', 'career', '--json']))
  if (data?.lens !== 'career' || !['valid', 'passed'].includes(data?.validation?.status) || !Array.isArray(data?.self?.documents)) throw new HoloselfError('Career context was not explicitly permitted', 'PRIVACY_DENIED', 403)
  const documents = data.self.documents.filter(d => !PRIVATE.test(d.path || '') && permitted(d.metadata)).map(d => ({ label:safeLabel(d.metadata?.label||d.path), content:safeText(d.content), provenance:sanitizePublicProvenance(d.metadata?.provenance||{label:d.metadata?.label||path.basename(d.path||'source')}), disclosure:d.metadata?.disclosure||'internal', sensitivity:d.metadata?.sensitivity||'private', publicationAllowed:d.metadata?.publication_allowed===true, version:safeLabel(d.metadata?.version||'')||undefined }))
  return { health: { available: true, lens: 'career', validation: data.validation.status, warnings: (data.warnings || []).map(x => safeText(String(x), 300)) }, documents, sources:documents.map(({label,provenance,disclosure,sensitivity,publicationAllowed,version})=>({label,provenance,disclosure,sensitivity,publicationAllowed,...(version?{version}:{})})) }
}

export async function searchContext(query, run = runHoloself) {
  const q = safeText(query, 200).trim(); if (q.length < 2) throw new HoloselfError('Search query is too short', 'INVALID_QUERY', 400)
  const data = parseJson(await run(['search', q, '--project', PATHS.vaultRoot, '--json']))
  return (data.results || []).filter(r => !PRIVATE.test(r.source_file || '') && permitted({ ...r, path:r.source_file })).slice(0, 50).map(r => ({ source:safeLabel(r.label||r.source_file), section:safeText(r.section,200), passage:safeText(r.matching_passage,1200), provenance:sanitizePublicProvenance(r.provenance), disclosure:r.disclosure||'internal', sensitivity:r.sensitivity||'private', publicationAllowed:r.publication_allowed===true, ...(r.version?{version:safeLabel(r.version)}:{}) }))
}

export async function listProposals(run = runHoloself) { const x = parseJson(await run(['proposals','list','--project',PATHS.vaultRoot,'--json'])); return (Array.isArray(x) ? x : []).map(safeProposal) }
function safeProposal(p) { return { id:p.proposal_id, target:safeLabel(p.target), claim:safeText(p.claim,CLAIM_MAX), evidence:safeText(p.evidence,2000), status:p.status, createdAt:p.created_at, reviewedAt:p.reviewed_at||null, provenance:sanitizePublicProvenance(p.provenance)||[] } }
export async function showProposal(id, run = runHoloself) { assertId(id); const raw=await run(['proposals','show',id,'--project',PATHS.vaultRoot]); let p; try { p=yaml.load(raw) } catch { throw new HoloselfError('Holoself returned malformed output','MALFORMED_OUTPUT') } if(p?.proposal_id!==id) throw new HoloselfError('Proposal response did not match requested ID','ID_MISMATCH'); return safeProposal(p) }
function assertId(id) { if (!ID.test(id || '')) throw new HoloselfError('Exact proposal ID required','INVALID_ID',400) }

export async function createProposal(claim, run = runHoloself) {
  const text=typeof claim==='string'?claim.trim():''; if(!text || text.length>CLAIM_MAX) throw new HoloselfError(`Claim must be 1-${CLAIM_MAX} characters`,'INVALID_CLAIM',400)
  const dir=path.join(PATHS.vaultRoot,'.holoself','proposal-sources'); await mkdir(dir,{recursive:true}); const file=path.join(dir,`${randomUUID()}.txt`)
  await writeFile(file,text,{encoding:'utf8',mode:0o600,flag:'wx'})
  try { await run(['propose','--project',PATHS.vaultRoot,'--claim',text,'--source-file',file]); return { created:true } } finally { await rm(file,{force:true}) }
}
export async function reviewProposal(id, action, confirmation, run = runHoloself) { assertId(id); if(!['approve','reject','defer'].includes(action)) throw new HoloselfError('Invalid review action','INVALID_ACTION',400); if(confirmation!==`${action.toUpperCase()}:${id}`) throw new HoloselfError('Exact confirmation token required','CONFIRMATION_REQUIRED',400); await run(['proposals',action,id,'--project',PATHS.vaultRoot,'--yes']); return { success:true, context:await getContext(run) } }

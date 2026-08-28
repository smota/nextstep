import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { acquireVaultLocks, inferVaultRoot } from './lockAdapter.js'
import { runVaultTransaction } from './transactionJournal.js'
import matter from 'gray-matter'

export const DOCUMENT_ARTIFACTS = Object.freeze({
  index: 'index.md', metadata: 'metadata.md', jobDescription: 'job-description.md', fitAnalysis: 'fit-analysis.md',
  cv: 'cv.md', coverLetter: 'cover-letter.md', companyProfile: 'company-profile.md', peopleNotes: 'people-notes.md',
  interviewPrep: 'interview-prep.md', submissionNotes: 'submission-notes.md',
})
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SAFE_VERSION = /^[a-z][A-Za-z0-9]*-follow-up-(\d{8}T\d{6}Z)$/
const PROTECTED_STAGES = new Set(['applied', 'recruiter_screen', 'interview', 'offer', 'rejected', 'withdrawn', 'archived'])
const TERMINAL_STAGES = new Set(['rejected', 'withdrawn', 'archived'])
const PROTECTED_ARTIFACTS = new Set(['cv', 'coverLetter'])
const BASELINE_CV = /^(?:[a-z0-9]+_)*Baseline_CV\.md$/i

function resolveMasterDocument(vaultRoot, reference, io = fs) {
  if (reference !== 'baseline/cv') return { status: 400, error: 'Invalid document reference' }
  const masterRoot = path.join(path.resolve(vaultRoot), 'Master')
  let candidates
  try { candidates = io.readdirSync(masterRoot, { withFileTypes: true }).filter(entry => entry.isFile() && BASELINE_CV.test(entry.name)) }
  catch (error) { return error.code === 'ENOENT' ? { status: 404, error: 'Document not found' } : (() => { throw error })() }
  if (candidates.length === 0) return { status: 404, error: 'Document not found' }
  if (candidates.length !== 1) return { status: 409, error: 'Baseline CV configuration is ambiguous' }
  return { status: 200, filename: path.join(masterRoot, candidates[0].name) }
}

function revision(content, stat) { return `${Math.trunc(stat.mtimeMs)}-${createHash('sha256').update(content).digest('hex')}` }
function applicationState(filename, io = fs) { try { const data=matter(io.readFileSync(path.join(path.dirname(filename), 'metadata.md'),'utf8')).data;return {status:data.status||null,submitted:Boolean(data.submission?.confirmed||data.submission?.snapshot)} } catch { return {status:null,submitted:false} } }
function applicationStatus(filename, io = fs) { return applicationState(filename,io).status }
function versionFilename(artifact, version) {
  if (!version) return DOCUMENT_ARTIFACTS[artifact]
  const match = version.match(SAFE_VERSION)
  return match && version.startsWith(`${artifact}-follow-up-`) ? `${version}.md` : null
}
export function resolveApplicationDocument({ applicationsRoot, archiveRoot, scope, slug, artifact, version }) {
  const basename = Object.hasOwn(DOCUMENT_ARTIFACTS, artifact) && versionFilename(artifact, version)
  if (!['active', 'archive'].includes(scope) || !SAFE_SLUG.test(slug || '') || !basename) return null
  const root = path.resolve(scope === 'active' ? applicationsRoot : archiveRoot), candidate = path.resolve(root, slug, basename), relative = path.relative(root, candidate)
  return relative.startsWith('..') || path.isAbsolute(relative) ? null : candidate
}
export function listApplicationDocumentVersions(options) {
  const canonical = resolveApplicationDocument({ ...options, version: undefined })
  if (!canonical) return { status: 400, error: 'Invalid document reference' }
  try {
    const prefix = `${options.artifact}-follow-up-`
    const versions = fs.readdirSync(path.dirname(canonical), { withFileTypes: true }).filter(e => e.isFile() && e.name.startsWith(prefix) && e.name.endsWith('.md')).map(e => e.name.slice(0, -3)).filter(v => SAFE_VERSION.test(v)).sort().reverse()
    return { status: 200, artifact: options.artifact, slug: options.slug, versions }
  } catch (error) { return error.code === 'ENOENT' ? { status: 404, error: 'Application not found' } : (() => { throw error })() }
}
export function readMasterDocument({ vaultRoot, slug, artifact, version, io = fs }) {
  if (!vaultRoot || version != null) return { status: 400, error: 'Invalid document reference' }
  const resolved = resolveMasterDocument(vaultRoot, `${slug}/${artifact}`, io)
  if (resolved.status !== 200) return resolved
  const filename = resolved.filename
  try {
    const stat = io.statSync(filename); if (!stat.isFile()) return { status: 404, error: 'Document not found' }
    const content = io.readFileSync(filename, 'utf8')
    return { status: 200, content, scope: 'master', slug, artifact, filename: path.basename(filename), revision: revision(content, stat), modifiedAt: stat.mtime.toISOString(), protected: true, editable: false }
  } catch (error) { if (error.code === 'ENOENT') return { status: 404, error: 'Document not found' }; throw error }
}
export function readApplicationDocument(options) {
  const io = options.io || fs, filename = resolveApplicationDocument(options)
  if (!filename) return { status: 400, error: 'Invalid document reference' }
  try {
    const stat = io.statSync(filename); if (!stat.isFile()) return { status: 404, error: 'Document not found' }
    const content = io.readFileSync(filename, 'utf8'), state = applicationState(filename, io), stage=state.status, isVersion = Boolean(options.version)
    return { status: 200, content, artifact: options.artifact, version: options.version || null, slug: options.slug, filename: path.basename(filename), revision: revision(content, stat), modifiedAt: stat.mtime.toISOString(), stage, protected: !isVersion && (state.submitted||PROTECTED_STAGES.has(stage)) && PROTECTED_ARTIFACTS.has(options.artifact), editable: options.scope === 'active' && !TERMINAL_STAGES.has(stage) && options.artifact !== 'jobDescription' }
  } catch (error) { if (error.code === 'ENOENT') return { status: 404, error: 'Document not found' }; throw error }
}
function followUpVersion(artifact, now) { return `${artifact}-follow-up-${now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}` }
export function saveApplicationDocument(options) {
  const { content, expectedRevision, mode = 'overwrite', auditLogPath, invalidate = () => {}, now = new Date(), io = fs, deps = {} } = options
  const filename = resolveApplicationDocument(options)
  if (!filename || typeof content !== 'string' || typeof expectedRevision !== 'string' || !auditLogPath) return { status: 400, error: 'Invalid save request' }
  if (options.artifact === 'jobDescription') return { status: 403, error: 'This document is read-only' }
  const vaultRoot=inferVaultRoot(options),lockDir=options.locksDir||path.join(vaultRoot,'.coordination','locks'),metadata=path.join(path.dirname(filename),'metadata.md')
  const possibleVersion=followUpVersion(options.artifact,now),possibleFollowUp=resolveApplicationDocument({...options,version:possibleVersion})
  let lease
  try { lease=acquireVaultLocks({vaultRoot,lockDir,targets:[metadata,filename,possibleFollowUp||filename,auditLogPath],taskId:'document-save',operation:'save-document',runTool:deps.lockCommand}) }
  catch (error) { return { status: 423, error: 'Document is locked by another editor' } }
  let primary
  try {
    const stage = applicationStatus(filename, io)
    if (TERMINAL_STAGES.has(stage) || options.scope === 'archive') return { status: 409, error: 'Reopen the application to edit preparation documents', code: 'APPLICATION_TERMINAL' }
    const latest = readApplicationDocument({ ...options, io })
    if (latest.status !== 200) return latest
    if (latest.revision !== expectedRevision) return { status: 409, error: 'Document changed since it was opened', currentRevision: latest.revision }
    if (latest.protected && mode !== 'follow-up') return { status: 409, error: 'Submitted CV and cover letter versions cannot be overwritten. Save a follow-up version instead.', protection: 'follow-up-required' }
    const version = latest.protected ? possibleVersion : options.version
    const target = latest.protected ? possibleFollowUp : filename
    const auditOriginal = io.existsSync(auditLogPath) ? io.readFileSync(auditLogPath) : Buffer.alloc(0)
    const auditOut=Buffer.concat([Buffer.from(auditOriginal),Buffer.from(`\n- ${now.toISOString()} | nextstep-api | document-save | saved ${path.relative(vaultRoot,target).replaceAll('\\','/')} | ${latest.protected ? 'follow-up version created' : 'atomic overwrite'}\n`)])
    runVaultTransaction({paths:{vaultRoot,locksDir:lockDir,applicationsDir:options.applicationsRoot,archiveApplicationsDir:options.archiveRoot,auditLogPath},kind:'document-save',context:{scope:options.scope,slug:options.slug,artifact:options.artifact,version:version||null},outputs:new Map([[target,content],[auditLogPath,auditOut]]),lease,deps:{...deps,io}})
    let invalidation
    try { invalidation=invalidate() } catch { invalidation={state:'rebuild_required'} }
    const savedStat = io.statSync(target)
    return { status: 200, slug: options.slug, artifact: options.artifact, version: version || null, filename: path.basename(target), content, revision: revision(content, savedStat), modifiedAt: savedStat.mtime.toISOString(), followUp: latest.protected, protected: false, editable: true, indexState:invalidation?.state||null }
  } catch (error) {
    primary=error
    return { status: 500, error: 'Save failed safely' }
  } finally { lease.releaseAll({suppress:Boolean(primary)}) }
}

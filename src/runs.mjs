import fs from 'node:fs'
import path from 'node:path'
import { assertContained } from './config.mjs'

const SHA = /^[a-f0-9]{64}$/
const RUN_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/
const FORBIDDEN = /prompt|response|content|document|message|secret|credential|token/i

function rejectUnknown(value, allowed, label) {
  const unknown = Object.keys(value || {}).filter(key => !allowed.includes(key))
  if (unknown.length) throw Object.assign(new Error(`${label} contains unsupported field: ${unknown[0]}`), { code: FORBIDDEN.test(unknown[0]) ? 'SENSITIVE_RUN_FIELD' : 'INVALID_COMMAND' })
}

function normalizeStage(stage) {
  rejectUnknown(stage, ['id', 'durationMs', 'toolFamily', 'command', 'errorCode', 'retries', 'cacheHit', 'validationScope', 'qaStatus'], 'Run stage')
  if (!stage?.id || !Number.isFinite(stage.durationMs) || stage.durationMs < 0) throw Object.assign(new Error('Run stages require id and non-negative durationMs'), { code: 'INVALID_COMMAND' })
  return {
    id: String(stage.id),
    durationMs: stage.durationMs,
    toolFamily: stage.toolFamily ? String(stage.toolFamily) : null,
    command: stage.command ? String(stage.command) : null,
    errorCode: stage.errorCode ? String(stage.errorCode) : null,
    retries: Number.isInteger(stage.retries) && stage.retries >= 0 ? stage.retries : 0,
    cacheHit: Boolean(stage.cacheHit),
    validationScope: stage.validationScope ? String(stage.validationScope) : null,
    qaStatus: stage.qaStatus ? String(stage.qaStatus) : null
  }
}

function normalizeRun(run) {
  rejectUnknown(run, ['schemaVersion', 'runId', 'startedAt', 'completedAt', 'intent', 'subjectId', 'stages', 'sourceDigests', 'contextDigests'], 'Run manifest')
  if (run?.schemaVersion !== 1 || !RUN_ID.test(run.runId || '') || !Date.parse(run.startedAt) || !Date.parse(run.completedAt) || Date.parse(run.completedAt) < Date.parse(run.startedAt) || !run.intent || !Array.isArray(run.stages)) throw Object.assign(new Error('Run manifest is invalid'), { code: 'INVALID_COMMAND' })
  const sourceDigests = run.sourceDigests || [], contextDigests = run.contextDigests || []
  if (![...sourceDigests, ...contextDigests].every(value => SHA.test(value))) throw Object.assign(new Error('Run digests must be lowercase SHA-256 values'), { code: 'INVALID_COMMAND' })
  const stages = run.stages.map(normalizeStage)
  return { schemaVersion: 1, runId: run.runId, startedAt: run.startedAt, completedAt: run.completedAt, intent: String(run.intent), subjectId: run.subjectId ? String(run.subjectId) : null, stages, sourceDigests: [...new Set(sourceDigests)], contextDigests: [...new Set(contextDigests)], summary: { durationMs: Date.parse(run.completedAt) - Date.parse(run.startedAt), stages: stages.length, failures: stages.filter(stage => stage.errorCode).length, retries: stages.reduce((total, stage) => total + stage.retries, 0), cacheHits: stages.filter(stage => stage.cacheHit).length } }
}

export function recordRun(paths, run) {
  const normalized = normalizeRun(run)
  fs.mkdirSync(paths.stateRoot, { recursive: true })
  const file = assertContained(paths.stateRoot, path.join(paths.runsDir, `${normalized.runId}.json`), 'Run manifest')
  const data = `${JSON.stringify(normalized, null, 2)}\n`
  fs.mkdirSync(path.dirname(file), { recursive: true })
  try { fs.writeFileSync(file, data, { flag: 'wx', mode: 0o600 }) } catch (error) {
    if (error.code !== 'EEXIST') throw error
    if (fs.readFileSync(file, 'utf8') !== data) throw Object.assign(new Error(`Run already exists: ${normalized.runId}`), { code: 'RUN_CONFLICT' })
    return { schemaVersion: 1, status: 'unchanged', runId: normalized.runId, summary: normalized.summary }
  }
  return { schemaVersion: 1, status: 'recorded', runId: normalized.runId, summary: normalized.summary }
}

export function listRuns(paths, { limit = 20 } = {}) {
  if (!fs.existsSync(paths.runsDir)) return { schemaVersion: 1, status: 'ok', runs: [] }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw Object.assign(new Error('Run list limit must be an integer from 1 to 100'), { code: 'INVALID_COMMAND' })
  const safeLimit = limit
  const runs = fs.readdirSync(paths.runsDir).filter(name => name.endsWith('.json')).map(name => JSON.parse(fs.readFileSync(path.join(paths.runsDir, name), 'utf8'))).sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt))).slice(0, safeLimit).map(({ runId, startedAt, completedAt, intent, subjectId, summary }) => ({ runId, startedAt, completedAt, intent, subjectId, summary }))
  return { schemaVersion: 1, status: 'ok', runs }
}

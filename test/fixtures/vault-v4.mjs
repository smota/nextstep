// Dedicated legacy vault for upgrade tests. Ordinary command tests keep the v5 factories.
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolvePaths } from '../../src/config.mjs'
import { json, RECORD_FILES, RECORD_TYPES, rebuildBacklinks } from '../../src/model.mjs'

export const SYNTHETIC = Object.freeze({
  companyId: 'company:synthetic',
  personId: 'person:synthetic',
  opportunityId: 'opportunity:synthetic',
  attemptId: 'application-attempt:synthetic',
  submissionId: 'interaction:synthetic-submission',
  outreachId: 'interaction:synthetic-outreach',
  cvId: 'artifact:synthetic-cv',
  noteId: 'artifact:synthetic-note',
  cvPath: 'artifacts/opportunities/synthetic/cv.md',
  notePath: 'artifacts/people/synthetic.md',
  submissionSnapshot: 'artifacts/.versions/synthetic-cv/submission.md',
  outreachTransmission: 'artifacts/.versions/synthetic-note/outreach.md'
})

const CAREER_TYPES = RECORD_TYPES.filter(type => type !== 'actions')
const CV_BYTES = Buffer.from('# Synthetic CV\n')
const NOTE_BYTES = Buffer.from('Synthetic outreach\n')
const HISTORICAL_AUDIT = '{"schemaVersion":1,"at":"2020-01-01T00:00:00.000Z","command":"historical"}\n'

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function candidature(root, relative) {
  return path.join(root, 'Candidatures', ...relative.split('/'))
}

function careerModel() {
  const cvSha = sha256(CV_BYTES)
  const noteSha = sha256(NOTE_BYTES)
  const model = {
    companies: [{ id: SYNTHETIC.companyId, name: 'Synthetic Co' }],
    opportunities: [{
      id: SYNTHETIC.opportunityId,
      company_id: SYNTHETIC.companyId,
      title: 'Synthetic Role',
      posting_state: 'active',
      pursuit_status: 'applied',
      storage_scope: 'active',
      record_state: 'complete',
      created: '2026-08-01',
      updated: '2026-08-28',
      outcome: null,
      people_relations: [],
      source_revision: 0
    }],
    applicationAttempts: [{
      id: SYNTHETIC.attemptId,
      opportunity_id: SYNTHETIC.opportunityId,
      lifecycle_status: 'applied',
      outcome: null,
      storage_scope: 'active',
      record_state: 'complete',
      people_relations: [],
      source_revision: 0
    }],
    people: [{ id: SYNTHETIC.personId, name: 'Synthetic Person', company_id: SYNTHETIC.companyId }],
    interactions: [
      {
        id: SYNTHETIC.submissionId,
        kind: 'application_outcome',
        evidence_state: 'confirmed',
        application_attempt_id: SYNTHETIC.attemptId,
        opportunity_id: SYNTHETIC.opportunityId,
        company_id: SYNTHETIC.companyId,
        person_ids: [SYNTHETIC.personId],
        artifact_ids: [SYNTHETIC.cvId],
        occurred_at: '2026-08-28T12:00:00.000Z',
        temporal_precision: 'date_time',
        submission_bundle: {
          schema_version: 4,
          channel: 'company-site',
          channel_state: 'known',
          event_time: { precision: 'date_time', value: '2026-08-28T12:00:00.000Z' },
          artifact_selection_state: 'confirmed',
          items: [{
            artifact_id: SYNTHETIC.cvId,
            transmitted_artifact_id: SYNTHETIC.cvId,
            snapshot_path: SYNTHETIC.submissionSnapshot,
            sha256: cvSha,
            transmitted_sha256: cvSha
          }],
          recorded_at: '2026-08-28T12:05:00.000Z',
          evidence_source: 'user',
          original_report: 'Synthetic submission was transmitted.',
          reconciliations: []
        }
      },
      {
        id: SYNTHETIC.outreachId,
        kind: 'outreach',
        evidence_state: 'confirmed',
        company_id: SYNTHETIC.companyId,
        person_ids: [SYNTHETIC.personId],
        artifact_ids: [SYNTHETIC.noteId],
        occurred_at: '2026-08-20T09:00:00.000Z',
        temporal_precision: 'date_time',
        transmission: {
          schema_version: 2,
          message_artifact_id: SYNTHETIC.noteId,
          snapshot_path: SYNTHETIC.outreachTransmission,
          message_sha256: noteSha
        }
      }
    ],
    artifacts: [
      {
        id: SYNTHETIC.cvId,
        kind: 'cv',
        owner_type: 'application_attempt',
        owner_id: SYNTHETIC.attemptId,
        path: SYNTHETIC.cvPath,
        sha256: cvSha,
        size_bytes: CV_BYTES.length,
        media_type: 'text/markdown',
        document: { role: 'cv', representation: 'canonical_markdown', state: 'final', version: 1, primary: true }
      },
      {
        id: SYNTHETIC.noteId,
        kind: 'outreach_message',
        owner_type: 'person',
        owner_id: SYNTHETIC.personId,
        path: SYNTHETIC.notePath,
        sha256: noteSha,
        size_bytes: NOTE_BYTES.length,
        media_type: 'text/markdown',
        document: { role: 'outreach_message', representation: 'canonical_markdown', state: 'final', version: 1, primary: true }
      }
    ],
    strategies: [],
    experiments: []
  }
  rebuildBacklinks(model)
  return model
}

export function trackedFiles(root) {
  const resolved = fs.realpathSync.native(path.resolve(root))
  return [
    ...CAREER_TYPES.map(type => candidature(resolved, `records/${RECORD_FILES[type]}`)),
    candidature(resolved, 'records/audit.jsonl'),
    candidature(resolved, SYNTHETIC.submissionSnapshot),
    candidature(resolved, SYNTHETIC.outreachTransmission)
  ]
}

export function createSyntheticVault(root, schemaVersion = 4) {
  if (schemaVersion !== 4 && schemaVersion !== 5) throw new Error(`Synthetic vault version must be 4 or 5, received ${schemaVersion}`)
  const requested = path.resolve(root)
  fs.mkdirSync(requested, { recursive: true })
  const resolved = fs.realpathSync.native(requested)
  const records = candidature(resolved, 'records')
  fs.mkdirSync(path.join(resolved, 'Master'), { recursive: true })
  fs.mkdirSync(records, { recursive: true })
  fs.mkdirSync(path.dirname(candidature(resolved, SYNTHETIC.cvPath)), { recursive: true })
  fs.mkdirSync(path.dirname(candidature(resolved, SYNTHETIC.notePath)), { recursive: true })
  fs.mkdirSync(path.dirname(candidature(resolved, SYNTHETIC.submissionSnapshot)), { recursive: true })
  fs.mkdirSync(path.dirname(candidature(resolved, SYNTHETIC.outreachTransmission)), { recursive: true })
  fs.writeFileSync(candidature(resolved, SYNTHETIC.cvPath), CV_BYTES)
  fs.writeFileSync(candidature(resolved, SYNTHETIC.notePath), NOTE_BYTES)
  fs.writeFileSync(candidature(resolved, SYNTHETIC.submissionSnapshot), CV_BYTES)
  fs.writeFileSync(candidature(resolved, SYNTHETIC.outreachTransmission), NOTE_BYTES)
  const model = careerModel()
  for (const type of CAREER_TYPES) fs.writeFileSync(path.join(records, RECORD_FILES[type]), json(model[type]))
  const counts = Object.fromEntries((schemaVersion === 5 ? RECORD_TYPES : CAREER_TYPES).map(type => [type, type === 'actions' ? 0 : model[type].length]))
  fs.writeFileSync(path.join(records, 'manifest.json'), json({ schema_version: schemaVersion, model: 'nextstep-opportunity-graph', counts }))
  fs.writeFileSync(path.join(records, 'audit.jsonl'), HISTORICAL_AUDIT)
  if (schemaVersion === 5) fs.writeFileSync(path.join(records, RECORD_FILES.actions), json([]))
  return { root: resolved, paths: resolvePaths({ dataRoot: resolved }), schemaVersion }
}

export function syntheticVault(t, schemaVersion = 4) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-vault-v4-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return createSyntheticVault(root, schemaVersion)
}

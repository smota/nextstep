import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolvePaths } from '../../src/config.mjs'
import { rebuildBacklinks, RECORD_FILES } from '../../src/model.mjs'
export function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextstep-cli-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'Master'))
  fs.mkdirSync(path.join(root, 'Candidatures', 'records'), { recursive: true })
  fs.mkdirSync(path.join(root, 'Candidatures', 'artifacts', 'people'), { recursive: true })
  const model = {
    companies: [{ id: 'company:acme', name: 'Acme' }],
    opportunities: [{ id: 'opportunity:acme-lead', company_id: 'company:acme', title: 'Lead', posting_state: 'active', pursuit_status: 'preparing', people_relations: [], source_revision: 0 }],
    applicationAttempts: [{ id: 'application-attempt:acme-lead', opportunity_id: 'opportunity:acme-lead', lifecycle_status: 'preparing', outcome: null, storage_scope: 'active', record_state: 'complete', people_relations: [], source_revision: 0 }],
    people: [{ id: 'person:pat', name: 'Pat', company_id: 'company:acme' }],
    interactions: [],
    artifacts: [{ id: 'artifact:pat-note', kind: 'outreach_message', owner_type: 'person', owner_id: 'person:pat', path: 'artifacts/people/pat.md', sha256: '', size_bytes: 0, media_type: 'text/markdown', document: { role: 'outreach_message', representation: 'canonical_markdown', state: 'draft', version: 1, primary: true } }],
    strategies: [],
    experiments: []
  }
  const file = path.join(root, 'Candidatures', 'artifacts', 'people', 'pat.md')
  fs.writeFileSync(file, 'hello\n')
  model.artifacts[0].sha256 = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); model.artifacts[0].size_bytes = 6
  rebuildBacklinks(model)
  for (const [name, value] of Object.entries(model)) fs.writeFileSync(path.join(root, 'Candidatures', 'records', RECORD_FILES[name]), `${JSON.stringify(value, null, 2)}\n`)
  fs.writeFileSync(path.join(root, 'Candidatures', 'records', 'manifest.json'), `${JSON.stringify({ schema_version: 4, model: 'nextstep-opportunity-graph', counts: Object.fromEntries(Object.entries(model).map(([k, v]) => [k, v.length])) }, null, 2)}\n`)
  return { root, paths: resolvePaths({ dataRoot: root }), file }
}

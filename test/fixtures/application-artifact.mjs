import fs from 'node:fs'
import path from 'node:path'
import { registerArtifact } from '../../src/commands.mjs'

export function applicationArtifact(paths) {
  const file = path.join(paths.artifactsDir, 'cv.md')
  fs.writeFileSync(file, '# Candidate\n\nOriginal evidence.\n')
  registerArtifact(paths, { schemaVersion: 1, requestId: 'cv-register', idempotencyKey: 'cv-register', payload: { record: { id: 'artifact:cv', kind: 'cv', owner_type: 'application_attempt', owner_id: 'application-attempt:acme-lead', path: 'artifacts/cv.md', document: { role: 'cv', representation: 'canonical_markdown', state: 'final', version: 1, primary: true, contract: { templates: ['workflow-template:applicant-review'] } } } } })
  return file
}

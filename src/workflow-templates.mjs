import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const catalogPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'catalog', 'workflow-templates.json')

function load() {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.templates)) throw Object.assign(new Error('Workflow template catalog is invalid'), { code: 'TEMPLATE_CATALOG_INVALID' })
  const ids = new Set()
  for (const template of catalog.templates) {
    if (!template.id?.startsWith('workflow-template:') || !template.category || !template.label || !template.purpose || !Array.isArray(template.sections) || !template.sections.length || ids.has(template.id)) throw Object.assign(new Error('Workflow template catalog is invalid'), { code: 'TEMPLATE_CATALOG_INVALID' })
    ids.add(template.id)
  }
  return catalog
}

export function listWorkflowTemplates({ category } = {}) {
  const templates = load().templates.filter(template => !category || template.category === category)
  return { schemaVersion: 1, status: 'ok', templates: templates.map(({ id, category: itemCategory, label, purpose }) => ({ id, category: itemCategory, label, purpose })) }
}

export function getWorkflowTemplate(id) {
  const template = load().templates.find(item => item.id === id)
  if (!template) throw Object.assign(new Error(`Workflow template not found: ${id}`), { code: 'NOT_FOUND' })
  return { schemaVersion: 1, status: 'ok', template }
}

const INTENT_TEMPLATES = Object.freeze({
  analyze: ['workflow-template:opportunity-evidence', 'workflow-template:decision-brief'],
  outreach: ['workflow-template:executive-outreach'],
  drafting: ['workflow-template:executive-cv', 'workflow-template:application-letter', 'workflow-template:application-form-answer'],
  application: ['workflow-template:opportunity-evidence', 'workflow-template:application-channel-manifest', 'workflow-template:application-package', 'workflow-template:executive-cv', 'workflow-template:application-letter', 'workflow-template:application-form-answer', 'workflow-template:recruiter-scan'],
  interview: ['workflow-template:decision-brief']
})

export function workflowBundle(intent) {
  const ids = INTENT_TEMPLATES[intent] || []
  return {
    intent,
    templates: ids.map(id => getWorkflowTemplate(id).template),
    authorizationBoundary: {
      directPackageRequest: 'authorizes_in_scope_private_files_and_registration',
      separateConfirmationRequired: ['submission', 'outreach', 'destructive_operation', 'sensitive_artifact_adoption', 'publication']
    }
  }
}

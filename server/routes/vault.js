import { Router } from 'express'
import { buildVaultModel, getVaultHealth, invalidateVaultCache } from '../vault/index.js'
import { PATHS } from '../config/paths.js'
import { listApplicationDocumentVersions, readApplicationDocument, readMasterDocument, saveApplicationDocument } from '../vault/documents.js'
import { PDF_PAPERS, PDF_STYLES, pdfDownloadName, renderApplicationPdf } from '../vault/pdf.js'

export const vaultRouter = Router()

vaultRouter.get('/health', (req, res) => {
  const health = getVaultHealth()
  res.status(health.vault.state === 'available' ? 200 : 503).json(health)
})

vaultRouter.get('/overview', (req, res) => {
  const { applications, companies, people, builtAt } = buildVaultModel()
  const active = applications.filter((application) => !application.archived)
  res.json({
    builtAt,
    totals: { applications: active.length, companies: companies.length, people: people.length },
    preparation: {
      ready: active.filter((application) => ['ready_for_next_step','complete'].includes(application.preparation.state)).length,
      needsAttention: active.filter((application) => !['ready_for_next_step','complete'].includes(application.preparation.state)).length,
      states: Object.fromEntries(active.reduce((counts, application) => counts.set(application.preparation.state, (counts.get(application.preparation.state) || 0) + 1), new Map())),
    },
  })
})

export function createPdfHandler({ applicationsRoot = PATHS.applicationsDir, archiveRoot = PATHS.archiveApplicationsDir } = {}) {
  return async (req, res) => {
    const allowedQuery = new Set(['version', 'paper', 'style'])
    const malformed = Object.keys(req.query).some(key => !allowedQuery.has(key)) || Object.values(req.query).some(value => typeof value !== 'string')
    const paper = req.query.paper || 'A4', style = req.query.style || 'professional'
    if (malformed || !PDF_PAPERS.has(paper) || !PDF_STYLES.has(style)) return res.status(400).json({ error: 'Invalid PDF query' })
    const result = readApplicationDocument({ applicationsRoot, archiveRoot, ...req.params, version: req.query.version })
    if (result.status !== 200) return res.status(result.status).json({ error: result.error })
    try {
      const pdf = await renderApplicationPdf({ ...result, paper, style })
      const filename = pdfDownloadName(result)
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"`, 'Content-Length': String(pdf.length), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
      res.status(200).send(pdf)
    } catch {
      res.status(500).json({ error: 'PDF generation failed' })
    }
  }
}

vaultRouter.get('/documents/:scope/:slug/:artifact.pdf', createPdfHandler())

vaultRouter.get('/documents/:scope/:slug/:artifact/versions', (req, res) => {
  const result = listApplicationDocumentVersions({ applicationsRoot: PATHS.applicationsDir, archiveRoot: PATHS.archiveApplicationsDir, ...req.params })
  res.status(result.status).json(result.status === 200 ? result : { error: result.error })
})

vaultRouter.get('/documents/:scope/:slug/:artifact', (req, res) => {
  if (req.params.scope === 'master') {
    const result = readMasterDocument({ vaultRoot: PATHS.vaultRoot, slug: req.params.slug, artifact: req.params.artifact, version: req.query.version })
    if (result.status !== 200) return res.status(result.status).json({ error: result.error })
    return res.type('text/markdown').set('Cache-Control', 'private, no-store').send(result.content)
  }
  const result = readApplicationDocument({
    applicationsRoot: PATHS.applicationsDir,
    archiveRoot: PATHS.archiveApplicationsDir,
    ...req.params, version: req.query.version,
  })
  if (result.status !== 200) return res.status(result.status).json({ error: result.error })
  res.json(result)
})

vaultRouter.put('/documents/:scope/:slug/:artifact', (req, res) => {
  const result = saveApplicationDocument({
    applicationsRoot: PATHS.applicationsDir, archiveRoot: PATHS.archiveApplicationsDir,
    locksDir: PATHS.locksDir, auditLogPath: PATHS.auditLogPath, invalidate: invalidateVaultCache,
    ...req.params, version: req.body?.version, content: req.body?.content, expectedRevision: req.body?.revision, mode: req.body?.mode,
  })
  res.status(result.status).json(result.status === 200 ? result : { error: result.error, code: result.code, currentRevision: result.currentRevision, protection: result.protection })
})

vaultRouter.post('/refresh', (req, res) => {
  invalidateVaultCache()
  const model = buildVaultModel({ force: true })
  res.json({ builtAt: model.builtAt })
})

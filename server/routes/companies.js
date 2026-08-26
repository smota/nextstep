import { Router } from 'express'
import { buildVaultModel } from '../vault/index.js'

export const companiesRouter = Router()

companiesRouter.get('/', (req, res) => {
  const { companies } = buildVaultModel()
  res.json(companies)
})

companiesRouter.get('/:slug', (req, res) => {
  const { companies } = buildVaultModel()
  const company = companies.find((c) => c.slug === req.params.slug)
  if (!company) {
    res.status(404).json({ error: 'Company not found' })
    return
  }
  res.json(company)
})

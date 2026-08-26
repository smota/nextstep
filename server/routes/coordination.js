import { Router } from 'express'
import { buildVaultModel } from '../vault/index.js'

export const coordinationRouter = Router()

coordinationRouter.get('/', (req, res) => {
  const { coordination } = buildVaultModel()
  res.json(coordination)
})

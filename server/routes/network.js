import { Router } from 'express'
import { buildVaultModel } from '../vault/index.js'
import { buildNetworkGraph } from '../vault/networkGraph.js'

export const networkRouter = Router()
networkRouter.get('/graph', (req, res) => {
  const scope = ['active', 'archive', 'all'].includes(req.query.scope) ? req.query.scope : 'active'
  res.json(buildNetworkGraph(buildVaultModel(), { scope }))
})

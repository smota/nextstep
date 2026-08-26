import { Router } from 'express'
import { buildVaultModel } from '../vault/index.js'

export const peopleRouter = Router()

peopleRouter.get('/', (req, res) => {
  const { people } = buildVaultModel()
  res.json(people)
})

peopleRouter.get('/:slug', (req, res) => {
  const { people } = buildVaultModel()
  const person = people.find((p) => p.slug === req.params.slug)
  if (!person) {
    res.status(404).json({ error: 'Person not found' })
    return
  }
  res.json(person)
})

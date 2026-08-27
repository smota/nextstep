import { Router } from 'express'
import { PATHS } from '../config/paths.js'
import { loadSkillRegistry } from '../skills/registry.js'

export const skillsRouter = Router()

skillsRouter.get('/', (req, res) => {
  res.json(loadSkillRegistry(PATHS.skillsRoot))
})

import path from 'node:path'
import { Router } from 'express'
import { PATHS } from '../config/paths.js'
import { IntakeStore } from '../intakes.js'
import { getRuntimeState } from '../runtime-state.js'
import { publicRoute } from './public.js'

export const intakeStore = new IntakeStore(PATHS.intakesDir)
export const createRouter = Router()
const route = (handler) => async (req, res) => { res.set('Cache-Control','private, no-store, max-age=0'); res.set('Pragma','no-cache'); await publicRoute(handler,req,res) }
createRouter.post('/intakes', route(async (req, res) => res.status(201).json(intakeStore.public(await intakeStore.create(req.body)))))
createRouter.get('/intakes/:id', route(async (req, res) => res.json(intakeStore.public(await intakeStore.get(req.params.id)))))
createRouter.post('/validate', route(async (req, res) => { const intake = req.body?.intakeId ? await intakeStore.get(req.body.intakeId) : null; res.json(getRuntimeState().runner.validate(req.body?.actionId, { ...req.body, intake })) }))
createRouter.post('/runs', route(async (req, res) => { const intake = req.body?.intakeId ? await intakeStore.get(req.body.intakeId) : null; res.status(202).json(getRuntimeState().runner.start(req.body?.actionId, { ...req.body, intake })) }))

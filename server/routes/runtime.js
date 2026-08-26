import { Router } from 'express'
import { getRuntimeState } from '../runtime-state.js'
import { publicRoute } from './public.js'

export const runtimeRouter=Router()
const route=handler=>async(req,res)=>publicRoute(handler,req,res)
runtimeRouter.get('/runtime/harnesses',route(async(req,res)=>{const {runtime,settings}=getRuntimeState();res.json({selectedHarness:settings.value.selectedHarness,probedAt:new Date().toISOString(),restartRequiredForProbe:true,harnesses:runtime.list()})}))
runtimeRouter.get('/settings/runtime',route(async(req,res)=>res.json(getRuntimeState().settings.public())))
runtimeRouter.put('/settings/runtime',route(async(req,res)=>res.json(await getRuntimeState().settings.update(req.body))))

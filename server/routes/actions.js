import { Router } from 'express'
import { PATHS } from '../config/paths.js'
import { getRuntimeState } from '../runtime-state.js'
import { invalidateVaultCache } from '../vault/index.js'
import { mutationCapability, transitionApplication, updateApplicationStatus } from '../vault/mutations.js'
import { publicRoute } from './public.js'

export const actionsRouter = Router()
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'timed_out', 'interrupted', 'awaiting_apply'])

export function streamRunEvents({ runner, run, req, res }) {
  const send = ({ event, run: value, id }) => { const safe=runner.publicRun?runner.publicRun(value):value;if(id)res.write(`id: ${id}\n`);res.write(`event: ${event}\ndata: ${JSON.stringify(safe)}\n\n`) }
  let highWater=Number(req.get?.('Last-Event-ID')||req.query?.after||0);if(!Number.isSafeInteger(highWater)||highWater<0)highWater=0
  let closed=false
  const latest=()=>runner.get?.(run.id)||run
  const replay=()=>{let count=0;for(const item of runner.store?.events?.(run.id,highWater)||[]){if(!Number.isSafeInteger(item.id)||item.id<=highWater)continue;send({event:item.type,run:latest(),id:item.id});highWater=item.id;count++}return count}
  let listener
  const cleanup=()=>listener&&runner.off(`run:${run.id}`,listener)
  const initial=latest();if(TERMINAL.has(initial.state)){send({event:'snapshot',run:initial});res.end();return}
  listener=event=>{if(!replay())send(event);const current=event.run||runner.get?.(run.id);if(TERMINAL.has(current.state)&&!closed){closed=true;cleanup();res.end()}}
  // Register first, then replay the durable log: emissions during setup are recovered by
  // the listener/replay high-water protocol and event IDs are emitted at most once.
  runner.on(`run:${run.id}`,listener)
  replay()
  const current=latest()
  send({event:'snapshot',run:current})
  replay()
  if(TERMINAL.has(current.state)){closed=true;cleanup();res.end();return}
  req.once('close',cleanup)
}

async function getRunner() { return getRuntimeState().runner }

async function route(handler, req, res) { return publicRoute(handler,req,res) }

actionsRouter.get('/capabilities', (req, res) => route(async () => {
  const runner = await getRunner(); const mutation = await mutationCapability(PATHS)
  const {runtime,settings}=getRuntimeState(); const selected=runtime.selected()
  res.json({ cli: { available:Boolean(selected?.available), reason:selected?.unavailableReason||null }, selectedHarness:settings.value.selectedHarness, harnesses:runtime.list(), mutation, actions: runner.catalog() })
}, req, res))
actionsRouter.post('/runs', (req, res) => route(async () => { const runner = await getRunner(); res.status(202).json(runner.start(req.body?.actionId, { slug: req.body?.slug, harnessId:req.body?.harnessId })) }, req, res))
actionsRouter.get('/runs', (req,res)=>route(async()=>res.json((await getRunner()).recent()),req,res))
actionsRouter.get('/runs/:id', (req, res) => route(async () => { const run = (await getRunner()).get(req.params.id); if (!run) return res.status(404).json({ error: 'Run not found' }); res.json(run) }, req, res))
actionsRouter.post('/runs/:id/cancel', (req, res) => route(async () => { const runner = await getRunner(); runner.cancel(req.params.id); const run=runner.get(req.params.id);if(!run)return res.status(404).json({error:'Run not found'});res.json(run) }, req, res))
actionsRouter.post('/runs/:id/discard', (req,res)=>route(async()=>{const runner=await getRunner();if(!runner.discard(req.params.id))return res.status(404).json({error:'Run not found'});res.json(runner.get(req.params.id))},req,res))
actionsRouter.post('/runs/:id/retry', (req,res)=>route(async()=>res.status(202).json(await (await getRunner()).retry(req.params.id)),req,res))
actionsRouter.post('/runs/:id/resume', (req,res)=>route(async()=>res.status(202).json(await (await getRunner()).retry(req.params.id)),req,res))
actionsRouter.post('/runs/:id/apply', (req,res)=>route(async()=>res.json((await getRunner()).apply(req.params.id,req.body||{})),req,res))
actionsRouter.get('/applications/:slug/runs', (req,res)=>route(async()=>res.json((await getRunner()).recent(req.params.slug)),req,res))
actionsRouter.get('/runs/:id/events', (req, res) => route(async () => {
  const runner = await getRunner(); const run = runner.get(req.params.id); if (!run) return res.status(404).json({ error: 'Run not found' })
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' }); res.flushHeaders?.()
  streamRunEvents({ runner, run, req, res })
}, req, res))
actionsRouter.post('/applications/:slug/transition', (req, res) => route(async () => {
  const capability = await mutationCapability(PATHS); if (!capability.available) return res.status(503).json({ error: capability.reason })
  res.json(await transitionApplication({ paths: PATHS, slug: req.params.slug, target: req.body?.target, reason: req.body?.reason, scope: req.body?.scope, invalidate: invalidateVaultCache }))
}, req, res))
actionsRouter.post('/applications/:slug/status', (req, res) => route(async () => {
  const capability = await mutationCapability(PATHS); if (!capability.available) return res.status(503).json({ error: capability.reason })
  res.json(await updateApplicationStatus({ paths: PATHS, slug: req.params.slug, status: req.body?.status, reason: req.body?.reason, scope: req.body?.scope, invalidate: invalidateVaultCache }))
}, req, res))

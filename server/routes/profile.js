import { Router } from 'express'
import { createProposal, getContext, HoloselfError, listProposals, reviewProposal, searchContext, showProposal } from '../holoself/adapter.js'

export const profileRouter = Router()
const sendError = (res, error) => { const e=error instanceof HoloselfError?error:new HoloselfError('Profile service unavailable'); res.status(e.status).json({ error:e.message, code:e.code }) }
profileRouter.get('/health', async (_req,res)=>{ try { const {health}=await getContext(); res.json(health) } catch(e){ sendError(res,e) } })
profileRouter.get('/context', async (_req,res)=>{ try { res.json(await getContext()) } catch(e){ sendError(res,e) } })
profileRouter.get('/search', async (req,res)=>{ try { res.json({results:await searchContext(req.query.q)}) } catch(e){ sendError(res,e) } })
profileRouter.get('/proposals', async (_req,res)=>{ try { res.json(await listProposals()) } catch(e){ sendError(res,e) } })
profileRouter.get('/proposals/:id', async (req,res)=>{ try { res.json(await showProposal(req.params.id)) } catch(e){ sendError(res,e) } })
profileRouter.post('/proposals', async (req,res)=>{ try { res.status(201).json(await createProposal(req.body?.claim)) } catch(e){ sendError(res,e) } })
profileRouter.post('/proposals/:id/:action', async (req,res)=>{ try { res.json(await reviewProposal(req.params.id,req.params.action,req.body?.confirmation)) } catch(e){ sendError(res,e) } })

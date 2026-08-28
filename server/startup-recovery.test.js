import test from 'node:test'
import assert from 'node:assert/strict'
import { runStartupRecovery } from './startup-recovery.js'

test('all active recoveries finish before runtime initialization and serving prerequisites',async()=>{const events=[],operation=name=>()=>events.push(name),runtime={ready:true};const result=await runStartupRecovery({paths:{vaultRoot:'/fixture'},operations:{recoverTransactions:operation('transactions'),recoverApplications:operation('applications'),recoverMoves:operation('moves')},initializeRuntime:async()=>{events.push('runtime');return runtime},cleanupIntakes:async()=>events.push('intakes')});assert.equal(result,runtime);assert.deepEqual(events,['moves','transactions','applications','runtime','intakes'])})

test('recovery failure prevents runtime initialization',async()=>{let initialized=false;await assert.rejects(()=>runStartupRecovery({paths:{vaultRoot:'/fixture'},operations:{recoverTransactions(){throw new Error('unsafe journal')}},initializeRuntime:async()=>{initialized=true},cleanupIntakes:async()=>{}}),/unsafe journal/);assert.equal(initialized,false)})

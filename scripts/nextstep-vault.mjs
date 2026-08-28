#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { PATHS, validateConfiguredPaths } from '../server/config/paths.js'
import { executeRelationalCommand } from '../server/vault/relational/commands.js'
import { auditChecksums, validateApplication, validateStructure } from '../server/vault/relational/model.js'
import { applyReindexPlan, buildReindexPlan } from '../server/vault/relational/reindex.js'
import { buildTransmissionBackfillPreview } from '../server/vault/relational/backfill.js'

const output=v=>process.stdout.write(`${JSON.stringify(v,null,2)}\n`)
function args(values){const [action,...rest]=values,o={};for(let i=0;i<rest.length;i+=2){if(!rest[i]?.startsWith('--')||rest[i+1]==null)throw Object.assign(new Error('Arguments must be --key value pairs'),{code:'USAGE'});o[rest[i].slice(2)]=rest[i+1]}return{action,o}}
function input(file){const resolved=path.resolve(file||'');if(!resolved.startsWith(`${PATHS.vaultRoot}${path.sep}`))throw Object.assign(new Error('Input file must be inside NEXTSTEP_DATA_ROOT'),{code:'UNSAFE_INPUT_FILE'});return JSON.parse(fs.readFileSync(resolved,'utf8'))}
try{validateConfiguredPaths();const{action,o}=args(process.argv.slice(2));if(action==='execute')output(executeRelationalCommand({paths:PATHS,command:input(o['command-file'])}));else if(action==='validate-application')output(validateApplication(PATHS.candidaturesDir,o['application-id']));else if(action==='validate-structure')output(validateStructure(PATHS.candidaturesDir));else if(action==='audit-checksums')output(auditChecksums(PATHS.candidaturesDir));else if(action==='reindex-preview'){const p=buildReindexPlan(PATHS,{applicationId:o['application-id']||null}),{generated,...safe}=p;output(safe)}else if(action==='reindex-apply'){const p=buildReindexPlan(PATHS,{applicationId:o['application-id']||null});output(applyReindexPlan(PATHS,p,{expectDigest:o['expect-digest']}))}else if(action==='backfill-preview')output(buildTransmissionBackfillPreview({paths:PATHS,spec:input(o['spec-file'])}));else throw Object.assign(new Error('Unknown vault command'),{code:'USAGE'})}catch(e){process.stderr.write(`${JSON.stringify({error:e.message,code:e.code||'RELATIONAL_FAILED',details:e.errors||undefined},null,2)}\n`);process.exitCode=1}

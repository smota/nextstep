import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { moveApplicationStorage } from './lifecycleMove.js'

const slug='astrazeneca-senior-director-enterprise-ai-platforms'
const locks=()=>{let n=0;return (_tool,args)=>args[0]==='acquire'?{lock:{owner_token:`t${++n}`}}:{status:'released'}}
test('archives exact AstraZeneca rows while preserving lifecycle-like prose',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'az-archive-')),c=path.join(root,'Candidatures'),apps=path.join(c,'applications'),archive=path.join(c,'archive','applications'),folder=path.join(apps,slug),coord=path.join(root,'.coordination')
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));for(const d of [folder,archive,path.join(coord,'locks')])fs.mkdirSync(d,{recursive:true})
 fs.writeFileSync(path.join(folder,'metadata.md'),'---\ncompany: AstraZeneca\nrole: Senior Director Enterprise AI Platforms\nstatus: withdrawn\napplication_revision: 0\n---\n')
 fs.writeFileSync(path.join(folder,'index.md'),'---\nstatus: withdrawn\n---\n- **Status:** withdrawn — not applied\nNarrative not applied and previously archived stays.\n')
 const bullet=`- [[${slug}/index|AstraZeneca — Senior Director Enterprise AI Platforms]] — withdrawn; not applied because the role changed; previously archived discussion; interview notes\n`
 fs.writeFileSync(path.join(apps,'index.md'),bullet);fs.writeFileSync(path.join(archive,'index.md'),'# Archive\n')
 const main=`| Company | Role | Status | Notes | Workspace |\n|---|---|---|---|---|\n| AstraZeneca | Interview Platform Leader | withdrawn | Not applied; previously archived context | [[applications/${slug}/index|open]] |\n`
 fs.writeFileSync(path.join(c,'index.md'),main);fs.writeFileSync(path.join(coord,'audit-log.md'),'# Audit\n')
 const paths={vaultRoot:root,candidaturesDir:c,applicationsDir:apps,archiveApplicationsDir:archive,locksDir:path.join(coord,'locks'),auditLogPath:path.join(coord,'audit-log.md')}
 const result=moveApplicationStorage({paths,slug,scope:'active',target:'archived',deps:{lockCommand:locks()}})
 assert.equal(result.storageScope,'archive');assert.equal(fs.existsSync(path.join(archive,slug)),true)
 assert.match(fs.readFileSync(path.join(archive,'index.md'),'utf8'),/— archived; not applied because.*previously archived.*interview notes/)
 const localOut=fs.readFileSync(path.join(archive,slug,'index.md'),'utf8');assert.match(localOut,/- \*\*Status:\*\* archived — not applied/);assert.match(localOut,/Narrative not applied and previously archived stays/)
 const mainOut=fs.readFileSync(path.join(c,'index.md'),'utf8');assert.match(mainOut,/Interview Platform Leader \| archived \| Not applied; previously archived context/)
})

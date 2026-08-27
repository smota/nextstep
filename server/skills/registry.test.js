import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { loadSkillRegistry } from './registry.js'

test('registry distinguishes complete product skills from external implementations', t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nextstep-skills-'))
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
  const product=path.join(root,'product-skill'),external=path.join(root,'external-skill')
  fs.mkdirSync(product);fs.mkdirSync(external)
  fs.writeFileSync(path.join(product,'SKILL.md'),'---\nname: product-skill\ndescription: Product workflow\nmetadata:\n  owner: nextstep\n  kind: product-skill\n  version: 1\n---\n')
  fs.writeFileSync(path.join(external,'SKILL.md'),'---\nname: external-skill\ndescription: External implementation\n---\n')
  const skills=loadSkillRegistry(root)
  assert.deepEqual(skills.map(({id,owner,kind,version})=>({id,owner,kind,version})),[
    {id:'external-skill',owner:null,kind:'external-skill',version:null},
    {id:'product-skill',owner:'nextstep',kind:'product-skill',version:1},
  ])
})

test('registry returns no skills without a configured absolute root',()=>{
  assert.deepEqual(loadSkillRegistry(null),[])
  assert.deepEqual(loadSkillRegistry('relative'),[])
})

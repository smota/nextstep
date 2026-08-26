import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createDisposableIndex } from './disposableIndex.js'

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'career-index-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const source = path.join(root, 'Candidatures')
  const cacheFile = path.join(root, 'app', '.cache', 'index.json')
  fs.mkdirSync(source, { recursive: true })
  const md = path.join(source, 'metadata.md')
  fs.writeFileSync(md, 'one')
  let builds = 0
  const index = createDisposableIndex({ vaultRoot: root, cacheFile, sourceRoots: [source], buildModel: () => ({ value: fs.readFileSync(md, 'utf8'), build: ++builds }) })
  return { index, cacheFile, md, builds: () => builds }
}

test('reuses a valid versioned index and rebuilds after a direct MD change', (t) => {
  const f = fixture(t)
  assert.equal(f.index.load().state, 'rebuilt')
  assert.equal(f.index.load().state, 'ready')
  fs.writeFileSync(f.md, 'changed-content')
  const changed = f.index.load()
  assert.equal(changed.state, 'rebuilt')
  assert.equal(changed.model.value, 'changed-content')
  assert.equal(f.builds(), 2)
})

test('removal failure is explicit rebuild-required post-commit maintenance and next load rebuilds',t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'career-index-fail-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const source=path.join(root,'Candidatures'),cacheFile=path.join(root,'app','.cache','index.json');fs.mkdirSync(source,{recursive:true});fs.writeFileSync(path.join(source,'metadata.md'),'one');let builds=0;const index=createDisposableIndex({vaultRoot:root,cacheFile,sourceRoots:[source],buildModel:()=>({build:++builds}),removeFile(){throw Object.assign(new Error('busy'),{code:'EBUSY'})}});index.load();assert.deepEqual(index.remove(),{state:'rebuild_required'});assert.equal(index.state(),'rebuild_required');assert.equal(index.load().state,'rebuilt');assert.equal(builds,2);assert.equal(index.state(),'ready')})

test('recovers from corruption and deletion', (t) => {
  const f = fixture(t)
  f.index.load()
  fs.writeFileSync(f.cacheFile, '{broken')
  assert.equal(f.index.load().state, 'rebuilt')
  fs.rmSync(f.cacheFile)
  assert.equal(f.index.load().state, 'rebuilt')
  assert.equal(f.builds(), 3)
})

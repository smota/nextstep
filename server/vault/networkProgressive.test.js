import test from 'node:test'
import assert from 'node:assert/strict'
import {neighborhood,visibleEdges,MAX_INITIAL_NODES} from '../../client/src/pages/networkModel.js'
const nodes=Array.from({length:105},(_,i)=>({id:`n:${String(i).padStart(3,'0')}`}))
const edges=Array.from({length:104},(_,i)=>({id:`e:${i}`,source:nodes[i].id,target:nodes[i+1].id}))
test('default graph is bounded and deterministic',()=>{assert.equal(neighborhood(nodes,edges,null).length,MAX_INITIAL_NODES);assert.deepEqual(neighborhood([...nodes].reverse(),[...edges].reverse(),null),neighborhood(nodes,edges,null))})
test('centered graph reveals one hop then explicitly expands',()=>{assert.deepEqual(neighborhood(nodes,edges,'n:050',1).map(n=>n.id),['n:049','n:050','n:051']);assert.deepEqual(neighborhood(nodes,edges,'n:050',2).map(n=>n.id),['n:048','n:049','n:050','n:051','n:052']);assert.equal(visibleEdges(edges,neighborhood(nodes,edges,'n:050',1)).length,2)})

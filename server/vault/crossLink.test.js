import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCrossLinks } from './crossLink.js'
import { buildNetworkGraph } from './networkGraph.js'

test('cross links expose safe scoped opportunity objects from physical storage scope',()=>{
 const applications=[{slug:'active-role',role:'Active role',storageScope:'active',archived:false,companyProfile:{slug:'acme'},people:[{slug:'pat'}]},{slug:'old-role',role:'Old role',storageScope:'archive',archived:true,companyProfile:{slug:'acme'},people:[{slug:'pat'}]},{slug:'../escape',storageScope:'archive',archived:true,companyProfile:{slug:'acme'},people:[]}]
 const companies=[{slug:'acme',name:'Acme'}],people=[{slug:'pat',name:'Pat'}]
 buildCrossLinks({applications,companies,people})
 assert.deepEqual(companies[0].referencedByApplications,[{slug:'active-role',scope:'active',label:'Active role',href:'/opportunities/active-role?scope=active'},{slug:'old-role',scope:'archive',label:'Old role',href:'/opportunities/old-role?scope=archive'},{slug:'../escape',scope:'archive',label:'../escape',href:null}])
 assert.equal(people[0].referencedByApplications[1].scope,'archive')
 const graph=buildNetworkGraph({applications,companies,people},{scope:'archive'})
 assert.deepEqual(graph.nodes.find(node=>node.id==='company:acme').linkedOpportunities.map(x=>x.slug),['../escape','old-role'])
})

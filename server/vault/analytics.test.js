import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAnalytics, filterAnalyticsApplications } from './analytics.js'

const app = (slug, status, extra={}) => ({ slug, status, company:slug, role:'Role', tags:[], metadataExists:true, lifecycle:{ valid:true, logicallyArchived:false }, preparation:{state:'ready_for_next_step'}, ...extra })
const apps=[app('z','identified',{country:'Belgium'}),app('a','identified',{country:'Belgium',languageRisk:'French'}),app('b','rejected',{country:'France'}),app('c','archived',{archived:true,country:'France',lifecycle:{valid:true,logicallyArchived:true}})]

test('active/all/archive filters preserve archive semantics',()=>{
 assert.deepEqual(filterAnalyticsApplications(apps,'active').map(x=>x.slug),['z','a'])
 assert.equal(filterAnalyticsApplications(apps,'all').length,4)
 assert.deepEqual(filterAnalyticsApplications(apps,'archive').map(x=>x.slug),['c'])
})
test('country counts and active/closed splits are deterministic',()=>{
 const data=buildAnalytics(apps,{scope:'all',now:0})
 assert.deepEqual(data.geography.countries.map(x=>[x.country,x.count,x.active,x.closed]),[['Belgium',2,2,0],['France',2,0,2]])
})
test('ties sort alphabetically and no-data produces empty projections',()=>{
 const tied=buildAnalytics([app('x','identified',{country:'Zulu'}),app('y','identified',{country:'Alpha'})],{now:0})
 assert.deepEqual(tied.geography.countries.map(x=>x.country),['Alpha','Zulu'])
 const empty=buildAnalytics([],{now:0})
 assert.equal(empty.overview.total,0); assert.deepEqual(empty.geography.countries,[])
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { createRouter, intakeStore } from './create.js'

function routeHandler(routePath,method){const layer=createRouter.stack.find(x=>x.route?.path===routePath&&x.route.methods[method]);return layer.route.stack[0].handle}
function response(){return {headers:{},statusCode:200,body:null,set(k,v){if(typeof k==='object')Object.assign(this.headers,k);else this.headers[k]=v;return this},status(code){this.statusCode=code;return this},json(value){this.body=value;return this}}}

test('every intake route response is private and non-cacheable',async()=>{for(const [routePath,method,req] of [['/intakes','post',{body:{type:'invalid'}}],['/intakes/:id','get',{params:{id:'invalid'}}]]){const res=response();await routeHandler(routePath,method)(req,res);assert.match(res.headers['Cache-Control'],/private/);assert.match(res.headers['Cache-Control'],/no-store/);assert.equal(res.headers.Pragma,'no-cache')}})

test('public intake response never exposes an absolute cache path',()=>{const value=intakeStore.public({id:'088e2571-8562-4644-9000-03e9f2e01f9a',type:'text',filename:'source.txt',size:20,createdAt:'2026-01-01T00:00:00.000Z',source:{path:'C:\\secret\\source.txt',mime:'text/plain'}});assert.equal(JSON.stringify(value).includes('secret'),false);assert.equal(Object.hasOwn(value.source,'path'),false)})

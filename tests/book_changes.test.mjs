import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile,access} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import express from 'express';
import {materialReferences} from '../server/book/materials.mjs';
import {chunks} from '../server/content.mjs';
const dir=await mkdtemp(path.join(os.tmpdir(),'book-changes-'));process.env.SELF_STUDY_DATA_DIR=dir;
const {save,get,list,db}=await import('../server/store.mjs');
const {bookRouter,bookBridge}=await import('../server/book/routes.mjs');
const {ai}=await import('../server/teaching.mjs');
// This suite tests configured generation with a mocked bridge.
ai.store.default('builtin-codex-default',0);
const app=express();app.use(express.json());app.use(bookRouter);app.use((e,req,res,next)=>res.status(400).json({error:e.message}));
const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});const url=`http://127.0.0.1:${server.address().port}`;
const calls=[];let failure=false;
bookBridge.request=async(method,args)=>{calls.push({method,args});if(failure)throw Error('引擎不可用');if(method==='get')return {pages:[{id:'page',title:'章',status:'ready',blocks:[]}]};if(method==='index')return {kb:'app-source-'+args.source_id,model:'embeddinggemma',dimensions:768};if(method==='create')return {book:{id:'bk_test',title:'长材料书'}};return {status:'ready'}};
ai.generate=async()=>{throw Error('入库与方案准备不应调用本地摘要')};
const request=(route,method='GET',body)=>fetch(url+route,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
function project(id,extra={}){return save('projects',{id,kind:'book',title:id,profile:{goal:'学习资料'},stage:'reading',bookId:'bk_test',...extra})}
async function done(id){for(let n=0;n<100;n++){const j=get('jobs',id);if(!['queued','running'].includes(j.status))return j;await new Promise(r=>setTimeout(r,10))}throw Error('任务超时')}
test('proposal requires separate indexing; passes only file references and KBs',async()=>{
 project('long',{stage:'input',bookId:undefined});const text='背景事实'.repeat(23000)+'末尾唯一知识';save('sources',{id:'long-source',projectId:'long',status:'ready',title:'长资料',chunks:chunks([{text}],'long-source')});
 assert.equal((await request('/projects/long/proposal','POST',{})).status,400);
 const ingest=await request('/projects/long/sources/long-source/index','POST',{});assert.equal(ingest.status,200);assert.equal((await done((await ingest.json()).id)).status,'completed');
 assert.equal(get('sources','long-source').indexStatus,'ready');assert.match(calls.find(c=>c.method==='index').args.text,/末尾唯一知识/);
 const r=await request('/projects/long/proposal','POST',{});assert.equal(r.status,200);const j=await done((await r.json()).id);assert.equal(j.status,'completed',j.error);
 const create=calls.find(c=>c.method==='create');assert.equal(create.args.source_refs[0].kind,'file');assert.equal(create.args.source_refs[0].excerpt,undefined);assert.deepEqual(create.args.knowledge_bases,['app-source-long-source']);
 assert.equal(get('sources','long-source').chunks.map(c=>c.text).join(''),text);
});
test('failed indexing retains source and can retry; other project cannot index it',async()=>{
 project('failed',{stage:'input',bookId:undefined});save('sources',{id:'retry-source',projectId:'failed',status:'ready',title:'资料',chunks:[{id:'raw',text:'完整原文'}]});
 project('foreign');assert.equal((await request('/projects/foreign/sources/retry-source/index','POST',{})).status,400);
 failure=true;const r=await request('/projects/failed/sources/retry-source/index','POST',{});assert.equal((await done((await r.json()).id)).status,'failed');assert.equal(get('sources','retry-source').indexStatus,'failed');assert.equal(get('sources','retry-source').chunks[0].text,'完整原文');failure=false;
 const retry=await request('/projects/failed/sources/retry-source/index','POST',{});assert.equal((await done((await retry.json()).id)).status,'completed');
 assert.throws(()=>materialReferences(Array(33).fill(get('sources','retry-source'))),/32/);
});
test('regeneration bypasses ready cache and resets only target reading and chat after success',async()=>{
 project('regen',{reading:{page:{progress:100,bookmark:true},other:{progress:70}}});save('conversations',{id:'regen:page',projectId:'regen',messages:[]});
 const cached=await (await request('/projects/regen/pages/page/generate','POST',{})).json();assert.equal(cached.cached,true);
 const r=await request('/projects/regen/pages/page/generate','POST',{regenerate:true});assert.equal(r.status,200);assert.equal((await done((await r.json()).id)).status,'completed');assert.equal(calls.at(-1).args.force,true);
 assert.deepEqual(get('projects','regen').reading,{page:{progress:0,bookmark:true},other:{progress:70}});assert.equal(get('conversations','regen:page'),null);
 assert.equal((await request('/projects/regen/pages/page/visual','POST',{kind:'figure'})).status,404);
});
test('deletion blocks running tasks; failures preserve project; success isolates cascade',async()=>{
 project('delete');project('keep');save('memories',{id:'personal',text:'个人偏好'});
 save('jobs',{id:'running',projectId:'delete',status:'running'});assert.equal((await request('/projects/delete','DELETE')).status,400);assert.ok(get('projects','delete'));save('jobs',{id:'running',projectId:'delete',status:'completed'});
 failure=true;assert.equal((await request('/projects/delete','DELETE')).status,400);assert.equal(get('projects','delete').deleting,undefined);failure=false;
 await mkdir(path.join(dir,'uploads'));const file=path.join(dir,'uploads','source');await writeFile(file,'test');save('sources',{id:'delete-source',projectId:'delete',filePath:file});
 for(const table of ['activities','conversations','attempts','lessons']){save(table,{id:'delete-'+table,projectId:'delete'});save(table,{id:'keep-'+table,projectId:'keep'})}
 assert.equal((await request('/projects/delete','DELETE')).status,200);assert.equal(get('projects','delete'),null);assert.ok(get('projects','keep'));assert.ok(get('memories','personal'));assert.equal(list('sources','delete').length,0);await assert.rejects(access(file));
 for(const table of ['activities','conversations','attempts','lessons']){assert.equal(list(table,'delete').length,0);assert.equal(list(table,'keep').length,1)}
});
test.after(async()=>{await new Promise(r=>server.close(r));bookBridge.close();ai.close();db.close();await rm(dir,{recursive:true,force:true})});

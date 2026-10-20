import {mkdtemp,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
import {CatalogStore} from '../server/settings/catalog.mjs';import {EmbeddingRuntime} from '../server/settings/embedding.mjs';import {BookBridge} from '../server/book/bridge.mjs';
const root=path.resolve(new URL('..',import.meta.url).pathname),dataDir=await mkdtemp(path.join(os.tmpdir(),'embedding-real-smoke-'));
const store=new CatalogStore(dataDir);let c=store.saveProvider({id:'local-test',name:'Local test',vendor:'ollama',url:'http://127.0.0.1:11434/v1',format:'auto',version:''},0);
c=store.saveEmbedding({id:'test-embedding',name:'Embedding test',modelId:'embeddinggemma',providerId:'local-test',protocol:'ollama',dimensions:'768',batchSize:'8',timeout:'60',sendDimensions:false},c.revision);
c=store.embeddingDefault('test-embedding',c.revision);
const runtime=new EmbeddingRuntime(store);let bridge;
try{
 const probe=await runtime.test('test-embedding',{probe:true}),tested=await runtime.test('test-embedding');assert.equal(probe.dimensions,768);assert.equal(tested.dimensions,768);
 bridge=new BookBridge({root,dataDir,ai:{generate(){throw Error('Embedding verification must not call a language model')}}});
 const result=await bridge.request('index',{source_id:'embedding-smoke',title:'自编灌溉说明',text:'蓝鲸七号是蓝莓园的灌溉系统。该系统使用雨量传感器来检测降雨，降雨充足时暂停浇水。园区每天记录土壤湿度，并在早晨检查供水阀门。'});
 assert.equal(result.dimensions,768);assert.ok(result.fingerprint);
 const found=await bridge.request('search',{query:'蓝鲸七号使用什么传感器？',kb_name:result.kb});assert.match(found.content,/雨量传感器/);
 assert.throws(()=>store.saveEmbedding({...store.load().embeddingModels[0],dimensions:'512'},c.revision),/已有材料索引/);
 bridge.close();await new Promise(r=>setTimeout(r,300));bridge=new BookBridge({root,dataDir,ai:{}});
 const restart=await bridge.request('search',{query:'蓝鲸七号',kb_name:result.kb});assert.match(restart.content,/雨量传感器/);
 console.log(JSON.stringify({ok:true,probeDimensions:probe.dimensions,testDimensions:tested.dimensions,indexed:true,retrieved:true,restartRetrieved:true,indexChangeBlocked:true}));
}finally{bridge?.close();await new Promise(r=>setTimeout(r,300));await rm(dataDir,{recursive:true,force:true})}

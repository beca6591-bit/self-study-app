import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {BookBridge} from '../server/book/bridge.mjs';
const root=path.resolve(new URL('..',import.meta.url).pathname),dataDir=await mkdtemp(path.join(os.tmpdir(),'book-library-smoke-'));let prompts=[];
const ai={generate:async prompt=>{prompts.push(prompt);return {value:{text:JSON.stringify({title:'材料学习',description:'学习资料',scope:'资料范围',target_level:'入门',estimated_chapters:2,rationale:'材料支持'})}}}};
let bridge=new BookBridge({root,dataDir,ai});
try{
 const text=Array.from({length:600},(_,i)=>`Section ${i+1}: A household budget records income and expenses. Keep an emergency fund and review spending each month. Compare assets with liabilities. `).join('\n')+'\n尾部独特内容：蓝莓园的灌溉系统采用雨量传感器，代号蓝鲸七号。';
 const input={source_id:'smoke-test',title:'测试材料',text};
 const index=await bridge.request('index',input,progress=>console.log(progress));assert.ok(index.characters>80000);assert.equal(prompts.length,0,'入库不应调用 LLM');
 const found=await bridge.request('search',{query:'蓝鲸七号灌溉系统采用什么传感器',kb_name:index.kb});assert.match(found.content,/雨量传感器/);assert.equal(prompts.length,0);
 bridge.close();await new Promise(r=>setTimeout(r,500));bridge=new BookBridge({root,dataDir,ai});
 const persisted=await bridge.request('search',{query:'蓝鲸七号',kb_name:index.kb});assert.match(persisted.content,/雨量传感器/);
 const book=await bridge.request('create',{user_intent:'学习材料',language:'zh',depth:'brief',source_refs:[{id:'smoke-test',kind:'file',source_id:'material.txt',label:'测试材料',available:true,metadata:{kb_name:index.kb,path:'material.txt'}}],knowledge_bases:[index.kb]});
 assert.ok(book.book.id);assert.ok(prompts.length>0);assert.ok(prompts[0].length<16000,'方案仅使用有界摘录');assert.match(prompts[0],/household budget/);
 console.log(JSON.stringify({ok:true,characters:index.characters,model:index.model,dimensions:index.dimensions,retrievalSources:found.sources.length,proposalPromptCharacters:prompts[0].length,restartRetrieval:true}));
}finally{bridge.close();await new Promise(r=>setTimeout(r,500));await rm(dataDir,{recursive:true,force:true})}

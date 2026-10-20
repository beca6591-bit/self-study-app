import {BookBridge} from '../server/book/bridge.mjs';
import {TutorAI} from '../server/ai.mjs';
import {mkdir,cp,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),dataDir=path.join(root,'data-book-native-'+Date.now());
await mkdir(dataDir,{recursive:true});
await cp(path.join(root,'data-book-on-demand-1792300271502/book-engine'),path.join(dataDir,'book-engine'),{recursive:true});
const book_id='bk_8177b19934',page_id='pg_246ba30820';
const pagePath=path.join(dataDir,'book-engine/data/user/workspace/book/book_'+book_id+'/pages/'+page_id+'.json');
const before=JSON.parse(await readFile(pagePath));
await writeFile(pagePath,JSON.stringify({...before,status:'pending',blocks:[]}));
const ai=new TutorAI(path.join(dataDir,'ai-workspace')),bridge=new BookBridge({root,dataDir,ai});
const report={dataDir,checks:[]};
try{
 console.log('DATA',dataDir);await ai.connect();
 const page=await bridge.request('compile',{book_id,page_id});
 await writeFile(path.join(dataDir,'chapter.json'),JSON.stringify(page,null,2));
 report.blocks=page.blocks.map(b=>({type:b.type,status:b.status,error:b.error,render:b.payload?.render_type}));
 console.log('BLOCKS',JSON.stringify(report.blocks));
 const state=await bridge.request('get',{book_id});
 assert.equal(state.book.metadata.block_types,undefined);report.checks.push('legacy restriction removed');
 assert.ok(page.blocks.some(b=>['figure','animation','interactive'].includes(b.type)),'planner selected no visual in this sample');
 assert.equal(page.status,'ready');report.checks.push('automatic real chapter generation ready');
 report.bookId=book_id;report.pageId=page_id;report.success=true;
}catch(e){report.error=e.message;report.success=false;console.error('FAIL',e.message);process.exitCode=1}
finally{await writeFile(path.join(dataDir,'verification.json'),JSON.stringify(report,null,2));bridge.close();ai.close()}

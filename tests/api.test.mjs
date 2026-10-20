import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import Database from 'better-sqlite3';
const dir=await mkdtemp(path.join(os.tmpdir(),'study-api-test-'));const port=4181,base=`http://127.0.0.1:${port}/api`;let server;
async function start(){server=spawn(process.execPath,[new URL('../server/index.mjs',import.meta.url).pathname],{env:{...process.env,SELF_STUDY_DATA_DIR:dir,SELF_STUDY_PORT:String(port)},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('server startup timeout')),10000);server.stdout.on('data',()=>{clearTimeout(t);resolve()});server.on('error',reject)})}
async function stop(){const exited=new Promise(r=>server.once('exit',r));server.kill('SIGTERM');await exited}
function pdf(){const text='This learning document explains supply and demand with a concrete example.';const stream=`BT /F1 12 Tf 50 700 Td (${text}) Tj ET`;const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];let out='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`});const x=out.length;out+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;return out}
test('real HTTP import parses PDF, rejects foreign origins and survives restart',async()=>{await start();const bad=await fetch(base+'/projects',{headers:{Origin:'https://unrelated.example'}});assert.equal(bad.status,403);
 const r=await fetch(base+'/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Isolated test',goal:'Understand'})});const p=await r.json();assert.equal(r.status,200);
 const f=new FormData();f.append('file',new Blob([pdf()],{type:'application/pdf'}),'test.pdf');const upload=await fetch(base+'/projects/'+p.id+'/sources/file',{method:'POST',body:f});const source=await upload.json();assert.equal(upload.status,200,JSON.stringify(source));assert.ok(source.characters>30);assert.equal(source.filePath,undefined);
 const raw=await fetch(base+'/sources/'+source.id+'/chunks').then(r=>r.json());assert.match(raw.chunks[0].text,/supply and demand/);
 await stop();await start();const persisted=await fetch(base+'/projects/'+p.id).then(r=>r.json());assert.equal(persisted.sources.length,1);assert.equal(persisted.title,'Isolated test');
});
test('completion endpoint preserves date and notes on replay and requires new review evidence',async()=>{
 const db=new Database(path.join(dir,'study.sqlite'));
 try{
  const lesson={id:'completion-fixture',projectId:'fixture-project',status:'learning',note:'initial'};
  db.prepare('INSERT INTO lessons(id,project_id,data,created_at) VALUES(?,?,?,?)').run(lesson.id,lesson.projectId,JSON.stringify(lesson),new Date().toISOString());
  const patch=body=>fetch(base+'/lessons/'+lesson.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const initial=await patch({complete:true,expectedReviewAt:'initial'}).then(r=>r.json());
  assert.equal(initial.reviewCount,0);
  await patch({note:'new saved note'});
  const replay=await patch({complete:true,expectedReviewAt:'initial',note:'stale note'}).then(r=>r.json());
  assert.equal(replay.reviewAt,initial.reviewAt);
  assert.equal(replay.note,'new saved note');
  assert.equal((await patch({complete:true,expectedReviewAt:initial.reviewAt})).status,400);
  const updated={...replay,reviewCompletedAt:new Date(Date.now()-10000).toISOString()};
  db.prepare('UPDATE lessons SET data=? WHERE id=?').run(JSON.stringify(updated),lesson.id);
  const attempt={id:'fresh-review',projectId:lesson.projectId,lessonId:lesson.id,status:'completed',createdAt:new Date(Date.now()-1000).toISOString()};
  db.prepare('INSERT INTO attempts(id,project_id,data,created_at) VALUES(?,?,?,?)').run(attempt.id,attempt.projectId,JSON.stringify(attempt),attempt.createdAt);
  const completed=await patch({complete:true,expectedReviewAt:initial.reviewAt}).then(r=>r.json());
  assert.equal(completed.reviewCount,1);
  const duplicate=await patch({complete:true,expectedReviewAt:initial.reviewAt}).then(r=>r.json());
  assert.equal(duplicate.reviewAt,completed.reviewAt);
  assert.equal(duplicate.reviewCount,1);
 }finally{db.close()}
});
test('new navigation data persists; setup is hidden and removed sources retain citations',async()=>{
 const request=async(route,method='GET',body)=>{const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,200);return r.json()};
 const draft=await request('/projects/setup','POST',{});
 assert.ok(!(await request('/projects')).some(p=>p.id===draft.id));
 const source=await request('/projects/'+draft.id+'/sources/text','POST',{title:'source',text:'A sufficiently long original document for learning.'});
 await request('/projects/'+draft.id+'/profile','PATCH',{title:'new flow',goal:'understand',duration:'15'});
 assert.ok((await request('/projects')).some(p=>p.id===draft.id));
 await request('/memories','POST',{text:'I work in design.'});
 await request('/projects/'+draft.id+'/activity','POST',{});
 await request('/memories','POST',{text:'A later memory.'});
 await request('/projects/'+draft.id+'/activity','POST',{});
 assert.equal((await request('/projects/'+draft.id)).memorySnapshot,'I work in design.');
 await request('/projects/'+draft.id+'/sources/'+source.id,'DELETE');
 assert.equal((await request('/projects/'+draft.id)).sources.length,0);
 assert.match((await request('/sources/'+source.id+'/chunks')).chunks[0].text,/original document/);
 await stop();await start();
 assert.equal((await request('/memories')).length,2);
 assert.equal((await request('/activities')).filter(a=>a.projectId===draft.id).length,2);
});
test('removed ready links can be added again without fetching or duplicating',async()=>{
 const db=new Database(path.join(dir,'study.sqlite'));
 const project={id:'link-restore',profile:{goal:'test'}};
 const source={id:'removed-youtube',projectId:project.id,title:'test',kind:'youtube',url:'https://www.youtube.com/watch?v=abcdefghijk',status:'ready',removed:true,chunks:[{id:'removed-youtube:1',text:'saved transcript'}]};
 for(const [table,value] of [['projects',project],['sources',source]])db.prepare(`INSERT INTO ${table}(id,project_id,data,created_at) VALUES(?,?,?,?)`).run(value.id,value.projectId||value.id,JSON.stringify(value),new Date().toISOString());
 db.close();
 const r=await fetch(base+'/projects/'+project.id+'/sources/link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:source.url})});assert.equal(r.status,200);
 const restored=await fetch(base+'/projects/'+project.id).then(r=>r.json());assert.equal(restored.sources.length,1);assert.equal(restored.sources[0].id,source.id);
});
test.after(async()=>{if(server?.exitCode===null)await stop();await rm(dir,{recursive:true,force:true})});

test('book projects validate input, accept optional sources and survive restart',async()=>{
 const request=(route,body)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await request('/books/projects',{goal:''})).status,400);
 const r=await request('/books/projects',{goal:'Understand triangles',depth:'brief'});assert.equal(r.status,200);const p=await r.json();assert.equal(p.stage,'input');
 assert.equal(p.knowledgeSource,'general');
 assert.equal((await request('/books/projects/'+p.id+'/spine',{})).status,400);
 const src=await request('/projects/'+p.id+'/sources/text',{title:'Triangles',text:'A right triangle has exactly one right angle. The hypotenuse is its longest side.'});assert.equal(src.status,200);
 const longText='长背景材料'.repeat(20000)+'最后的独特知识';const form=new FormData();form.append('file',new Blob([longText]),'long-background.txt');const uploaded=await fetch(base+'/projects/'+p.id+'/sources/file',{method:'POST',body:form});assert.equal(uploaded.status,200);const longSource=await uploaded.json();assert.ok(longSource.characters>80000);const raw=await fetch(base+'/sources/'+longSource.id+'/chunks').then(r=>r.json());assert.equal(raw.chunks.map(c=>c.text).join(''),longText);
 await stop();await start();const restored=await fetch(base+'/books/projects/'+p.id).then(r=>r.json());assert.equal(restored.goal,p.goal);assert.equal(restored.sources.length,2);assert.equal(restored.knowledgeSource,'documents');assert.equal(restored.snapshot,null);
 const empty=await request('/books/projects',{goal:'Learn basic geometry without documents'}).then(r=>r.json());
 const queued=await request('/books/projects/'+empty.id+'/proposal',{});assert.equal(queued.status,200);assert.equal((await queued.json()).kind,'book:proposal');
});

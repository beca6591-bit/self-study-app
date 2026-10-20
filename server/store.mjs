import Database from 'better-sqlite3';import {mkdirSync} from 'node:fs';import {randomUUID} from 'node:crypto';import path from 'node:path';
export const root=path.resolve(new URL('..',import.meta.url).pathname);export const dataDir=process.env.SELF_STUDY_DATA_DIR||path.join(root,'data');mkdirSync(dataDir,{recursive:true});
export const db=new Database(path.join(dataDir,'study.sqlite'));db.pragma('journal_mode = WAL');db.pragma('foreign_keys = ON');
for(const table of ['projects','sources','lessons','attempts','jobs','memories','activities','conversations'])db.exec(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL)`);
export function save(table,obj){db.prepare(`INSERT INTO ${table}(id,project_id,data,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`).run(obj.id,obj.projectId||obj.id,JSON.stringify(obj),obj.createdAt||new Date().toISOString());return obj}
export function get(table,id){const r=db.prepare(`SELECT data FROM ${table} WHERE id=?`).get(id);return r?JSON.parse(r.data):null}
export function list(table,projectId){return (projectId?db.prepare(`SELECT data FROM ${table} WHERE project_id=? ORDER BY created_at`).all(projectId):db.prepare(`SELECT data FROM ${table} ORDER BY created_at`).all()).map(r=>JSON.parse(r.data))}
export const uid=()=>randomUUID();
// A process restart releases an interrupted deletion lock so it can be retried.
for(const p of list('projects'))if(p.deleting){const {deleting,...rest}=p;save('projects',rest)}
for(const j of list('jobs'))if(['running','queued'].includes(j.status))save('jobs',{...j,status:'failed',error:'服务曾中断，已保留材料及已完成结果，请重试。'});

export function activity(projectId,kind){
 const p=get('projects',projectId);if(!p)return;
 const now=new Date().toISOString();save('activities',{id:uid(),projectId,kind,createdAt:now});
 save('projects',{...p,lastActivityAt:now,...(p.memorySnapshot===undefined?{memorySnapshot:list('memories')[0]?.text||''}:{})});
}

// Recover dated learning evidence from older installations without inventing visits.
for(const a of list('attempts'))if(!a.scene&&a.createdAt&&!get('activities','legacy-attempt:'+a.id))save('activities',{id:'legacy-attempt:'+a.id,projectId:a.projectId,kind:'answer',createdAt:a.createdAt});
for(const l of list('lessons'))if(!l.completionSchemaVersion&&l.reviewCompletedAt&&!get('activities','legacy-completion:'+l.id))save('activities',{id:'legacy-completion:'+l.id,projectId:l.projectId,kind:'complete',createdAt:l.reviewCompletedAt});

for(const s of list('sources'))if(['queued','processing'].includes(s.indexStatus))save('sources',{...s,indexStatus:'failed',indexError:'服务曾中断，请重试入库；原材料已保留。'});

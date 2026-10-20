import React,{useEffect,useState} from 'react';
import {ProviderSettings} from './ProviderSettings';
import {ModelSettings} from './ModelSettings';
import {settingsApi} from './settings-api';
export function SettingsWorkspace({onBack,guard}:{onBack:()=>void;guard:React.MutableRefObject<(proceed:()=>void)=>void>}){
 const [section,setSection]=useState(location.hash==='#settings/models'?'models':'providers');
 const [catalog,setCatalog]=useState<any>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[importing,setImporting]=useState(false);
 const [draft,setDraft]=useState<any>(()=>{try{const d=JSON.parse(localStorage.getItem('self-study-model-settings-v1')||'null');return d?.providers?.length||d?.models?.length?d:null}catch{return null}});
 useEffect(()=>{let stale=false;setCatalog(null);setError('');settingsApi().then(c=>{if(!stale)setCatalog(c)}).catch(e=>{if(!stale)setError(e.message)});return()=>{stale=true}},[section,attempt]);
 const select=(next:string)=>guard.current(()=>{setSection(next);window.history.replaceState(null,'',location.pathname+location.search+'#settings/'+next)});
 async function importDraft(){guard.current(async()=>{setImporting(true);try{await settingsApi('/import','POST',{draft,revision:catalog.revision});localStorage.removeItem('self-study-model-settings-v1');setDraft(null);setAttempt(v=>v+1)}catch(e){setError((e as Error).message)}finally{setImporting(false)}})}
 if(!catalog)return <main className="settings-page"><button onClick={onBack}>← 我的</button><h1>模型设置</h1>{error?<><p role="alert">{error}</p><button onClick={()=>setAttempt(v=>v+1)}>重新加载</button></>:<p role="status">正在读取后端配置…</p>}</main>;
 return <>{draft&&<div className="settings-import"><span>发现此前的浏览器草稿，可导入到后端。密钥需重新填写，默认模型保持现状。</span><button disabled={importing} onClick={importDraft}>{importing?'正在导入…':'导入旧草稿'}</button></div>}{error&&<p role="alert" className="settings-import">{error}</p>}{section==='models'?<ModelSettings key={attempt} initialCatalog={catalog} onBack={onBack} guard={guard} onProviders={()=>select('providers')}/>:<ProviderSettings key={attempt} initialCatalog={catalog} onBack={onBack} guard={guard} onModels={()=>select('models')}/>}</>;
}

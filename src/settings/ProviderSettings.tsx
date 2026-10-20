import React, {useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, Cable, Check, Eye, EyeOff, Plus, Search, Trash2} from 'lucide-react';
import './settings.css';
import {loadEmbeddings} from './embedding-draft.mjs';
import {settingsApi} from './settings-api';

type Provider = {id:string; name:string; vendor:string; url:string; format:string; version:string; key:string; headers:string; hasKey?:boolean;hasHeaders?:boolean;managed?:boolean;clearKey?:boolean;clearHeaders?:boolean};
const vendors = [ ['codex','Codex · 本机登录',''], ['openai','OpenAI','https://api.openai.com/v1'], ['anthropic','Anthropic','https://api.anthropic.com'], ['gemini','Google Gemini','https://generativelanguage.googleapis.com/v1beta/openai'], ['dashscope','阿里云百炼 · 通义千问','https://dashscope.aliyuncs.com/compatible-mode/v1'], ['deepseek','DeepSeek','https://api.deepseek.com'], ['ollama','Ollama','http://127.0.0.1:11434/v1'], ['custom','自定义 / OpenAI 兼容',''] ];
const blank = ():Provider => ({id:crypto.randomUUID(),name:'',vendor:'custom',url:'',format:'auto',version:'',key:'',headers:''});
export function ProviderSettings({onBack,guard,onModels,onEmbeddings,initialCatalog}:{initialCatalog:any;onBack:()=>void; onModels:()=>void; onEmbeddings:()=>void; guard:React.MutableRefObject<(proceed:()=>void)=>void>}) {
  const [initial] = useState(()=>({providers:initialCatalog.providers.map((p:any)=>({...p,key:'',headers:''})),error:''}));
  const [revision,setRevision]=useState(initialCatalog.revision),[busy,setBusy]=useState(false),[discovered,setDiscovered]=useState<{id:string;name:string}[]>([]);
  const [providers,setProviders] = useState(initial.providers);
  const [selected,setSelected] = useState<string|null>(initial.providers[0]?.id || null);
  const [form,setForm] = useState<Provider|null>(initial.providers[0] || null);
  const [query,setQuery] = useState(''); const [reveal,setReveal] = useState(false);
  const [errors,setErrors] = useState<Record<string,string>>({}); const [message,setMessage] = useState('');
  const baseline = useRef(JSON.stringify(initial.providers[0] || null));
  const dirty = JSON.stringify(form) !== baseline.current;
  const saved = providers.find(p=>p.id===selected);
  const editor = useRef<HTMLDivElement>(null);
  const [confirmation,setConfirmation]=useState<{title:string;message:string;action:()=>void}|null>(null);
  const modalRef=useRef<HTMLDivElement>(null);
  function requestLeave(action:()=>void){if(busy)return;if(!dirty){action();return}setConfirmation({title:'放弃未保存的修改？',message:'当前表单尚未保存。放弃后将恢复到最近一次保存的草稿。',action})}
  useEffect(()=>{if(!confirmation)return;const prior=document.activeElement as HTMLElement;modalRef.current?.querySelector<HTMLButtonElement>('button')?.focus();return()=>prior?.focus()},[confirmation]);
  useEffect(()=>{
    guard.current = requestLeave;
    const before = (e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue=''}};
    window.addEventListener('beforeunload',before);
    return ()=>{guard.current=action=>action();window.removeEventListener('beforeunload',before)};
  },[dirty,guard,busy]);
  function choose(p:Provider|null) {
    requestLeave(()=>{
    setSelected(p?.id||null);setForm(p);baseline.current=JSON.stringify(p);setErrors({});setMessage('');setReveal(false);setDiscovered([]);
    if(window.innerWidth<1000)requestAnimationFrame(()=>editor.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}));
    });
  }
  function add(){requestLeave(()=>{const p=blank();baseline.current='null';setSelected(p.id);setForm(p);setErrors({});setMessage('');setReveal(false);requestAnimationFrame(()=>editor.current?.querySelector<HTMLInputElement>('input')?.focus())})}
  function change(field:keyof Provider,value:string){setForm(p=>p?{...p,[field]:value}:p);setErrors(e=>({...e,[field]:''}));setMessage('')}
  function acceptCatalog(c:any){setRevision(c.revision);const ps=c.providers.map((p:any)=>({...p,key:'',headers:''}));setProviders(ps);return ps}
  async function testConnection(){if(!saved||dirty)return;setBusy(true);setDiscovered([]);setErrors({});setMessage('正在连接供应商并获取模型…');try{const r=await settingsApi('/providers/'+saved.id+'/test','POST',{});setDiscovered(r.models);setMessage(`连接成功，获取到 ${r.models.length} 个模型。可在语言模型页选择。`)}catch(e){setMessage('');setErrors({save:(e as Error).message+' 若服务不支持模型列表，可手动添加模型后测试。'})}finally{setBusy(false)}}
  async function save(e:React.FormEvent){
    e.preventDefault();if(!form||form.managed||busy)return;const issues:Record<string,string>={};
    if(!form.name.trim())issues.name='请输入供应商名称';
    if(providers.some(p=>p.id!==form.id && p.name.trim().toLowerCase()===form.name.trim().toLowerCase()))issues.name='此名称已存在，请使用不同名称';
    try {const url=new URL(form.url);if(!['https:','http:'].includes(url.protocol)||!url.hostname||url.username||url.password||url.search||url.hash)throw Error()}catch{issues.url='请输入 HTTP 或 HTTPS 服务地址，不含账号、密码、查询参数或片段'}
    if(form.headers.trim())try{const h=JSON.parse(form.headers);if(!h||Array.isArray(h)||typeof h!=='object'||Object.entries(h).some(([k,v])=>! /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(k)||typeof v!=='string'||/[\r\n]/.test(v)))throw Error()}catch{issues.headers='请输入 JSON 对象，请求头名称有效且值为单行字符串'}
    if(Object.keys(issues).length){setErrors(issues);if(issues.headers)editor.current?.querySelector('details')?.setAttribute('open','');requestAnimationFrame(()=>editor.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());return}
    const next={...form,name:form.name.trim(),url:form.url.trim(),version:form.version.trim()};
    setBusy(true);try{const {hasKey,hasHeaders,managed,...data}=next;const ps=acceptCatalog(await settingsApi('/providers','POST',{revision,provider:{...data,key:data.key||undefined,headers:data.headers||undefined}}));const accepted=ps.find((p:any)=>p.id===next.id);setForm(accepted);baseline.current=JSON.stringify(accepted);setErrors({});setDiscovered([]);setMessage('供应商已保存到后端。')}catch(e){setErrors({save:(e as Error).message})}finally{setBusy(false)}
  }

  function remove(){
    if(!saved)return;
    if(saved.managed||busy)return;
    try{if(loadEmbeddings(localStorage).models.some((m:any)=>m.providerId===saved.id)){setErrors({save:'此供应商仍关联本浏览器的嵌入模型草稿，请先更换关联或删除草稿。'});return}}catch(e){setErrors({save:(e as Error).message});return}
    setConfirmation({title:'删除供应商？',message:`将删除“${saved.name}”及其连接凭据。有关联模型时，后端会阻止删除。`,action:async()=>{setBusy(true);try{const ps=acceptCatalog(await settingsApi('/providers/'+saved.id,'DELETE',{revision}));const first=ps[0]||null;setSelected(first?.id||null);setForm(first);baseline.current=JSON.stringify(first);setErrors({});setDiscovered([]);setMessage('供应商已删除。')}catch(e){setErrors({save:(e as Error).message})}finally{setBusy(false)}}});
  }
  const visible=providers.filter(p=>(p.name+' '+p.vendor).toLowerCase().includes(query.toLowerCase()));
  const field=(key:'name'|'url'|'version',label:string,placeholder='',type='text')=><label className="settings-field">{label}<input type={type} value={form?.[key]||''} placeholder={placeholder} onChange={e=>change(key,e.target.value)} aria-invalid={!!errors[key]} aria-describedby={errors[key]?`error-${key}`:undefined}/>{errors[key]&&<span className="field-error" id={`error-${key}`}>{errors[key]}</span>}</label>;
  return <main className="settings-page">
    <button className="settings-back" onClick={onBack}><ArrowLeft size={16}/> 我的</button>
    <div className="settings-heading"><div><p className="settings-eyebrow">MODEL SETTINGS</p><h1>模型设置</h1><p>管理模型的连接方式，让学习按你的选择进行。</p></div><span className="settings-badge">后端配置</span></div>
    <div className="settings-tabs" aria-label="设置分类"><button aria-current="page">供应商</button><button onClick={onModels}>语言模型</button><button onClick={onEmbeddings}>嵌入模型</button></div>
    <div className="settings-note"><Cable size={18}/><p>连接凭据保存在本机后端。先保存供应商，再测试连接；在语言模型页设置默认模型供后续生成使用。</p></div>
    {initial.error&&<p role="alert" className="field-error">{initial.error}</p>}
    <div role="status" className="settings-status">{message}</div>
    <div className="settings-split">
      <aside className="settings-rail"><div className="settings-list-title"><h2>供应商 <span>{providers.length}</span></h2><button aria-label="新增供应商" onClick={add}><Plus size={18}/></button></div>
        <label className="settings-search"><Search size={16}/><input aria-label="搜索供应商" placeholder="搜索名称或供应商" value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <div className="settings-provider-list">{visible.map(p=><button key={p.id} className={selected===p.id?'active':''} onClick={()=>choose(p)} aria-pressed={selected===p.id}><span className="provider-mark">{p.name.slice(0,1).toUpperCase()}</span><span><strong>{p.name}</strong><small>{vendors.find(v=>v[0]===p.vendor)?.[1]||p.vendor}</small></span><ArrowRight size={15}/></button>)}</div>
        {!visible.length&&<p className="settings-list-empty">{query?'没有匹配的供应商':'还没有供应商，点击 + 添加。'}</p>}
        <p className="settings-rail-foot">先配置供应商，再关联语言模型。</p>
      </aside>
      <div className="settings-editor" ref={editor}>{!form?<div className="settings-empty"><span className="settings-empty-icon"><Cable size={28}/></span><h2>添加第一个供应商</h2><p>填写服务地址与连接信息。<br/>下一步可为它添加语言模型。</p><button className="primary" onClick={add}><Plus size={17}/> 新增供应商</button></div>:<form onSubmit={save} noValidate><fieldset className="settings-fieldset" disabled={busy||form.managed}>
        <div className="settings-editor-title"><div><p className="settings-eyebrow">PROVIDER</p><h2>{saved?.name||'新增供应商'}</h2></div><span className="settings-badge">{dirty?'未保存':'已保存'}</span></div>
        <div className="settings-fields">{field('name','供应商名称','例如：我的 DeepSeek')}
          <label className="settings-field">供应商类型<select value={form.vendor} onChange={e=>{const v=vendors.find(v=>v[0]===e.target.value)!;setForm({...form,vendor:v[0],format:v[0]==='dashscope'?'chat_completions':form.format,name:form.name||v[1],url:!form.url||vendors.some(x=>x[2]===form.url)?v[2]:form.url});setErrors({});setMessage('')}}>{vendors.filter(v=>v[0]!=='codex'||form.managed).map(v=><option value={v[0]} key={v[0]}>{v[1]}</option>)}</select></label>
        </div>
        {field('url','服务地址','https://api.example.com/v1')}{form.vendor==='dashscope'&&<p className="settings-hint">使用阿里云百炼的 OpenAI 兼容接口。预填北京地域地址；请以控制台给出的地址为准，API Key 必须与地域及工作空间匹配。保存后前往语言模型页添加千问模型，例如 qwen-plus。</p>}
        <label className="settings-field">API Key <span className="settings-optional">本地服务可留空</span><div className="settings-secret"><input autoComplete="off" spellCheck={false} type={reveal?'text':'password'} value={form.key} placeholder={form.hasKey?'已保存；留空保持不变':'输入 API Key'} onChange={e=>change('key',e.target.value)}/><button type="button" aria-label={reveal?'隐藏 API Key':'显示 API Key'} onClick={()=>setReveal(!reveal)}>{reveal?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
        <p className="settings-hint">密钥与请求头只由后端保存，不返回原值。编辑时留空保持已保存值。</p>{form.hasKey&&<label className="settings-checkbox"><input type="checkbox" checked={!!form.clearKey} onChange={e=>setForm({...form,clearKey:e.target.checked})}/>清除已保存的 API Key</label>}
        <details className="settings-advanced"><summary>高级连接选项 <span>协议、版本与请求头</span></summary><div className="settings-fields"><label className="settings-field">API 协议<select value={form.format} onChange={e=>change('format',e.target.value)}><option value="auto">自动选择</option><option value="chat_completions">OpenAI Chat Completions</option><option value="responses">OpenAI Responses</option><option value="anthropic">Anthropic Messages</option></select></label>{field('version','API 版本（可选）','使用服务商要求的版本')}</div><label className="settings-field">自定义请求头（JSON）<textarea rows={4} value={form.headers} placeholder={'{"X-Custom-Header": "value"}'} onChange={e=>change('headers',e.target.value)} aria-invalid={!!errors.headers} aria-describedby={errors.headers?'error-headers':undefined}/>{errors.headers&&<span id="error-headers" className="field-error">{errors.headers}</span>}</label></details>{form.hasHeaders&&<label className="settings-checkbox"><input type="checkbox" checked={!!form.clearHeaders} onChange={e=>setForm({...form,clearHeaders:e.target.checked})}/>清除已保存的自定义请求头</label>}
        </fieldset>{form.managed&&<p className="settings-note">此连接使用本机已登录的 Codex，无需填写 API Key。点击测试连接可读取可用模型。</p>}<section className="settings-test"><div><strong>连接与模型发现</strong><p>保存后获取供应商提供的模型列表；完整生成能力请在语言模型页测试。</p></div><button type="button" disabled={busy||dirty||!saved} onClick={testConnection}>{busy?'处理中…':'测试连接'}</button></section>
        {discovered.length>0&&<div className="settings-discovered"><strong>可用模型</strong><p>{discovered.map(m=>m.id).join(' · ')}</p></div>}{errors.save&&<p role="alert" className="field-error">{errors.save}</p>}
        <div className="settings-actions">{saved&&!saved.managed&&<button disabled={busy} type="button" className="settings-delete" onClick={remove}><Trash2 size={16}/> 删除</button>}<div><button type="button" disabled={!dirty||busy} onClick={()=>choose(saved||null)}>取消修改</button><button className="primary" disabled={!dirty||!!initial.error||busy||form.managed} type="submit"><Check size={16}/> 保存供应商</button></div></div>
      </form>}</div>
    </div>
    {confirmation&&<div className="overlay settings-confirm-overlay"><div className="dialog settings-confirm" role="dialog" aria-modal="true" aria-labelledby="settings-confirm-title" aria-describedby="settings-confirm-description" ref={modalRef} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setConfirmation(null)}if(e.key==='Tab'){const buttons=modalRef.current?.querySelectorAll('button');if(!buttons)return;if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons[buttons.length-1].focus()}else if(!e.shiftKey&&document.activeElement===buttons[buttons.length-1]){e.preventDefault();buttons[0].focus()}}}}><h2 id="settings-confirm-title">{confirmation.title}</h2><p id="settings-confirm-description">{confirmation.message}</p><div className="confirm-actions"><button onClick={()=>setConfirmation(null)}>继续编辑</button><button className="primary" onClick={()=>{const action=confirmation.action;setConfirmation(null);action()}}>确认{confirmation.title.startsWith('删除')?'删除':'放弃'}</button></div></div></div>}
  </main>;
}

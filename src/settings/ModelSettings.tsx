import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,Cpu,Plus,Search,Star,Trash2} from 'lucide-react';
import {settingsApi} from './settings-api';
import './settings.css';

type Model={id:string;name:string;modelId:string;providerId:string;contextWindow:string;managed?:boolean;capabilities:Record<string,string>};
type Provider={id:string;name:string;vendor:string;url:string};
type Catalog={providers:Provider[];models:Model[];revision:number;defaultModelId:string|null};
type Guard=React.MutableRefObject<(proceed:()=>void)=>void>;
const capabilityLabels=[['vision','图像理解'],['tool_calls','工具调用'],['json_output','结构化输出'],['reasoning','推理能力']];
export function ModelSettings({onBack,onProviders,onEmbeddings,guard,initialCatalog}:{initialCatalog:Catalog;onBack:()=>void;onProviders:()=>void;onEmbeddings:()=>void;guard:Guard}){
  const [initial]=useState(()=>({catalog:initialCatalog,error:''})),[catalog,setCatalog]=useState<Catalog>(initial.catalog);
  const [form,setForm]=useState<Model|null>(initial.catalog.models[0]||null);
  const [busy,setBusy]=useState(false),[available,setAvailable]=useState<{id:string;name:string}[]>([]);
  const baseline=useRef(JSON.stringify(initial.catalog.models[0]||null));
  const [query,setQuery]=useState(''),[errors,setErrors]=useState<Record<string,string>>({}),[message,setMessage]=useState('');
  const [confirmation,setConfirmation]=useState<{title:string;message:string;action:()=>void;label:string}|null>(null);
  const editor=useRef<HTMLDivElement>(null),modal=useRef<HTMLDivElement>(null);
  const saved=catalog.models.find(m=>m.id===form?.id),dirty=JSON.stringify(form)!==baseline.current;
  const provider=catalog.providers.find(p=>p.id===form?.providerId);
  const defaultModel=catalog.models.find(m=>m.id===catalog.defaultModelId);
  const defaultValid=defaultModel&&catalog.providers.some(p=>p.id===defaultModel.providerId);
  function requestLeave(action:()=>void){if(busy)return;if(!dirty){action();return}setConfirmation({title:'放弃未保存的修改？',message:'当前模型表单尚未保存。放弃后将恢复到最近一次保存的草稿。',action,label:'确认放弃'})}
  useEffect(()=>{guard.current=requestLeave;const before=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',before);return()=>{guard.current=fn=>fn();window.removeEventListener('beforeunload',before)}},[dirty,guard,busy]);
  useEffect(()=>{if(!confirmation)return;const prior=document.activeElement as HTMLElement;modal.current?.querySelector('button')?.focus();return()=>prior?.focus()},[confirmation]);
  function open(model:Model|null){setForm(model);baseline.current=JSON.stringify(model);setErrors({});setMessage('');setAvailable([])}
  function choose(model:Model){requestLeave(()=>{open(model);if(window.innerWidth<1000)editor.current?.scrollIntoView({behavior:'auto',block:'start'})})}
  function add(){requestLeave(()=>{const model:Model={id:crypto.randomUUID(),name:'',modelId:'',providerId:catalog.providers.length===1?catalog.providers[0].id:'',contextWindow:'',capabilities:Object.fromEntries(capabilityLabels.map(([k])=>[k,'auto']))};open(model);baseline.current='null';requestAnimationFrame(()=>editor.current?.querySelector('input')?.focus())})}
  function change(key:keyof Model,value:any){setForm(m=>m?{...m,[key]:value}:m);setErrors(v=>({...v,[key]:''}));setMessage('');if(key==='providerId')setAvailable([])}
  function failure(e:unknown){setErrors({save:`${(e as Error).message||'浏览器存储不可用'} 输入已保留。若配置在其他页面更新，请先刷新再修改。`})}
  async function save(e:React.FormEvent){e.preventDefault();if(!form||busy||form.managed)return;const issues:Record<string,string>={};if(!form.name.trim())issues.name='请输入模型显示名称';if(!form.modelId.trim()||/\s/.test(form.modelId.trim()))issues.modelId='请输入准确模型 ID，不含空格';if(!provider)issues.providerId='请选择供应商';if(form.contextWindow&&!/^\d+$/.test(form.contextWindow)||form.contextWindow&&(!Number.isSafeInteger(Number(form.contextWindow))||Number(form.contextWindow)<=0))issues.contextWindow='请输入正整数或留空';if(Object.keys(issues).length){setErrors(issues);return}setBusy(true);try{const c=await settingsApi('/models','POST',{revision:catalog.revision,model:form});setCatalog(c);open(c.models.find((m:Model)=>m.id===form.id));setMessage('模型已保存。设为默认后用于后续生成。')}catch(e){failure(e)}finally{setBusy(false)}}
  async function makeDefault(){if(!saved||dirty||busy)return;setBusy(true);try{setCatalog(await settingsApi('/default','POST',{id:saved.id,revision:catalog.revision}));setErrors({});setMessage('默认模型已生效，后续生成与问答将使用此模型。')}catch(e){failure(e)}finally{setBusy(false)}}
  async function discover(){if(!form?.providerId||busy)return;setBusy(true);setErrors({});try{const r=await settingsApi('/providers/'+form.providerId+'/test','POST',{});setAvailable(r.models);setMessage(`已获取 ${r.models.length} 个模型，可从列表选择。`)}catch(e){failure(e)}finally{setBusy(false)}}
  async function testModel(){if(!saved||dirty||busy)return;setBusy(true);setErrors({});setMessage('正在调用模型生成测试文本…');try{const r=await settingsApi('/models/'+saved.id+'/test','POST',{});setMessage(`真实生成成功 · ${r.provider} / ${r.model} · ${(r.elapsedMs/1000).toFixed(1)} 秒 · ${r.reply}`)}catch(e){setMessage('');failure(e)}finally{setBusy(false)}}
  function remove(){if(!saved||saved.managed||busy)return;const isDefault=catalog.defaultModelId===saved.id;setConfirmation({title:isDefault?'删除默认模型？':'删除模型？',message:`将删除“${saved.name}”。${isDefault?'删除后需重新选择默认模型，新的生成任务将暂不可用。':''}已有学习内容保留。`,label:'确认删除',action:async()=>{setBusy(true);try{const c=await settingsApi('/models/'+saved.id,'DELETE',{revision:catalog.revision});setCatalog(c);open(c.models[0]||null);setMessage('模型已删除。')}catch(e){failure(e)}finally{setBusy(false)}}})}
  const visible=catalog.models.filter(m=>[m.name,m.modelId,catalog.providers.find(p=>p.id===m.providerId)?.name||''].join(' ').toLowerCase().includes(query.toLowerCase()));
  const field=(key:'name'|'modelId'|'contextWindow',label:string,placeholder:string)=><label className="settings-field">{label}<input value={key==='modelId'&&form?.managed?'跟随 Codex 当前默认模型':form?.[key]||''} placeholder={placeholder} inputMode={key==='contextWindow'?'numeric':undefined} onChange={e=>change(key,e.target.value)} aria-invalid={!!errors[key]} aria-describedby={errors[key]?`model-error-${key}`:undefined}/>{errors[key]&&<span className="field-error" id={`model-error-${key}`}>{errors[key]}</span>}</label>;
  return <main className="settings-page">
    <button className="settings-back" onClick={onBack}><ArrowLeft size={16}/> 我的</button>
    <div className="settings-heading"><div><p className="settings-eyebrow">MODEL SETTINGS</p><h1>模型设置</h1><p>管理模型的连接方式，让学习按你的选择进行。</p></div><span className="settings-badge">后端配置</span></div>
    <div className="settings-tabs" aria-label="设置分类"><button onClick={onProviders}>供应商</button><button aria-current="page">语言模型</button><button onClick={onEmbeddings}>嵌入模型</button></div>
    <div className="settings-note"><Cpu size={18}/><p>默认模型用于后续生成与问答。切换前建议测试真实生成；已有学习内容保持不变。</p></div>
    {initial.error&&<p role="alert" className="field-error">{initial.error}</p>}
    <div role="status" className="settings-status">{message}</div>
    <section className="settings-default-summary"><Star size={17}/><div><strong>默认模型</strong><p>{defaultValid?`${defaultModel.name} · ${catalog.providers.find(p=>p.id===defaultModel.providerId)?.name}`:'尚未选择。保存模型后，点击“设为默认模型”。'}</p></div><span className="settings-badge">{defaultValid?'已生效':'待选择'}</span></section>
    <div className="settings-split">
      <aside className="settings-rail"><div className="settings-list-title"><h2>语言模型 <span>{catalog.models.length}</span></h2><button aria-label="新增语言模型" disabled={!catalog.providers.length||!!initial.error} onClick={add}><Plus size={18}/></button></div>
        <label className="settings-search"><Search size={16}/><input aria-label="搜索语言模型" placeholder="搜索模型或供应商" value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <div className="settings-provider-list">{visible.map(m=><button key={m.id} className={m.id===form?.id?'active':''} onClick={()=>choose(m)} aria-pressed={m.id===form?.id}><span className="provider-mark"><Cpu size={17}/></span><span><strong>{m.name}</strong><small>{catalog.providers.find(p=>p.id===m.providerId)?.name||'供应商已失效'} · {m.managed?'跟随当前默认':m.modelId}</small>{catalog.defaultModelId===m.id&&<small className="model-default-marker">默认</small>}</span><ArrowRight size={15}/></button>)}</div>
        {!visible.length&&<p className="settings-list-empty">{query?'没有匹配的模型':catalog.providers.length?'还没有语言模型，点击 + 添加。':'请先添加并保存一个供应商。'}</p>}
        <p className="settings-rail-foot">同一供应商可以关联多个模型。</p>
      </aside>
      <div className="settings-editor" ref={editor}>{!form?<div className="settings-empty"><span className="settings-empty-icon"><Cpu size={28}/></span><h2>{catalog.providers.length?'添加第一个语言模型':'先配置模型供应商'}</h2><p>{catalog.providers.length?'使用供应商提供的模型 ID，配置上下文与能力。':'语言模型需要关联一个已保存的供应商。'}<br/>连接地址和 API Key 在供应商页管理。</p><button className="primary" disabled={!!initial.error} onClick={catalog.providers.length?add:onProviders}><Plus size={17}/>{catalog.providers.length?'新增语言模型':'去添加供应商'}</button></div>:<form onSubmit={save} noValidate><fieldset className="settings-fieldset" disabled={busy||form.managed}>
        <div className="settings-editor-title"><div><p className="settings-eyebrow">LANGUAGE MODEL</p><h2>{saved?.name||'新增语言模型'}</h2></div><span className="settings-badge">{dirty?'未保存':'已保存'}</span></div>
        <div className="settings-fields">{field('name','显示名称','例如：日常学习模型')}{field('modelId','模型 ID','填写服务商提供的准确模型 ID')}</div>
        <label className="settings-field">所属供应商<select value={form.providerId} onChange={e=>change('providerId',e.target.value)} aria-invalid={!!errors.providerId} aria-describedby={errors.providerId?'model-error-provider':undefined}><option value="">请选择供应商</option>{form.providerId&&!provider&&<option value={form.providerId}>原供应商已失效，请重新选择</option>}{catalog.providers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>{errors.providerId&&<span className="field-error" id="model-error-provider">{errors.providerId}</span>}</label>
        <div className="model-provider-info"><span>{provider?provider.url:'先在供应商页保存连接信息，再选择关联。'}</span><button type="button" onClick={onProviders}>管理供应商 <ArrowRight size={14}/></button></div>
        <div className="model-discovery"><button type="button" disabled={!provider||busy} onClick={discover}>获取可用模型</button>{available.length>0&&<label className="settings-field">选择服务商模型<select value="" onChange={e=>{if(e.target.value)change('modelId',e.target.value)}}><option value="">选择后填入模型 ID</option>{available.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}</div>
        {field('contextWindow' ,'上下文长度（tokens，可选）','留空使用模型默认值')}
        <p className="settings-hint">填写服务商公布的容量；留空不会推测或伪造上下文长度。</p>
        <details className="settings-advanced"><summary>模型能力 <span>默认自动判断</span></summary><p className="settings-hint model-capability-hint">“自动”将在实际接入时交给适配器判断；以下选项不代表已通过测试。当前学习流程仅使用文本，不授权工具；结构化输出设为支持时启用协议 JSON 模式。</p><div className="settings-fields">{capabilityLabels.map(([key,label])=><label className="settings-field" key={key}>{label}<select value={form.capabilities[key]||'auto'} onChange={e=>change('capabilities',{...form.capabilities,[key]:e.target.value})}><option value="auto">自动</option><option value="yes">支持</option><option value="no">不支持</option></select></label>)}</div></details>
        </fieldset>{form.managed&&<p className="settings-note">内置自动模型沿用 Codex 默认选择。若要固定模型，请新增一个关联 Codex 的模型并获取模型列表。</p>}<section className="settings-test"><div><strong>模型连通测试</strong><p>生成一条真实短文本以验证连接与 JSON 输出，会消耗少量额度。上下文长度暂按服务商信息手动填写。</p></div><div className="model-test-buttons"><button type="button" disabled={busy||dirty||!saved} onClick={testModel}>{busy?'处理中…':'测试模型'}</button></div></section>
        {saved&&<div className="model-default-action"><button type="button" onClick={makeDefault} disabled={busy||dirty||catalog.defaultModelId===saved.id||!!initial.error}><Star size={15}/>{catalog.defaultModelId===saved.id?'已是默认模型':'设为默认模型'}</button><small>{dirty?'请先保存当前修改，再设置默认模型。':'设为默认后，后续生成将使用此模型。'}</small></div>}
        {errors.save&&<p role="alert" className="field-error">{errors.save}</p>}
        <div className="settings-actions">{saved&&!saved.managed&&<button disabled={busy} type="button" className="settings-delete" onClick={remove}><Trash2 size={16}/> 删除模型</button>}<div><button type="button" disabled={busy||!dirty} onClick={()=>requestLeave(()=>open(saved||null))}>取消修改</button><button className="primary" disabled={busy||!dirty||!!initial.error||form.managed} type="submit"><Check size={16}/> 保存模型</button></div></div>
      </form>}</div>
    </div>
    {confirmation&&<div className="overlay settings-confirm-overlay"><div className="dialog settings-confirm" role="dialog" aria-modal="true" aria-labelledby="model-confirm-title" aria-describedby="model-confirm-message" ref={modal} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setConfirmation(null)}if(e.key==='Tab'){const buttons=modal.current?.querySelectorAll('button');if(!buttons)return;if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons[buttons.length-1].focus()}else if(!e.shiftKey&&document.activeElement===buttons[buttons.length-1]){e.preventDefault();buttons[0].focus()}}}}><h2 id="model-confirm-title">{confirmation.title}</h2><p id="model-confirm-message">{confirmation.message}</p><div className="confirm-actions"><button onClick={()=>setConfirmation(null)}>继续编辑</button><button className="primary" onClick={()=>{const fn=confirmation.action;setConfirmation(null);fn()}}>{confirmation.label}</button></div></div></div>}
  </main>;
}

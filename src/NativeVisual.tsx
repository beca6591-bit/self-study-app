import React, {useEffect,useRef,useState} from 'react';
import DOMPurify from 'dompurify';
import {prepareIframeHtml} from './book-iframe';
import {VisualBlock} from './VisualBlock';

// Chart configuration parsing follows DeepTutor v1.6.13 VisualizationViewer.
export function parseChartConfig(source:string){
 const raw=source.trim().replace(/^```(?:json|javascript|js)?\s*([\s\S]*?)\s*```$/i,'$1');
 try{return JSON.parse(raw)}catch{return JSON.parse(raw.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g,'$1"$2":').replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g,(_m,v)=>JSON.stringify(v.replace(/\\'/g,"'"))).replace(/,\s*([}\]])/g,'$1'))}
}
function Chart({code}:{code:string}){
 const ref=useRef<HTMLCanvasElement>(null),[error,E]=useState('');
 useEffect(()=>{let cancelled=false,chart:any;E('');import('chart.js/auto').then(({default:Chart})=>{if(!cancelled&&ref.current)chart=new Chart(ref.current,parseChartConfig(code))}).catch(e=>{if(!cancelled)E(e.message)});return()=>{cancelled=true;chart?.destroy()}},[code]);
 return <>{error&&<p role="alert">图表显示失败：{error}</p>}<canvas ref={ref}/></>
}
function Mermaid({code}:{code:string}){
 const [svg,S]=useState(''),[error,E]=useState('');
 useEffect(()=>{let cancelled=false;S('');E('');import('mermaid').then(async({default:m})=>{m.initialize({startOnLoad:false,securityLevel:'strict',htmlLabels:false,flowchart:{htmlLabels:false}});const result=await m.render('book-'+crypto.randomUUID(),code);if(!cancelled)S(DOMPurify.sanitize(result.svg,{ADD_TAGS:['foreignObject']}))}).catch(e=>{if(!cancelled)E(e.message)});return()=>{cancelled=true}},[code]);
 return error?<p role="alert">关系图显示失败：{error}</p>:<div className="mermaid-view" dangerouslySetInnerHTML={{__html:svg}}/>
}
function Interactive({code,onPrompt}:{code:string,onPrompt?:(text:string)=>void}){
 const ref=useRef<HTMLIFrameElement>(null),[height,H]=useState(600);
 useEffect(()=>{const receive=(e:MessageEvent)=>{if(e.source!==ref.current?.contentWindow)return;if(e.data?.type==='dt:visualize-height'&&Number.isFinite(e.data.height))H(Math.max(240,Math.min(2200,e.data.height)));if(e.data?.type==='dt:visualize-prompt'&&typeof e.data.text==='string')onPrompt?.(e.data.text.slice(0,10000))};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive)},[onPrompt]);
 return <iframe ref={ref} title="交互探索" sandbox="allow-scripts" referrerPolicy="no-referrer" style={{height}} srcDoc={prepareIframeHtml(code)}/>
}
export function NativeVisual({payload:p,title,videoUrl,onPrompt}:{payload:any,title?:string,videoUrl?:string,onPrompt?:(text:string)=>void}){
 const [error,E]=useState(false);useEffect(()=>E(false),[videoUrl]);
 if(['svg','web_animation'].includes(p.render_type))return <VisualBlock payload={p} title={title}/>;
 return <section className="book-block visual-block"><h2>{title||({chartjs:'数据图表',mermaid:'关系图',html:'交互探索',video:'动画讲解'} as any)[p.render_type]}</h2>
 {p.render_type==='chartjs'&&<Chart code={p.code?.content||''}/>}
 {p.render_type==='mermaid'&&<Mermaid code={p.code?.content||''}/>}
 {p.render_type==='html'&&<Interactive code={p.code?.content||''} onPrompt={onPrompt}/>}
 {p.render_type==='video'&&<>{videoUrl?<video controls playsInline preload="metadata" src={videoUrl} onError={()=>E(true)}/>:<p role="alert">动画文件暂不可用</p>}{error&&<p role="alert">动画加载失败，请重试或重新生成此模块。</p>}<p>{p.summary}</p></>}
 <p className="muted">{p.description}</p></section>
}

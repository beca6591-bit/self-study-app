import React,{useEffect,useMemo,useRef,useState} from 'react';
import DOMPurify from 'dompurify';
export function VisualBlock({payload,title}:{payload:any,title?:string}){
 const frame=useRef<HTMLIFrameElement>(null),[playing,setPlaying]=useState(true),[loaded,setLoaded]=useState(false);
 const [height,setHeight]=useState(620);
 useEffect(()=>{const receive=(e:MessageEvent)=>{if(e.source===frame.current?.contentWindow&&Number.isFinite(e.data?.visualHeight))setHeight(Math.max(300,Math.min(1800,e.data.visualHeight)))};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive)},[]);
 const animation=payload.render_type==='web_animation';
 const document=useMemo(()=>{
  const nonce=crypto.randomUUID();
  const content=DOMPurify.sanitize(payload.code?.content||'',{WHOLE_DOCUMENT:true,ADD_TAGS:['style'],FORBID_TAGS:['script','iframe','object','embed','base','form','link','meta','foreignObject'],FORBID_ATTR:['href','xlink:href','src','action']});
  const control=`const measure=()=>parent.postMessage({visualHeight:document.documentElement.scrollHeight},'*');addEventListener('load',measure);new ResizeObserver(measure).observe(document.body);let paused=false;addEventListener('message',e=>{if(e.source!==parent)return;const action=e.data?.visualControl;if(!['play','pause','replay'].includes(action))return;paused=action==='pause';for(const a of document.getAnimations()){if(action==='replay')a.currentTime=0;paused?a.pause():a.play()}});`;
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none';"><style>html,body{margin:0;background:#fff;color:#20211f;font-family:system-ui}body{padding:16px;box-sizing:border-box}svg{max-width:100%;height:auto}*{box-sizing:border-box}</style></head><body>${content}${animation?`<script nonce="${nonce}">${control}</script>`:''}</body></html>`;
 },[payload.code?.content,animation]);
 const control=(action:string)=>{frame.current?.contentWindow?.postMessage({visualControl:action},'*');setPlaying(action!=='pause')};
 return <section className="book-block visual-block"><div className="heading"><h2>{title||(animation?'动态讲解':'图示')}</h2>{animation&&<div><button disabled={!loaded} onClick={()=>control(playing?'pause':'play')}>{playing?'暂停':'播放'}</button> <button disabled={!loaded} onClick={()=>control('replay')}>重播</button></div>}</div><iframe style={animation?{height}:{height:'auto',aspectRatio:(payload.code?.content?.match(/viewBox=["']([^"']+)/)?.[1]?.split(/[ ,]+/).slice(2).join(' / ')||'1 / 1')}} ref={frame} title={title||(animation?'章节动画':'章节图示')} sandbox={animation?'allow-scripts':''} referrerPolicy="no-referrer" srcDoc={document} onLoad={()=>{setLoaded(true);setPlaying(true)}}/><p className="muted">{payload.description}</p></section>
}

import React,{useState} from 'react';
import Markdown from 'react-markdown';import remarkMath from 'remark-math';import rehypeKatex from 'rehype-katex';
import {NativeVisual} from './NativeVisual';
type Obj=Record<string,any>;
export function Prose({text}:{text?:string}){return <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{text||''}</Markdown>}
function Quiz({block,attempts,onAnswer,disabled}:{block:Obj,attempts:Obj[],onAnswer:(questionId:string,answer:string,correct?:boolean|null)=>Promise<any>,disabled:boolean}){
 const [answers,A]=useState<Record<string,string>>({});
 return <section className="book-block"><h2>检查理解</h2>{block.payload.questions?.map((q:Obj,i:number)=>{const qid=q.question_id||String(i),saved=attempts.filter(a=>a.block_id===block.id&&a.question_id===qid).at(-1),answer=answers[qid]??saved?.user_answer??'';return <section className="quiz-question" key={qid}><Prose text={q.question}/>{Object.keys(q.options||{}).length?Object.entries(q.options).map(([key,label])=><label key={key}><input type="radio" name={block.id+qid} value={key} checked={answer===key} disabled={disabled} onChange={()=>A({...answers,[qid]:key})}/>{key}. {String(label)}</label>):<textarea aria-label="你的回答" value={answer} disabled={disabled} onChange={e=>A({...answers,[qid]:e.target.value})}/>}<button disabled={disabled||!answer.trim()} onClick={()=>onAnswer(qid,answer)}>提交并查看解析</button>{saved&&<div className="quiz-feedback"><p>{saved.is_correct===true?'回答正确':saved.is_correct===false?'再看看解析':'已记录回答，请对照解析自评'}</p><Prose text={String(q.correct_answer||'')+'\n\n'+(q.explanation||'')}/>{!Object.keys(q.options||{}).length&&<div><button disabled={disabled} onClick={()=>onAnswer(qid,saved.user_answer,true)}>我答对了</button><button disabled={disabled} onClick={()=>onAnswer(qid,saved.user_answer,false)}>还需练习</button></div>}</div>}</section>})}</section>
}
export function BookBlock({block:b,base,attempts=[],onAnswer,onRetry,onPrompt,onNavigate,disabled=false}:{block:Obj,base:string,attempts?:Obj[],onAnswer:(blockId:string,questionId:string,answer:string,correct?:boolean|null)=>Promise<any>,onRetry:(blockId:string)=>void,onPrompt:(text:string)=>void,onNavigate:(pageId:string)=>void,disabled?:boolean}){
 const p=b.payload||{};
 if(['pending','planning','generating'].includes(b.status))return <p className="muted">{({figure:'图示',animation:'动画',interactive:'互动',quiz:'测验'} as any)[b.type]||'内容'}正在生成…</p>;
 if(b.status==='error')return <section className="notice"><p>此模块生成失败，其他内容已保留。</p><details><summary>失败原因</summary>{b.error}</details><button disabled={disabled} onClick={()=>onRetry(b.id)}>重试此模块</button></section>;
 let content;
 if(['figure','animation','interactive'].includes(b.type))content=<NativeVisual payload={p} title={b.title} videoUrl={p.render_type==='video'?base+'/blocks/'+encodeURIComponent(b.id)+'/video':undefined} onPrompt={onPrompt}/>;
 else if(b.type==='section')content=<section className="book-block"><Prose text={p.intro}/>{p.subsections?.map((s:Obj,i:number)=><section key={i}><h2>{s.heading}</h2><Prose text={s.body}/></section>)}<Prose text={p.key_takeaway}/></section>;
 else if(b.type==='flash_cards')content=<section className="book-block"><h2>记忆闪卡</h2>{p.cards?.map((c:Obj,i:number)=><details key={i}><summary>{c.front}</summary><Prose text={c.back}/></details>)}</section>;
 else if(b.type==='quiz')content=<Quiz block={b} attempts={attempts} onAnswer={(qid,answer,correct)=>onAnswer(b.id,qid,answer,correct)} disabled={disabled}/>;
 else if(b.type==='timeline')content=<section className="book-block timeline">{p.events?.map((e:Obj,i:number)=><section key={i}><h3>{e.date} · {e.title}</h3><Prose text={e.description}/></section>)}</section>;
 else if(b.type==='code')content=<section className="book-block"><h2>代码示例 · {p.language}</h2><pre><code>{p.code||p.content}</code></pre><Prose text={p.explanation}/></section>;
 else if(b.type==='concept_graph')content=<section className="book-block"><h2>知识结构</h2>{p.graph?.nodes?.map((n:Obj)=><div key={n.id}>{n.page_id?<button onClick={()=>onNavigate(n.page_id)}>{n.label||n.title||n.id}</button>:<p>{n.label||n.title||n.id}</p>}</div>)}</section>;
 else content=<section className={'book-block '+b.type}><h2>{b.title||p.title}</h2><Prose text={p.markdown||p.content||p.body||p.text||p.explanation}/></section>;
 return <><Prose text={p.bridge_text}/>{content}</>
}

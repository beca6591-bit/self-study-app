import {readdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {z} from 'zod';
const positive=max=>z.string().regex(/^\d+$/).refine(s=>Number.isSafeInteger(+s)&&+s>0&&+s<=max);
export const embeddingSchema=z.object({id:z.string().regex(/^[\w-]{1,160}$/),name:z.string().trim().min(1).max(120),modelId:z.string().trim().min(1).max(200).regex(/^\S+$/),providerId:z.string().min(1),protocol:z.enum(['ollama','openai']),dimensions:positive(65536),batchSize:positive(1024),timeout:positive(600),sendDimensions:z.boolean()});
export function endpoint(p,m){let base=p.url.replace(/\/$/,'');if(m.protocol==='ollama')base=base.replace(/\/(?:v1|api\/embed|api\/embeddings)$/,'')+'/api/embed';else if(!base.endsWith('/embeddings'))base=base.replace(/\/(chat\/completions|responses|messages)$/,'')+'/embeddings';return base}
export function validateEmbedding(m,c){const p=c.providers.find(p=>p.id===m.providerId);if(!p||!['openai','ollama','custom','gemini'].includes(p.vendor))throw Error('请选择支持嵌入接口的供应商');if(m.protocol==='ollama'&&!['ollama','custom'].includes(p.vendor))throw Error('Ollama 协议需要 Ollama 或自定义供应商');if(m.protocol==='ollama'&&m.sendDimensions)throw Error('Ollama 原生协议不发送 dimensions');if(c.embeddingModels.some(v=>v.id!==m.id&&v.providerId===m.providerId&&v.modelId===m.modelId))throw Error('该供应商下已有此嵌入模型');return p}
export function resolveEmbedding(c,id){
 if(id===undefined)id=c.defaultEmbeddingId;
 if(id==null){const url=(process.env.SELF_STUDY_EMBEDDING_URL||'http://127.0.0.1:11434').replace(/\/$/,'');return {model:process.env.SELF_STUDY_EMBEDDING_MODEL||'embeddinggemma',binding:'ollama',base_url:url+'/api/embed',effective_url:url+'/api/embed',api_key:'',extra_headers:{},provider_name:'ollama',dim:Number(process.env.SELF_STUDY_EMBEDDING_DIM||768),send_dimensions:false,batch_size:8,request_timeout:60,legacy:true}}
 const m=c.embeddingModels.find(m=>m.id===id);if(!m)throw Error('嵌入模型不存在');const p=validateEmbedding(m,c);return {model:m.modelId,binding:m.protocol,provider_name:m.protocol,base_url:endpoint(p,m),effective_url:endpoint(p,m),api_key:p.key||'',extra_headers:p.headers?JSON.parse(p.headers):{},api_version:p.version||null,dim:Number(m.dimensions),send_dimensions:m.sendDimensions,batch_size:Number(m.batchSize),request_timeout:Number(m.timeout),legacy:false};
}
export function fingerprint(config){return createHash('sha256').update(JSON.stringify([config.model,config.binding,config.effective_url,config.dim,config.send_dimensions,config.api_version||null,Object.entries(config.extra_headers||{}).sort()])).digest('hex')}
export function indexCount(dataDir){const root=path.join(dataDir,'book-engine/data/knowledge_bases');if(!existsSync(root))return 0;return readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name.startsWith('app-source-')&&(existsSync(path.join(root,d.name,'local-source.json'))||readdirSync(path.join(root,d.name)).some(n=>n.startsWith('version-')))).length}
export function assertEmbeddingChange(old,next,dataDir){for(const m of next.embeddingModels)validateEmbedding(m,next);if(indexCount(dataDir)&&fingerprint(resolveEmbedding(old))!==fingerprint(resolveEmbedding(next)))throw Error('已有材料索引，不能切换嵌入模型、维度或连接地址。请保留当前配置；本轮不自动重建索引。')}
export class EmbeddingRuntime{
 constructor(store){this.store=store;this.active=0}
 async test(id,{probe=false}={}){const c=this.store.load(),config=resolveEmbedding(c,id);this.active++;const started=Date.now();try{
 const headers={'Content-Type':'application/json',...(config.api_key?{[config.binding==='openai'&&config.api_version?'api-key':'Authorization']:config.binding==='openai'&&config.api_version?config.api_key:'Bearer '+config.api_key}:{}),...config.extra_headers};const body={model:config.model,input:['嵌入连接测试'],...(!probe&&config.send_dimensions?{dimensions:config.dim}:{})};const url=new URL(config.effective_url);if(config.api_version&&config.binding==='openai')url.searchParams.set('api-version',config.api_version);
 let r;try{r=await fetch(url,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(Math.min(config.request_timeout,60)*1000),redirect:'error'})}catch{throw Error('无法连接嵌入服务，或请求超时。请检查地址和服务状态。')}
 if(!r.ok)throw Error([401,403].includes(r.status)?'嵌入服务拒绝了凭据，请检查 API Key':r.status===429?'嵌入服务限流，请稍后重试':`嵌入服务返回 HTTP ${r.status}，请检查模型和协议`);
 let data;try{data=await r.json()}catch{throw Error('嵌入服务未返回有效 JSON')}
 const rows=config.binding==='ollama'?data.embeddings:data.data?.map(v=>v.embedding);const vector=rows?.[0];if(rows?.length!==1||!Array.isArray(vector)||!vector.length||vector.length>65536||vector.some(v=>typeof v!=='number'||!Number.isFinite(v))||vector.every(v=>v===0))throw Error('嵌入服务返回了无效向量');
 if(!probe&&vector.length!==config.dim)throw Error(`实际向量为 ${vector.length} 维，与配置的 ${config.dim} 维不一致，请探测维度后修改并保存。`);
 return {ok:true,model:config.model,dimensions:vector.length,elapsedMs:Date.now()-started,probe};
 }finally{this.active--}}
}

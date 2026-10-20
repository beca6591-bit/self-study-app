export const EMBEDDING_STORAGE='self-study-embedding-drafts-v1';
const fields=['id','name','modelId','providerId','protocol','dimensions','batchSize','timeout'];
export const supportsEmbedding=p=>['openai','ollama','custom','gemini'].includes(p.vendor);
export function loadEmbeddings(storage){
 const raw=storage.getItem(EMBEDDING_STORAGE);
 if(!raw)return {version:1,revision:0,models:[],defaultModelId:null};
 let c;try{c=JSON.parse(raw)}catch{throw Error('嵌入模型草稿无法读取，原数据未覆盖。请检查浏览器存储后刷新。')}
 if(c.version!==1||!Number.isSafeInteger(c.revision)||c.revision<0||!Array.isArray(c.models)||c.models.some(m=>!m||fields.some(k=>typeof m[k]!=='string')||!['ollama','openai'].includes(m.protocol)||typeof m.sendDimensions!=='boolean')||new Set(c.models.map(m=>m.id)).size!==c.models.length||(c.defaultModelId!==null&&!c.models.some(m=>m.id===c.defaultModelId)))throw Error('嵌入模型草稿格式异常，原数据未覆盖。请检查后刷新。');
 return c;
}
export function validateEmbedding(m,c,providers){
 /** @type {Record<string,string>} */
 const errors={};
 if(!m.name.trim()||m.name.trim().length>120)errors.name='请输入 1–120 字的显示名称';
 if(!m.modelId.trim()||/\s/.test(m.modelId.trim())||m.modelId.trim().length>200)errors.modelId='请输入准确模型 ID，不含空格，最多 200 字';
 const p=providers.find(p=>p.id===m.providerId&&supportsEmbedding(p));
 if(!p)errors.providerId='请选择支持嵌入接口的已保存供应商';
 if(!['ollama','openai'].includes(m.protocol))errors.protocol='请选择接口协议';
 if(m.protocol==='ollama'&&p?.vendor!=='ollama'&&p?.vendor!=='custom')errors.protocol='Ollama 协议需关联 Ollama 或自定义供应商';
 for(const [k,max,label] of [['dimensions',65536,'向量维度'],['batchSize',1024,'批次大小'],['timeout',600,'请求超时']])if(!/^\d+$/.test(m[k])||!Number.isSafeInteger(Number(m[k]))||Number(m[k])<1||Number(m[k])>max)errors[k]=`${label}需为 1–${max} 的整数`;
 if(c.models.some(v=>v.id!==m.id&&v.providerId===m.providerId&&v.modelId===m.modelId.trim()))errors.modelId='该供应商下已有此嵌入模型，请编辑已有草稿';
 return errors;
}
export function updateEmbeddings(storage,c,expectedRevision){
 const current=loadEmbeddings(storage);if(current.revision!==expectedRevision)throw Error('草稿已在其他页面更新，请重新打开此页后再修改。');
 const next={version:1,revision:current.revision+1,defaultModelId:c.defaultModelId,models:c.models.map(m=>Object.fromEntries([...fields.map(k=>[k,m[k].trim()]),['sendDimensions',m.protocol==='openai'&&!!m.sendDimensions]]))};
 storage.setItem(EMBEDDING_STORAGE,JSON.stringify(next));return next;
}

export const SETTINGS_STORAGE = 'self-study-model-settings-v1';
export const CAPABILITIES = ['vision', 'tool_calls', 'json_output', 'reasoning'];
export function loadCatalog(storage) {
  const raw = storage.getItem(SETTINGS_STORAGE);
  const data = raw ? JSON.parse(raw) : {version:1, providers:[]};
  if(data.version!==1 || !Array.isArray(data.providers) || data.providers.some(p=>!p || ['id','name','vendor','url','format','version'].some(k=>typeof p[k]!=='string')) || new Set(data.providers.map(p=>p.id)).size!==data.providers.length) throw Error('供应商草稿格式异常，请先检查供应商设置。');
  const models=data.models??[];
  if(!Array.isArray(models)||models.some(m=>!m||['id','name','modelId','providerId','contextWindow'].some(k=>typeof m[k]!=='string') || !m.capabilities || typeof m.capabilities!=='object' || Array.isArray(m.capabilities) || CAPABILITIES.some(k=>m.capabilities[k]!==undefined&&!['auto','yes','no'].includes(m.capabilities[k])))||new Set(models.map(m=>m.id)).size!==models.length)throw Error('语言模型草稿格式异常。请检查浏览器存储后刷新，原数据不会被覆盖。');
  if(data.defaultModelId!=null&&typeof data.defaultModelId!=='string')throw Error('默认模型草稿格式异常，请检查后刷新。');
  return {...data,models,defaultModelId:data.defaultModelId??null};
}
export function validateModel(model,catalog) {
  const errors={};
  if(!model.name.trim())errors.name='请输入模型显示名称';
  if(!model.modelId.trim()||/\s/.test(model.modelId.trim()))errors.modelId='请输入服务商提供的模型 ID，不包含空格';
  if(!catalog.providers.some(p=>p.id===model.providerId))errors.providerId='请选择已保存的供应商';
  if(model.contextWindow.trim()&&(!/^\d+$/.test(model.contextWindow.trim())||!Number.isSafeInteger(Number(model.contextWindow))||Number(model.contextWindow)<=0))errors.contextWindow='请输入正整数，或留空使用模型默认值';
  if(catalog.models.some(m=>m.id!==model.id&&m.providerId===model.providerId&&m.modelId===model.modelId.trim()))errors.modelId='该供应商下已配置此模型，请编辑已有模型';
  return errors;
}
export function writeModel(storage,model,{existing=false}={}) {
  const catalog=loadCatalog(storage);
  if(existing&&!catalog.models.some(m=>m.id===model.id))throw Error('此模型已在其他页面删除，请重新打开语言模型设置。');
  const errors=validateModel(model,catalog);
  if(Object.keys(errors).length)return {errors};
  const clean={id:model.id,name:model.name.trim(),modelId:model.modelId.trim(),providerId:model.providerId,contextWindow:model.contextWindow.trim(),capabilities:Object.fromEntries(CAPABILITIES.map(k=>[k,model.capabilities[k]||'auto']))};
  const next={...catalog,models:catalog.models.some(m=>m.id===clean.id)?catalog.models.map(m=>m.id===clean.id?clean:m):[...catalog.models,clean]};
  storage.setItem(SETTINGS_STORAGE,JSON.stringify(next));
  return {catalog:next,model:clean};
}
export function selectDefault(storage,id) {
  const catalog=loadCatalog(storage);
  const model=catalog.models.find(m=>m.id===id);
  if(!model||!catalog.providers.some(p=>p.id===model.providerId))throw Error('模型或供应商已不存在，请重新打开设置。');
  const next={...catalog,defaultModelId:id};storage.setItem(SETTINGS_STORAGE,JSON.stringify(next));return next;
}
export function deleteModel(storage,id) {
  const catalog=loadCatalog(storage);
  const next={...catalog,models:catalog.models.filter(m=>m.id!==id),defaultModelId:catalog.defaultModelId===id?null:catalog.defaultModelId};
  storage.setItem(SETTINGS_STORAGE,JSON.stringify(next));return next;
}

// Proposal capture uses the original file-grounding path; no LLM summarization here.
export function materialReferences(sources){
 if(sources.length>32)throw new Error('DeepTutor 每本书最多选择 32 份材料');
 return sources.map(s=>{
  if(s.indexStatus!=='ready'||!s.index?.kb)throw new Error('请先等待所有材料入库完成，失败材料可重试入库');
  return {id:s.id,kind:'file',source_id:'material.txt',label:s.title,available:true,metadata:{kb_name:s.index.kb,path:'material.txt'}};
 });
}

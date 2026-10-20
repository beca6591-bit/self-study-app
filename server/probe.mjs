import {TutorAI} from './ai.mjs';
const ai=new TutorAI(new URL('../data/ai-workspace',import.meta.url).pathname);
try{console.log(await ai.connect());const r=await ai.generate('根据材料，设计一个中文理解题。材料：语言模型预测下一个 token。输出流畅不保证事实正确，需要核对来源。',{type:'object',properties:{question:{type:'string'},answer:{type:'string'}},required:['question','answer'],additionalProperties:false});console.log(JSON.stringify(r.value));}catch(e){console.error(e.message);process.exitCode=1}finally{ai.close()}

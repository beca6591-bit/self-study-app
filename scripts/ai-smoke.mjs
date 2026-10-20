import {devEnv} from './dev-config.mjs';
import path from 'node:path';
import {TutorAI} from '../server/ai.mjs';
const env=devEnv();Object.assign(process.env,env);
const ai=new TutorAI(path.join(env.SELF_STUDY_DATA_DIR,'ai-workspace'));
try{
 const status=await ai.connect();console.log('AI 已连接',status);
 const result=await ai.generate('这是开发连通测试。仅根据材料生成一道简短中文理解题，不调用工具。材料：机会成本是放弃的最佳可行替代选择的价值。',{type:'object',properties:{question:{type:'string'}},required:['question'],additionalProperties:false});
 if(typeof result.value.question!=='string'||!result.value.question.trim())throw new Error('未取得有效问题');
 console.log('真实生成成功：'+result.value.question);
}catch(e){console.error(e.message);process.exitCode=1}finally{ai.close()}

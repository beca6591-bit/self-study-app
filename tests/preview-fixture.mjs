// Isolated UI acceptance fixture; never reads or writes user learning data.
import {mkdtemp} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
process.env.SELF_STUDY_DATA_DIR=await mkdtemp(path.join(os.tmpdir(),'study-ui-'));
process.env.SELF_STUDY_PORT='4183';
const {save}=await import('../server/store.mjs');
for(let i=1;i<=7;i++){
 const projectId='acceptance-'+i;save('projects',{id:projectId,title:'验收示例 '+i,courseTitle:'机会成本 · 验收示例 '+i,profile:{goal:'理解选择背后的机会成本',duration:'20'},status:'learning',confirmed:true,createdAt:'2026-10-06T00:00:00Z'});
 save('sources',{id:'s'+i,projectId,title:'自编验收材料',kind:'text',status:'ready',chunks:[{id:'s'+i+':1',text:'机会成本是为了获得一种选择，所放弃的最佳替代方案的价值。',start:0,end:1}]});
 save('lessons',{id:'l'+i,projectId,index:0,title:'选择背后的机会成本',goal:'解释最佳替代方案',status:'learning',minutes:20,chunkIds:['s'+i+':1'],content:{explanation:'机会成本是为了获得一种选择，所放弃的最佳替代方案的价值。它帮助我们比较不同选择。',example:'自编案例：周末读书或散步，选择读书时放弃的是散步的价值。',takeaways:['关注最佳替代方案，而不是所有选项之和。'],citations:[{chunkId:'s'+i+':1',quote:'所放弃的最佳替代方案的价值'}],questions:[{id:'q'+i,prompt:'选择读书时，机会成本是什么？',hint:'思考放弃的最佳选择。',answer:'散步的价值',rubric:'识别最佳替代',chunkIds:['s'+i+':1']}]}});
}
await import('../server/index.mjs');

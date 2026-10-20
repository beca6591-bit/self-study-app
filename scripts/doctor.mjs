import {existsSync} from 'node:fs';
import path from 'node:path';
import {appRoot,devEnv} from './dev-config.mjs';
const env=devEnv(),base=`http://127.0.0.1:${env.SELF_STUDY_FRONTEND_PORT}`;
console.log(`检查本地开发环境：${base}`);
console.log(`Node.js ${process.version}；字幕依赖：${existsSync(path.join(appRoot,'.venv/bin/python'))?'存在':'未安装，文本/PDF导入仍可用'}`);
for(const route of ['/api/health','/api/projects',...(process.argv.includes('--ai')?['/api/status']:[])]){
 try{const r=await fetch(base+route,{signal:AbortSignal.timeout(route==='/api/status'?60000:5000)});const value=await r.json();if(!r.ok||value.connected===false)throw new Error(value.error||`HTTP ${r.status}`);console.log(`${route}：正常`,route==='/api/projects'?`${value.length} 个开发项目`:value)}catch(e){console.error(`${route}：${e.message}`);process.exitCode=1}
}

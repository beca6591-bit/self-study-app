import {spawn} from 'node:child_process';
import net from 'node:net';
import {createRequire} from 'node:module';
import path from 'node:path';
import {appRoot,devEnv} from './dev-config.mjs';
const env=devEnv(),require=createRequire(import.meta.url);
async function available(port){await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',()=>reject(new Error(`端口 ${port} 已被占用，请关闭此前的开发窗口，或在 .env.development.local 中更换端口。`)));probe.listen(Number(port),'127.0.0.1',()=>probe.close(resolve))})}
const children=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');const force=setTimeout(()=>{for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');process.exit(code)},2500);Promise.all(children.map(c=>c.exitCode!==null?Promise.resolve():new Promise(r=>c.once('exit',r)))).then(()=>{clearTimeout(force);process.exit(code)})}
function start(args,label){const child=spawn(process.execPath,args,{cwd:appRoot,env,stdio:'inherit'});children.push(child);child.on('error',e=>{console.error(`${label}启动失败：${e.message}`);stop(1)});child.on('exit',code=>{if(!stopping){console.error(`${label}已退出`);stop(code||1)}});return child}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
try{
 await available(env.SELF_STUDY_PORT);await available(env.SELF_STUDY_FRONTEND_PORT);
 const vite=path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js');
 console.log(`\n自学 · 本地开发环境\n页面：http://127.0.0.1:${env.SELF_STUDY_FRONTEND_PORT}\n后端：http://127.0.0.1:${env.SELF_STUDY_PORT}\n数据：${env.SELF_STUDY_DATA_DIR}\n前端即时更新；服务端文件修改会重启后端并中断正在生成的任务。\n按 Ctrl+C 同时关闭两个服务。\n`);
 start(['--watch','server/index.mjs'],'后端');
 const base=`http://127.0.0.1:${env.SELF_STUDY_PORT}`;let ready=false;
 for(let n=0;n<80&&!stopping;n++){try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(500)});if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,150))}
 if(!ready)throw new Error('后端未就绪，请查看上方错误');
 start([vite,'--host','127.0.0.1','--port',env.SELF_STUDY_FRONTEND_PORT,'--strictPort'],'前端');
}catch(e){console.error(e.message);stop(1)}

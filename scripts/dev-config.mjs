import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
export const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function devEnv(){
 const config=path.join(appRoot,'.env.development.local');
 if(existsSync(config))process.loadEnvFile(config);
 const port=process.env.SELF_STUDY_PORT||'4180';
 const front=process.env.SELF_STUDY_FRONTEND_PORT||'51721';
 for(const value of [port,front])if(!/^\d+$/.test(value)||Number(value)<1024||Number(value)>65535)throw new Error('开发端口必须是 1024–65535 的整数');
 if(port===front)throw new Error('前端与后端必须使用不同端口');
 return {...process.env,NODE_ENV:'development',SELF_STUDY_ENV:'development',SELF_STUDY_PORT:port,SELF_STUDY_FRONTEND_PORT:front,SELF_STUDY_DATA_DIR:path.resolve(appRoot,process.env.SELF_STUDY_DATA_DIR||'data-dev')};
}

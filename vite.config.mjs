import {defineConfig} from 'vite';
import {devEnv} from './scripts/dev-config.mjs';
export default defineConfig(({command})=>{
 const env=command==='serve'?devEnv():process.env;
 return {server:{host:'127.0.0.1',port:Number(env.SELF_STUDY_FRONTEND_PORT||51721),strictPort:true,proxy:{'/api':{target:`http://127.0.0.1:${env.SELF_STUDY_PORT||4180}`,changeOrigin:true}}},build:{outDir:'dist',emptyOutDir:true}};
});

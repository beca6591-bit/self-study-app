import express from 'express';
export function settingsRouter(store,ai,busy){const router=express.Router();router.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');next()});
 router.get('/',(req,res)=>res.json(store.public()));
 const write=(fn)=>(req,res)=>{if(busy()||ai.active)return res.status(409).json({error:'有任务正在执行，请等待完成后再修改模型配置'});res.json(fn(req))};
 router.post('/providers',write(req=>store.saveProvider(req.body.provider,req.body.revision)));
 router.post('/models',write(req=>store.saveModel(req.body.model,req.body.revision)));
 router.post('/default',write(req=>store.default(req.body.id,req.body.revision)));
 router.post('/import',write(req=>store.importDraft(req.body.draft,req.body.revision)));
 router.delete('/providers/:id',write(req=>store.remove('providers',req.params.id,req.body.revision)));
 router.delete('/models/:id',write(req=>store.remove('models',req.params.id,req.body.revision)));
 router.post('/providers/:id/test',async(req,res)=>{res.json({ok:true,models:await ai.discover(req.params.id)})});
 router.post('/models/:id/test',async(req,res)=>res.json(await ai.test(req.params.id)));
 return router;
}

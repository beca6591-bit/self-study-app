"""Isolated local storage adapter for the original DeepTutor LlamaIndex pipeline."""
import asyncio
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
from deeptutor.services.embedding import EmbeddingConfig
from deeptutor.services.embedding.config import embedding_config_scope
from deeptutor.services.rag.pipelines.llamaindex.pipeline import LlamaIndexPipeline
from llama_index.core import Document

class ParsedDocumentLoader:
    async def load(self, file_paths, **kwargs):
        # Parsing is already performed by the application's PDF/DOCX importer.
        documents=[]
        for p in file_paths:
            info=Path(p).parent.parent/'source-info.json'
            title=json.loads(info.read_text()).get('title') if info.exists() else Path(p).name
            documents.append(Document(text=Path(p).read_text(encoding='utf-8'),metadata={'file_name':title,'file_path':str(p)}))
        return documents

class LocalLibrary:
    def __init__(self, root):
        self.root=Path(root).resolve()
        endpoint=os.environ.get('SELF_STUDY_EMBEDDING_URL','http://127.0.0.1:11434').rstrip('/')
        self.config=EmbeddingConfig(model=os.environ.get('SELF_STUDY_EMBEDDING_MODEL','embeddinggemma'),api_key='',binding='ollama',provider_name='ollama',base_url=endpoint+'/api/embed',effective_url=endpoint+'/api/embed',dim=int(os.environ.get('SELF_STUDY_EMBEDDING_DIM','768')),send_dimensions=False,batch_size=8)
        self.pipeline=LlamaIndexPipeline(kb_base_dir=str(self.root),document_loader=ParsedDocumentLoader())
        self.lock=asyncio.Lock()

    def folder(self,kb):
        if not re.fullmatch(r'app-source-[a-zA-Z0-9-]{1,100}',kb):
            raise ValueError('材料索引标识无效')
        folder=self.root/kb
        if not folder.resolve().is_relative_to(self.root):raise ValueError('材料路径无效')
        return folder

    def resolve_document(self,kb,relative):
        folder=self.folder(kb)/'raw'
        target=(folder/relative).resolve()
        return target if target.is_relative_to(folder.resolve()) and target.is_file() else None

    async def index(self,source_id,text,title='',progress=None):
        kb='app-source-'+source_id;folder=self.folder(kb)
        digest=hashlib.sha256((self.config.model+'\0'+str(self.config.dim)+'\0'+str(self.config.base_url)+'\0'+text).encode()).hexdigest()
        async with self.lock:
            manifest=folder/'local-source.json'
            if manifest.exists():
                old=json.loads(manifest.read_text())
                if old.get('digest')==digest and any(folder.glob('version-*/docstore.json')):return old
            (folder/'raw').mkdir(parents=True,exist_ok=True)
            (folder/'source-info.json').write_text(json.dumps({'title':title},ensure_ascii=False),encoding='utf-8')
            raw=folder/'raw'/'material.txt';raw.write_text(text,encoding='utf-8')
            with embedding_config_scope(self.config):
                ok=await self.pipeline.initialize(kb,[str(raw)],progress_callback=progress)
            if not ok:raise ValueError('材料入库失败，请确认 Ollama 和 embeddinggemma 可用后重试')
            result={'kb':kb,'digest':digest,'model':self.config.model,'dimensions':self.config.dim,'characters':len(text),'title':title}
            manifest.write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
            return result

    async def search(self,query,kb_name,**kwargs):
        folder=self.folder(kb_name)
        if not (folder/'local-source.json').exists():raise ValueError('材料尚未完成入库，请先入库')
        with embedding_config_scope(self.config):
            result=await self.pipeline.search(query,kb_name,top_k=kwargs.get('top_k',4))
        if not result or result.get('needs_reindex') or result.get('error_type'):
            raise ValueError('材料检索不可用，请重新入库')
        return result

    def delete(self,kbs):
        for kb in kbs:
            folder=self.folder(kb)
            if folder.exists():shutil.rmtree(folder)

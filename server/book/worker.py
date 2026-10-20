"""Application bridge to the pinned, unmodified DeepTutor book engine.
JSON-lines transport only; model requests are delegated to the existing Node AI client.
"""
import asyncio
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import uuid

APP = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(APP / 'vendor' / 'deeptutor'))
# Reuse installed engine libraries only for the same CPython version.
base_env = os.environ.get('SELF_STUDY_BOOK_BASE_ENV')
if base_env:
    site = Path(base_env) / 'lib' / f'python{sys.version_info.major}.{sys.version_info.minor}' / 'site-packages'
    if not site.is_dir():
        raise RuntimeError('书籍依赖环境与动画 Python 版本不匹配')
    sys.path.append(str(site))
# Original file grounding launches an isolated Python process.
os.environ['PYTHONPATH'] = os.pathsep.join(p for p in sys.path if p)
wire = sys.stdout
sys.stdout = sys.stderr  # Upstream diagnostics must not corrupt the protocol.
pending = {}

def emit(value):
    wire.write(json.dumps(value, ensure_ascii=False, default=str) + '\n')
    wire.flush()

async def completion(prompt='', system_prompt='', messages=None, **kwargs):
    if kwargs.get('tools') or kwargs.get('attachments'):
        raise ValueError('The local book bridge does not authorize tools or attachments')
    request_id = str(uuid.uuid4())
    future = asyncio.get_running_loop().create_future()
    pending[request_id] = future
    emit({'type':'model', 'id':request_id, 'prompt':prompt, 'system':system_prompt,
          'messages':messages, 'format':kwargs.get('response_format')})
    try:
        return await asyncio.wait_for(future, 300)
    finally:
        pending.pop(request_id, None)

async def stream(**kwargs):
    yield await completion(**kwargs)

# Install the transport boundary before importing agents/block generators.
import deeptutor.services.llm as llm
import yaml
from deeptutor.services.setup.init import DEFAULT_AGENTS_SETTINGS
settings_dir = Path(os.environ['DEEPTUTOR_HOME']) / 'data/user/settings'
settings_dir.mkdir(parents=True, exist_ok=True)
agents_file = settings_dir / 'agents.yaml'
if not agents_file.exists():
    agents_file.write_text(yaml.safe_dump(DEFAULT_AGENTS_SETTINGS), encoding='utf-8')
llm.complete = completion
llm.stream = stream
llm.get_llm_config = lambda *a, **k: SimpleNamespace(model='local-book-bridge', api_key='', base_url='', binding='openai', api_version=None, temperature=0.4, max_tokens=16000)
import deeptutor.services.llm.config as llm_config_module
llm_config_module.get_llm_config = llm.get_llm_config
from deeptutor.agents.base_agent import BaseAgent
async def agent_call(self, user_prompt, system_prompt, **kwargs):
    return await completion(prompt=user_prompt, system_prompt=system_prompt, **kwargs)
async def agent_stream(self, user_prompt, system_prompt, **kwargs):
    yield await agent_call(self, user_prompt, system_prompt, **kwargs)
BaseAgent.call_llm = agent_call
BaseAgent.stream_llm = agent_stream

from deeptutor.book.engine import BookEngine
from deeptutor.book.compiler import CompilerOptions
from deeptutor.book.models import BookProposal, Spine, BlockType
from deeptutor.book.storage import BookStorage
from deeptutor.services.path_service import PathService

# Reuse original input capture and file grounding; resolve only this app's files.
import re
async def library_search(query,kb_name,**kwargs):
    request_id=str(uuid.uuid4())
    future=asyncio.get_running_loop().create_future();pending[request_id]=future
    emit({'type':'library','id':request_id,'method':'search','args':{'query':query,'kb_name':kb_name,'top_k':kwargs.get('top_k',4)}})
    try:return await asyncio.wait_for(future,300)
    finally:pending.pop(request_id,None)
def resolve_document(kb,relative):
    if not re.fullmatch(r'app-source-[a-zA-Z0-9-]{1,100}',kb or ''):return None
    root=(Path(os.environ['DEEPTUTOR_HOME'])/'data'/'knowledge_bases'/kb/'raw').resolve()
    target=(root/relative).resolve()
    return target if target.is_relative_to(root) and target.is_file() else None
import deeptutor.multi_user.knowledge_access as knowledge_access
knowledge_access.resolve_kb_document_path=resolve_document
import deeptutor.tools.rag_tool as rag_tool
rag_tool.rag_search=library_search
from native import install_question_transport, restore_block_types, video_file, compile_with_backup
install_question_transport(completion)
storage = BookStorage(path_service=PathService(Path(os.environ['DEEPTUTOR_HOME']) / 'data'))
engine = BookEngine(storage=storage, compiler_options=CompilerOptions(phase=2, rag_enabled=True, block_concurrency=1))

def dump(value):
    if hasattr(value,'model_dump'): return value.model_dump(mode='json')
    if isinstance(value,(list,tuple)): return [dump(v) for v in value]
    return value

def snapshot(book_id):
    book = engine.load_book(book_id)
    if not book: raise ValueError('Book not found')
    return {'book':dump(book),'spine':dump(engine.load_spine(book_id)), 'pages':dump(engine.list_pages(book_id)), 'progress':dump(engine.load_progress(book_id))}

async def command(message):
    method, args = message['method'], message.get('args',{})
    if method in ('compile', 'visual'):
        book = engine.load_book(args['book_id'])
        if book and restore_block_types(book):
            storage.save_book(book)
    if method == 'delete':
        if engine.load_book(args['book_id']) and not engine.delete_book(args['book_id']):
            raise ValueError('书籍文件删除失败，请重试')
        return {'ok': True}
    if method == 'video':
        return {'path': video_file(storage, **args)}
    if method == 'insert':
        args['block_type'] = BlockType(args['block_type'])
        return dump(await engine.insert_block(**args, compile_now=True))
    if method == 'retry':
        return dump(await engine.regenerate_block(**args))
    if method == 'answer':
        return dump(await engine.record_quiz_attempt(**args))
    if method == 'health':
        import importlib.util
        import shutil
        dependencies = {name: bool(shutil.which(name)) for name in ('ffmpeg', 'latex', 'dvisvgm')}
        dependencies['manim'] = importlib.util.find_spec('manim') is not None
        return {'engine':'DeepTutor','version':'1.6.13','generatorMode':'native','animationReady':all(dependencies.values()),'dependencies':dependencies,'storage':str(storage.path_service.workspace_root)}
    if method == 'create':
        book, proposal = await engine.create_book(**args)
        # Use the original planner catalog and generator registry.
        book.metadata = {**(book.metadata or {}), 'local_generator_version': 'deeptutor-native-v1'}
        engine.storage.save_book(book)
        return snapshot(book.id)
    if method == 'get': return snapshot(args['book_id'])
    if method == 'proposal':
        book, spine = await engine.confirm_proposal(book_id=args['book_id'],edited_proposal=BookProposal.model_validate(args['proposal']))
        return snapshot(book.id)
    if method == 'spine':
        await engine.confirm_spine(book_id=args['book_id'],edited_spine=Spine.model_validate(args['spine']),auto_compile=False)
        return snapshot(args['book_id'])
    if method == 'visual':
        kind = BlockType(args['kind'])
        if kind not in (BlockType.FIGURE, BlockType.ANIMATION):
            raise ValueError('Unsupported visual type')
        if args.get('block_id'):
            result = await engine.regenerate_block(book_id=args['book_id'],page_id=args['page_id'],block_id=args['block_id'])
        else:
            result = await engine.insert_block(book_id=args['book_id'],page_id=args['page_id'],block_type=kind,compile_now=True)
        return dump(result)
    if method == 'compile':
        return dump(await compile_with_backup(engine, storage, args['book_id'], args['page_id'], args.get('force', False)))
    raise ValueError('Unknown bridge operation')

async def handle(message):
    try: emit({'type':'result','id':message['id'],'result':await command(message)})
    except Exception as exc: emit({'type':'result','id':message['id'],'error':str(exc)})

async def main():
    tasks=set()
    while line := await asyncio.to_thread(sys.stdin.readline):
        try: message=json.loads(line)
        except ValueError: continue
        if message.get('type')=='model_result':
            future=pending.get(message['id'])
            if future and not future.done():
                if message.get('error'): future.set_exception(RuntimeError(message['error']))
                else: future.set_result(message['text'])
        else:
            task=asyncio.create_task(handle(message));tasks.add(task);task.add_done_callback(tasks.discard)
    for task in tasks: task.cancel()

asyncio.run(main())

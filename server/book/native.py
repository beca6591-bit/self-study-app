"""Transport and file-access adapters; generation stays in pinned DeepTutor."""
from pathlib import Path
from types import SimpleNamespace

LEGACY_TEXT_TYPES = {'text', 'section', 'callout', 'flash_cards'}
LEGACY_TYPES = LEGACY_TEXT_TYPES | {'figure', 'animation'}

def restore_block_types(book):
    """Migrate only our old six-type restriction, preserving intentional choices."""
    metadata = dict(book.metadata or {})
    if set(metadata.get('block_types') or []) in (LEGACY_TEXT_TYPES, LEGACY_TYPES):
        metadata.pop('block_types', None)
        book.metadata = metadata
        return True
    return False

class CompletionStream:
    def __init__(self, text):
        self.text = text
    async def __aiter__(self):
        yield SimpleNamespace(choices=[SimpleNamespace(index=0, delta=SimpleNamespace(content=self.text, tool_calls=None), finish_reason=None)], usage=None)
        yield SimpleNamespace(choices=[SimpleNamespace(index=0, delta=SimpleNamespace(content=None, tool_calls=None), finish_reason='stop')], usage=None)
    async def close(self):
        pass

class LocalClient:
    """OpenAI stream shape used by the upstream QuestionPipeline."""
    def __init__(self, completion):
        self.completion = completion
        self.chat = SimpleNamespace(completions=self)
    async def create(self, **kwargs):
        # No native tools are exposed by this local transport. The original
        # question planner and labeled-step protocol are retained.
        text = await self.completion(messages=kwargs.get('messages'), system_prompt='遵守消息中的输出协议与标签。根据章节上下文完成任务，不调用工具。')
        if kwargs.get('stream'):
            return CompletionStream(text)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=text, tool_calls=None), finish_reason='stop')], usage=None)

def install_question_transport(completion):
    import deeptutor.runtime.agentic as runtime
    import deeptutor.runtime.agentic.client as client
    factory = lambda *a, **kw: LocalClient(completion)
    runtime.build_openai_client = factory
    client.build_openai_client = factory
    import deeptutor.agents.question.pipeline as questions
    questions.build_openai_client = factory
    # This application has no upstream KB/tool workspace. Do not advertise
    # tools that could bypass the application's model and document adapters.
    questions.compose_enabled_tools = lambda *a, **kw: []

def video_file(storage, book_id, page_id, block_id):
    page = storage.load_page(book_id, page_id)
    block = next((b for b in page.blocks if b.id == block_id), None) if page else None
    if block is None or block.type.value != 'animation':
        raise ValueError('动画不存在')
    url = block.payload.get('video_url', '')
    prefix = '/files/outputs/'
    if not url.startswith(prefix):
        raise ValueError('动画文件地址不可用')
    root = storage.path_service.user_data_dir.resolve()
    candidate = (root / url[len(prefix):]).resolve()
    if not candidate.is_relative_to(root) or candidate.suffix.lower() != '.mp4' or not candidate.is_file():
        raise ValueError('动画文件不存在')
    return str(candidate)

async def compile_with_backup(engine, storage, book_id, page_id, force=False):
    previous = storage.load_page(book_id, page_id) if force else None
    backup = previous.model_copy(deep=True) if previous else None
    preserved = []
    try:
        if previous:
            preserved = [b for b in previous.blocks if b.type.value == 'user_note' or (b.metadata or {}).get('edited_by_user')]
            previous.blocks = []  # Ask the original architect for a fresh content plan.
            storage.save_page(previous)
        page = await engine.compile_page(book_id=book_id, page_id=page_id, force=force)
        if force and page.status.value != 'ready':
            raise ValueError('重新生成未完成，原章节已保留，请重试')
        if preserved:
            page.blocks.extend(preserved)
            storage.save_page(page)
        return page
    except Exception:
        if backup:
            storage.save_page(backup)
        raise

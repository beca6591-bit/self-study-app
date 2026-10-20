"""Regression tests for local/original engine integration (no network)."""
import asyncio
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace as NS
import unittest
from unittest.mock import patch
ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT/'server/book'), str(ROOT/'vendor/deeptutor')]
from native import LEGACY_TYPES, restore_block_types, video_file, LocalClient, compile_with_backup
from deeptutor.book.agents.page_planner import SectionArchitect
from deeptutor.book.models import Chapter, ContentType, BlockType, Block, Page
from deeptutor.book.blocks.base import get_block_registry, BlockContext

class NativeIntegration(unittest.IsolatedAsyncioTestCase):
    def test_migrate_only_legacy_restriction(self):
        book=NS(metadata={'block_types':list(LEGACY_TYPES),'custom':'keep'})
        self.assertTrue(restore_block_types(book)); self.assertEqual(book.metadata,{'custom':'keep'})
        self.assertFalse(restore_block_types(book))
        early=NS(metadata={'block_types':['text','section','callout','flash_cards']})
        self.assertTrue(restore_block_types(early))
        custom=NS(metadata={'block_types':['section','figure']})
        self.assertFalse(restore_block_types(custom))
    def test_original_fallback_and_registry(self):
        planner=SectionArchitect(llm_enabled=False)
        registry=get_block_registry()
        for content,expected in [(ContentType.THEORY,BlockType.FIGURE),(ContentType.DERIVATION,BlockType.ANIMATION),(ContentType.PRACTICE,BlockType.INTERACTIVE)]:
            plan=planner.plan_blocks(Chapter(title='test',content_type=content))
            self.assertIn(expected,[b.type for b in plan])
        self.assertEqual(type(registry.get(BlockType.FIGURE)).__name__,'FigureGenerator')
        self.assertEqual(type(registry.get(BlockType.ANIMATION)).__name__,'AnimationGenerator')
    async def test_llm_plan_preserves_focus_and_mixed_visuals(self):
        async def plan(**kwargs):
            return {'blocks':[{'type':'figure','focus':'三边关系','params':{'variant':'comparison'}},{'type':'animation','focus':'逐步推导'},{'type':'interactive','focus':'拖动顶点'}]}
        with patch('deeptutor.book.agents.page_planner.llm_json',plan):
            blocks=await SectionArchitect().plan_blocks_async(Chapter(title='勾股定理'),language='zh')
        self.assertEqual([b.type for b in blocks],[BlockType.SECTION,BlockType.FIGURE,BlockType.ANIMATION,BlockType.INTERACTIVE])
        self.assertEqual(blocks[1].params['focus'],'三边关系')
        self.assertEqual(blocks[1].params['variant'],'comparison')
    async def test_original_figure_receives_planned_focus(self):
        seen={}
        class Pipeline:
            def __init__(self,**kwargs):pass
            async def run_analysis(self,**kwargs):
                seen.update(kwargs);return NS(render_type='svg',description='图示',chart_type='diagram')
            async def run_code_generation(self,**kwargs):
                return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="50" height="50"/></svg>'
        block=Block(type=BlockType.FIGURE,params={'focus':'比较两个直角三角形','variant':'comparison'})
        ctx=BlockContext(book_id='test',chapter=Chapter(title='勾股定理'),page=Page(book_id='test',chapter_id='ch',title='测试'),block=block,language='zh')
        with patch('deeptutor.agents.visualize.pipeline.VisualizePipeline',Pipeline),patch('deeptutor.services.llm.config.get_llm_config',lambda:NS(api_key='',base_url='',api_version=None)):
            await get_block_registry().get(BlockType.FIGURE).generate(ctx)
        self.assertEqual(block.status.value,'ready',block.error)
        self.assertIn('比较两个直角三角形',seen['user_input'])
        self.assertIn('comparison',seen['user_input'])
        self.assertEqual(seen['render_mode'],'figure')
    async def test_question_stream_transport(self):
        async def completion(**kwargs):return 'PLAN\n{"questions":[]}'
        stream=await LocalClient(completion).create(messages=[],stream=True)
        chunks=[c async for c in stream]
        self.assertTrue(chunks[0].choices[0].delta.content.startswith('PLAN'))
        self.assertEqual(chunks[-1].choices[0].finish_reason,'stop')
    async def test_regeneration_replans_and_restores_original_on_failure(self):
        from deeptutor.book.models import PageStatus, BlockStatus
        original=Page(book_id='book',chapter_id='chapter',title='旧章节',status=PageStatus.READY,
                      blocks=[Block(type=BlockType.TEXT,status=BlockStatus.READY,payload={'text':'保留原文'})])
        stored={'page':original.model_copy(deep=True)}
        storage=NS(load_page=lambda *a:stored['page'].model_copy(deep=True),save_page=lambda p:stored.update(page=p.model_copy(deep=True)))
        async def fail(**kwargs):
            self.assertTrue(kwargs['force']);self.assertEqual(stored['page'].blocks,[])
            raise RuntimeError('model failure')
        with self.assertRaises(RuntimeError):
            await compile_with_backup(NS(compile_page=fail),storage,'book','page',True)
        self.assertEqual(stored['page'].model_dump(),original.model_dump())
        async def partial(**kwargs):return original.model_copy(update={'status':PageStatus.PARTIAL})
        with self.assertRaises(ValueError):
            await compile_with_backup(NS(compile_page=partial),storage,'book','page',True)
        self.assertEqual(stored['page'].model_dump(),original.model_dump())
        async def success(**kwargs):
            result=original.model_copy(deep=True);result.blocks[0].payload={'text':'新章节'};storage.save_page(result);return result
        result=await compile_with_backup(NS(compile_page=success),storage,'book','page',True)
        self.assertEqual(result.blocks[0].payload['text'],'新章节')

    def test_video_access_rejects_escape_and_nonvideo(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); (root/'clip.mp4').write_bytes(b'video')
            block=NS(id='b',type=BlockType.ANIMATION,payload={'video_url':'/files/outputs/clip.mp4'})
            storage=NS(path_service=NS(user_data_dir=root),load_page=lambda *a:NS(blocks=[block]))
            self.assertEqual(video_file(storage,'book','page','b'),str((root/'clip.mp4').resolve()))
            for url in ['/files/outputs/../outside.mp4','https://example.com/clip.mp4','/files/outputs/clip.txt']:
                block.payload['video_url']=url
                with self.assertRaises(ValueError):video_file(storage,'book','page','b')

if __name__=='__main__':unittest.main()

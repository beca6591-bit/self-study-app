"""Storage boundary tests; real-model regression is scripts/book-library-smoke.mjs."""
import sys
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'server/book'),str(ROOT/'vendor/deeptutor')]
from library import LocalLibrary

class LibraryTests(unittest.IsolatedAsyncioTestCase):
    async def test_full_text_persists_and_unchanged_index_is_reused(self):
        with tempfile.TemporaryDirectory() as directory:
            library=LocalLibrary(directory);seen=[]
            async def initialize(kb,files,**kwargs):
                seen.append(Path(files[0]).read_text());version=Path(directory)/kb/'version-1';version.mkdir(exist_ok=True);(version/'docstore.json').write_text('{}');return True
            library.pipeline=SimpleNamespace(initialize=initialize)
            text='原文'.__mul__(45000)+'尾部内容'
            first=await library.index('test',text,'标题')
            again=await library.index('test',text,'标题')
            self.assertEqual(first,again);self.assertEqual(seen,[text]);self.assertEqual(first['dimensions'],768)
            (Path(directory)/first['kb']/'version-1'/'docstore.json').unlink()
            await library.index('test',text,'标题');self.assertEqual(len(seen),2)
    async def test_failure_not_marked_ready_and_missing_index_not_searched(self):
        with tempfile.TemporaryDirectory() as directory:
            library=LocalLibrary(directory)
            async def fail(*args,**kwargs):raise RuntimeError('offline')
            library.pipeline=SimpleNamespace(initialize=fail)
            with self.assertRaises(RuntimeError):await library.index('test','原始材料','标题')
            self.assertFalse((Path(directory)/'app-source-test'/'local-source.json').exists())
            self.assertEqual((Path(directory)/'app-source-test'/'raw'/'material.txt').read_text(),'原始材料')
            with self.assertRaises(ValueError):await library.search('问题','app-source-test')
    def test_paths_are_confined_to_application_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            library=LocalLibrary(directory)
            for kb in ['../other','admin:kb:private','/tmp','app-source-../escape']:
                with self.assertRaises(ValueError):library.folder(kb)
            self.assertIsNone(library.resolve_document('app-source-test','../../../etc/passwd'))

if __name__=='__main__':unittest.main()

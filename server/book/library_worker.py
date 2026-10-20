"""Dedicated RAG process: keep numerical libraries separate from Manim's runtime."""
import asyncio
import json
import os
from pathlib import Path
import sys
APP=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(APP/'vendor/deeptutor'))
wire=sys.stdout
sys.stdout=sys.stderr
from library import LocalLibrary
library=LocalLibrary(Path(os.environ['DEEPTUTOR_HOME'])/'data'/'knowledge_bases')
def emit(value):
    wire.write(json.dumps(value,ensure_ascii=False,default=str)+'\n');wire.flush()
async def main():
    while line:=await asyncio.to_thread(sys.stdin.readline):
        message=json.loads(line);method=message['method'];args=message.get('args',{})
        try:
            if method=='index':
                def progress(*values):
                    detail=' / '.join(str(v) for v in values if isinstance(v,(int,float)))
                    emit({'type':'progress','id':message['id'],'text':'正在建立材料向量索引'+('：'+detail if detail else '')})
                result=await library.index(**args,progress=progress)
            elif method=='search':result=await library.search(**args)
            elif method=='delete_indexes':library.delete(args['kbs']);result={'ok':True}
            else:raise ValueError('Unknown library operation')
            emit({'type':'result','id':message['id'],'result':result})
        except Exception as exc:
            emit({'type':'result','id':message['id'],'error':str(exc)})
asyncio.run(main())

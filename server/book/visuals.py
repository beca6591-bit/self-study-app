"""Legacy SVG/CSS generators. Not registered by worker.py; new books use upstream generators."""
import re
from deeptutor.book.blocks.base import BlockGenerator, GenerationFailure, get_block_registry
from deeptutor.book.models import BlockType
from deeptutor.agents.visualize.pipeline import VisualizePipeline
from deeptutor.agents.visualize.utils import validate_visualization

def validate_visual(code, animation=False):
    ok, error = validate_visualization(code, 'html' if animation else 'svg')
    if not ok:
        return False, error
    if re.search(r'<\s*(script|iframe|object|embed|link|base)\b|\bon\w+\s*=|javascript:|https?://(?!www\.w3\.org/)', code, re.I):
        return False, 'Use self-contained SVG/HTML/CSS only. No scripts, event handlers, embeds or remote resources.'
    if animation and re.search(r'<\s*(animate|animateTransform|animateMotion|set)\b', code, re.I):
        return False, 'Use CSS animations only so host pause and replay controls work.'
    if animation and ('@keyframes' not in code or not re.search(r'animation(?:-name)?\s*:', code)):
        return False, 'Include a visible CSS keyframe animation; do not return a static illustration.'
    return True, ''

class VisualGenerator(BlockGenerator):
    block_type = BlockType.FIGURE
    animation = False

    async def _generate(self, ctx):
        from deeptutor.services.llm import get_llm_config
        config = get_llm_config()
        pipeline = VisualizePipeline(api_key=config.api_key,base_url=config.base_url,api_version=config.api_version,language=ctx.language)
        context = '\n'.join([ctx.chapter.title, ctx.chapter.summary, *ctx.chapter.learning_objectives])
        # Use the actual surrounding explanation, not just a generic chapter label.
        context += '\n' + '\n'.join(str(b.payload) for b in ctx.page.blocks if b.type in (BlockType.TEXT, BlockType.SECTION))[:20000]
        kind = '网页教学动画' if self.animation else '静态教学图示'
        brief = f'根据本章内容制作{kind}。突出一个核心概念，中文标签清晰，排版不重叠，包含解释或图例。'
        if self.animation:
            brief += '输出独立 HTML，画面用 SVG/HTML，运动仅用 CSS @keyframes 动画。动画必须能持续循环，步骤变化清楚。不要 JavaScript、SVG SMIL、计时器或外部库。播放、暂停和重播由宿主提供，不要自己添加按钮。'
        else:
            brief += '输出独立 SVG，含 viewBox，使用矢量形状和文字，不使用外部图片。'
        brief += '不联网，不使用脚本、事件属性或外部资源。只使用文档内的样式。'
        analysis = await pipeline.run_analysis(user_input=brief,history_context=context,render_mode='html' if self.animation else 'svg')
        code = await pipeline.run_code_generation(user_input=brief,history_context=context,analysis=analysis)
        ok, error = validate_visual(code, self.animation)
        if not ok:
            review = await pipeline.run_repair(user_input=brief,analysis=analysis,code=code,error=error)
            code = review.optimized_code or code
            ok,error = validate_visual(code,self.animation)
        if not ok:
            raise GenerationFailure(error)
        return ({'render_type':'web_animation' if self.animation else 'svg', 'code':{'language':'html' if self.animation else 'svg','content':code}, 'description':analysis.description}, [], {'pipeline':'DeepTutor VisualizePipeline','renderer':'css' if self.animation else 'svg'})

class WebAnimationGenerator(VisualGenerator):
    block_type = BlockType.ANIMATION
    animation = True

def install_visual_generators():
    registry = get_block_registry()
    registry.register(VisualGenerator())
    registry.register(WebAnimationGenerator())

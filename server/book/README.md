# DeepTutor 书籍适配（开发中）

固定源码版本见 `vendor/deeptutor/SOURCE.md`。不读取原 DeepTutor 的用户数据或密钥。

- SQLite：学习项目、上传材料、任务、阅读进度、个人记忆、页面问答。
- DeepTutor JSON 存储：学习方案、章节主线、书籍页和内容块，位于应用数据目录 `book-engine/data`。
- 模型：沿用现有 `TutorAI`，通过 Python JSON-lines 桥转发调用。
- Python：`SELF_STUDY_BOOK_PYTHON` 可覆盖本机已安装的 DeepTutor 环境路径。macOS 当前适配 ARM64 Python。
- 已恢复 DeepTutor v1.6.13 原版章节规划和默认生成器：text、section、callout、flash_cards、quiz、figure（SVG / Chart.js / Mermaid）、interactive（隔离 HTML）、animation（Manim 视频）、code、timeline。规划的 focus / variant 原样交给原版生成器。原版概览仍由引擎生成。
- 自动迁移本应用早期四类型与六类型白名单；保留已经生成的章节、阅读进度、用户其他自定义白名单及旧 SVG/CSS 动画。迁移在后续生成时生效，不自动重写已完成章节。
- QuestionPipeline 保留原版探索、规划和出题步骤，模型传输接入当前 TutorAI；本地未接入上游工具工作区，因此不挂载上游工具。上传材料沿用本应用显式文本快照，不读取原 DeepTutor 用户数据。
- 上传与方案分离：上传解析后创建 `book:source` 独立入库任务，复用原版 LlamaIndexPipeline、SentenceSplitter、EmbeddingClient 和持久化检索。默认本机 Ollama `embeddinggemma`（768 维）；原文全量入库，不经过 LLM 摘要。方案入口要求所有选定材料已入库。
- 方案恢复原版 build_book_inputs 的文件摘录（每份最多约 4000 字符，原版整体预算与最多 32 个来源限制）；确认方案后 SourceExplorer 根据 knowledge_bases 检索完整材料。正文 RAG 与页面问答复用同一隔离索引。
- 单文件 30 MB，取消原先 80000 字符入库上限。PDF/DOCX 解析沿用现有导入器，将提取后的全文交给原版入库流水线；本地适配只处理存储路径和模型配置，不读用户原 DeepTutor 工作区。
- 配置：SELF_STUDY_EMBEDDING_URL 默认 http://127.0.0.1:11434；SELF_STUDY_EMBEDDING_MODEL 默认 embeddinggemma；SELF_STUDY_EMBEDDING_DIM 默认 768。默认服务不可用时按需启动已安装 Ollama，作为共享本地服务运行，后端重启不关闭 Ollama；自定义地址要求用户自行启动，不自动下载模型。
- 项目列表及项目内支持确认后删除：移除该项目 SQLite 记录、书籍目录及独占上传文件，不删除个人记忆；有运行任务时禁止删除。
- 移除手动添加图示/动画 UI 和 HTTP 接口，仅由章节规划自动决定模块。支持确认后重新生成章节，重新规划并替换正文，成功后重置该章阅读进度和问答，保留收藏；失败恢复原章节。

真实生成验证：`node scripts/book-smoke.mjs`。只使用自编数学材料，结果保存在独立 `data-book-smoke` 目录。不得将原型固定内容当作测试通过证据。

当前生成策略：确认主线只创建目录；点击章节时生成，已完成章节直接读取。验证脚本 `node scripts/book-on-demand-smoke.mjs` 使用独立两章项目检查按需生成及重启保存。

尚待完善（不属于本轮章节模块恢复范围）：暂停/取消传播、深入讲解与书页笔记的完整编辑流程、源文引用展示、失败问答重试、导出/重建、整个 DeepTutor 工作区 UI 迁移。

## 原版动画环境

2026-10-18：项目 `.runtime/animation` 安装 Python 3.14、Manim 0.22.0、FFmpeg；`.runtime/texlive` 安装便携 TeX Live、dvisvgm 及公式模板依赖。仅由书籍子进程添加 PATH，不修改系统 PATH。安装目录及下载缓存不进入版本管理。

重装（Apple Silicon）：`sh scripts/setup-book-animation.sh`。脚本使用 conda-forge 与 TeX Live 镜像；可用 `SELF_STUDY_TEX_REPOSITORY` 指定 TeX Live 仓库。Python 引擎其他依赖使用本项目 .venv 的同版本 site-packages；`SELF_STUDY_BOOK_BASE_ENV` 可覆盖其根目录。`SELF_STUDY_BOOK_PYTHON` 显式设置时优先使用指定解释器，否则优先使用项目动画环境，再回退本项目 .venv/bin/python。

`GET /api/books/health` 返回 `generatorMode: native`、`animationReady` 和依赖检测结果。存在检查不能代替渲染验收；本机已成功渲染真实 MathTex 公式测试及原版流水线生成的 8.07 秒 H.264 视频（854×480）。视频只通过指定书籍/页面/模块资源接口读取，限制在该应用的数据目录，支持浏览器 Range 请求。

## 验收记录（2026-10-18）

- `npm test`：16 项既有测试通过；`tests/book_native.py`：6 项接入测试通过。
- `npm run build`：通过。Chart.js 与 Mermaid 按需加载。
- 真实章节自动规划：`data-book-native-1792307652969/verification.json`。8 个块全部 ready，包含自动选择的 SVG、HTML 互动和测验，无逐块手工选择。
- 原版动画生成：`data-book-animation-native-1792308159806/verification.json`。实际视频生成、保存和重启读取通过；浏览器已播放到结尾，视频分段请求返回 HTTP 206。测试 insert 传输曾在生成成功后因字符串枚举报错，已修复为 BlockType 转换，并重新验证保存结果与视频资源。
- 独立 UI 样例用于覆盖 Chart.js、Mermaid、HTML 交互、测验保存、代码和时间线，明确标识测试数据，不当作真实模型生成证据。
- 新增单模块重试和测验提交接口；选择题按保存的答案判定，书面题允许记录后自评。互动 iframe 的提问消息仅预填章节问答，不自动发送。

材料真实验收：`node scripts/book-library-smoke.mjs`，独立临时数据，真实本机向量入库与重启检索，方案使用模拟 LLM 回包检查原版摘录边界。

检索进程使用 `SELF_STUDY_LIBRARY_PYTHON`（默认本项目 `.venv/bin/python`），与 Manim 动画环境隔离，避免 NumPy / FAISS / OpenMP 动态库冲突。入库不调用 LLM；方案与 SourceExplorer 仍通过现有 TutorAI。

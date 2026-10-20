# 自学 · Self Study

本地运行的 AI 自学应用。支持导入学习材料、生成书籍与章节、阅读问答和复习，并在设置中管理供应商和语言模型。

这是从 Axhub 工作区拆出的独立应用。无需安装 Axhub，也不包含其他原型、主题库、个人材料或学习数据库。

## 快速开始

需要 Node.js 22.13 或更新版本，以及 npm。先在本目录执行：

```sh
npm ci
npm run build
npm start
```

打开 http://127.0.0.1:4179 。若旧应用已占用该端口，先关闭旧服务，或使用 `SELF_STUDY_PORT=4190 npm start` 并打开对应端口。

开发界面使用 `npm run dev`，默认 http://127.0.0.1:51721 。运行旧工作区时这些端口可能被占用，可复制 `.env.development.example` 为 `.env.development.local` 并更换前后端端口。

## 书籍引擎与材料检索

页面和设置由 Node 服务运行；书籍生成与材料索引还需要 Python 环境。已验证的依赖快照使用 Python 3.14：

```sh
python3.14 -m venv .venv
.venv/bin/python -m pip install -r requirements-book.txt
```

默认使用本项目 `.venv/bin/python`。Apple Silicon 默认按 ARM64 启动 Python；如有意使用 Intel 环境，可设置 `SELF_STUDY_PYTHON_ARCH=x86_64`。也可以用 `SELF_STUDY_BOOK_PYTHON` 和 `SELF_STUDY_LIBRARY_PYTHON` 显式指定已有环境；开发模式可写入 `.env.development.local`，正式启动需在终端导出环境变量。依赖清单来自已运行环境，不保证所有操作系统都有对应二进制包。

材料向量索引需要已安装 Ollama，并准备 `embeddinggemma` 模型：

```sh
ollama pull embeddinggemma
ollama serve
```

若 Ollama 已运行，无需重复启动。可用 `SELF_STUDY_EMBEDDING_URL`、`SELF_STUDY_EMBEDDING_MODEL`、`SELF_STUDY_EMBEDDING_DIM` 自定义服务。

Manim 动画需要额外环境；Apple Silicon 可执行 `sh scripts/setup-book-animation.sh` 安装 Manim、FFmpeg 与 TeX。动画 Python 与 `.venv` 需使用相同版本，依赖由 `SELF_STUDY_BOOK_BASE_ENV` 指定（默认本项目 `.venv`）。仅安装 Node 依赖不能生成动画。

## 模型设置

从“我的 → 模型设置”进入。内置 Codex 复用本机登录，需要可用的 Codex app-server；也可填写支持 Chat Completions、Responses 或 Anthropic Messages 的供应商地址和 API Key。新增模型、保存、测试并设为默认后，后续生成和问答使用此模型。

可用 `SELF_STUDY_CODEX` 指定 Codex 可执行文件。复制代码不会复制登录状态或 API Key。

## 数据与隐私

正式数据在 `data/`，开发数据在 `data-dev/`，均不上传 GitHub。`model-settings.json` 保存本地模型配置和凭据（权限 0600，未加密），不会回传密钥给前端。备份数据目录会包含凭据。

本独立副本从空数据开始，原工作区数据保留原位。不要同时让两个服务操作同一个数据目录。

## 项目结构

- `src/`：应用页面与设置
- `server/`：本地接口、数据存储与模型调用
- `vendor/deeptutor/`：固定版本的书籍引擎源码及许可
- `scripts/`：启动与验证工具
- `tests/`：回归测试
- `docs/`：产品需求、规格与历史记录

## 验证

```sh
npm test
npm run build
npm run doctor
.venv/bin/python tests/book_native.py
```

`node scripts/model-settings-smoke.mjs` 会执行真实模型调用，需配置好 Python 与 Codex，并消耗少量模型额度。历史验收记录见 `docs/历史开发记录.md`；其中旧路径与旧验收日期属于历史说明。

## 上传 GitHub

在 GitHub Desktop 中添加此目录，提交后发布到一个新的私有仓库（例如 `self-study-app`）。原工作区仓库可暂时保留，确认新仓库可用后再自行决定是否归档。

本目录未配置远程仓库，整理过程不会修改已经上传的仓库。

## 许可与来源

保留原工作区 `LICENSE` 和 `NOTICE`。DeepTutor 固定为 v1.6.13，其来源、许可证和第三方声明保存在 `vendor/deeptutor/`。该目录是应用所需引擎，不是混入的其他个人项目。

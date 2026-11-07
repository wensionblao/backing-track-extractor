# 拆声 STEMS · Backing Track Extractor

把一首歌拆成你的舞台。多平台取歌 + UVR MDX 双模型本地分轨，产出「去和声伴奏 / 和声伴奏 / 主唱 / 和声 / 全人声」五条成品轨。

## 它能做什么

- **取歌**：网易云音乐（歌名搜索 / 歌曲链接 / 数字 id）、QQ 音乐（歌名搜索 / songmid / 数字 songid），以及本地上传；搜索结果带专辑封面。
- **分离**：`UVR-MDX-NET-Inst_HQ_3` 先拆出干净伴奏与全人声；`UVR_MDXNET_KARA_2` 再把全人声拆成主唱与和声；最后用 ffmpeg 混合出「和声伴奏」。
- **试听与交付**：五条轨单独波形试听（wavesurfer）、单轨下载、整套 ZIP。
- **轻后端**：FastAPI 单体 + 内存任务队列 + `storage/jobs/<id>/job.json` 落盘，无数据库；24 小时自动清理。
- **全功能免费**：三种方案、五轨下载与 ZIP 不限次数，无账号无支付。
- **双主题界面**：默认日间模式，可一键切换夜间模式，选择本地记忆。

## 界面结构

- **首页**：站点介绍与入口；点击 Logo 或顶部导航回到首页。
- **工作台**：单页两个区块，左右等高 —— 「先找到那首歌」负责搜索 / 链接解析 / 本地上传（搜索结果每页 4 条）；「分轨台」负责音轨勾选、输出格式与任务创建，音轨为常显多选清单，支持全选或只留伴奏。
- **常见问题**：平台可用性、分离质量、产物留存等说明。

交互细节：切换平台或重新搜索会清空上一次的不可用提示；点击需要登录 / VIP 的歌曲时，「需要登录或 VIP 才能获取播放地址」会高亮显示在被点击那首歌的正下方，而不是页面顶部的错误条。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 分离 | [audio-separator](https://github.com/nomadkaraoke/python-audio-separator)（MIT）+ UVR MDX 模型 |
| 后端 | FastAPI / uvicorn / httpx / pydantic-settings，Python 3.12 |
| 音视频 | ffmpeg（imageio-ffmpeg 自带二进制，自动复制到 `storage/bin`） |
| 前端 | Vite + React + TypeScript + wavesurfer.js v7，手写设计系统 |
| 任务 | 内存 `JobStore` + 单 worker 子进程（stdout JSON 事件协议） |
| 进度 | SSE `/api/jobs/{id}/events` |

平台适配层为自研实现（网易云 weapi 加密、QQ musicu vkey），不引入 GPL 或已归档的第三方 API 包。

## 快速开始

需要 Python 3.12+（推荐用 [uv](https://docs.astral.sh/uv/) 管理）与 Node.js 18+：

```bash
# 1) 安装后端依赖（uv 缓存默认放在项目 .uv-cache，避免占用系统盘）
uv sync

# 2) 安装并构建前端
cd web
npm install
npm run build
cd ..

# 3) 启动（默认 http://127.0.0.1:8000）
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

首次分离会自动下载模型到 `storage/models/`（约 66 MB + Karaoke 模型）。如果 GitHub 直连较慢，可手动下载后放进该目录：

```bash
# Windows (PowerShell)
curl.exe -L -o storage\models\UVR-MDX-NET-Inst_HQ_3.onnx https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR-MDX-NET-Inst_HQ_3.onnx
curl.exe -L -o storage\models\UVR_MDXNET_KARA_2.onnx https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR_MDXNET_KARA_2.onnx

# Linux / macOS
curl -L -o storage/models/UVR-MDX-NET-Inst_HQ_3.onnx https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR-MDX-NET-Inst_HQ_3.onnx
curl -L -o storage/models/UVR_MDXNET_KARA_2.onnx https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR_MDXNET_KARA_2.onnx
```

开发模式（前端热更新，后端 8000 端口，Vite 代理 `/api`）：

```bash
# 终端 A
uv run uvicorn app.main:app --reload --port 8000
# 终端 B
cd web && npm run dev
```

## 配置

复制 `.env.example` 为 `.env` 后按需修改。关键项：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `NETEASE_COOKIE` | 空 | 网易云登录 Cookie，可提高版权曲/高音质取链成功率 |
| `QQ_COOKIE` | 空 | QQ 音乐 Cookie，同上 |
| `SEPARATOR_DEVICE` | `auto` | `auto` / `cpu` / `dml` / `cuda` |
| `SEPARATOR_WORKERS` | `1` | 串行队列，CPU 环境不建议调大 |
| `MAX_DURATION_SEC` | `900` | 单曲最长分离时长（秒） |
| `MAX_UPLOAD_MB` | `200` | 上传上限 |
| `JOB_TTL_HOURS` | `24` | 任务产物保留时长 |

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 引擎/ffmpeg/模型/队列状态 |
| GET | `/api/sources` | 平台元信息 |
| GET | `/api/search?source=&q=&limit=` | 平台搜索 |
| POST | `/api/resolve` | 链接/ID 解析，返回可播放性与原因 |
| POST | `/api/uploads` | 本地上传（multipart） |
| GET | `/api/recipes` | 分离方案与预估 |
| POST | `/api/jobs` | 创建任务（track 或 uploadId） |
| GET | `/api/jobs/{id}` | 任务快照 |
| GET | `/api/jobs/{id}/events` | SSE 进度流 |
| GET | `/api/jobs/{id}/files/{stem_id}?download=1` | 单轨试听/下载 |
| GET | `/api/jobs/{id}/zip` | 整套打包 |
| DELETE | `/api/jobs/{id}` | 删除任务目录 |

## 分离流水线

```
原曲 ──► Inst_HQ_3 ──► 伴奏(inst_clean) + 全人声(vocals_all)
                          │
                          └──► KARA_2 ──► 主唱(vocal_lead) + 和声(vocal_harmony)
混音：inst_clean + vocal_harmony ──► 和声伴奏(instrumental_harmony)
```

- `quick`：只跑 1 次推理，输出 `instrumental_clean`
- `karaoke`：跑 2 次推理，输出 5 条成品轨
- `acapella`：跑 2 次推理，输出全人声 / 主唱 / 和声

## 目录

```
app/            FastAPI 后端（api / services / worker）
web/            Vite + React 前端
tests/          pytest（平台链接解析、stem 映射、文件名安全）
storage/        运行时产物（jobs / uploads / models / bin），不入库
```

## 测试与检查

```powershell
uv run pytest -q
uv run ruff check app tests
cd web; npm run build
uv run python -m app.worker.separator_worker --selftest
```

## 已知限制

- 平台曲目依赖官方接口：无 Cookie 时版权曲、付费曲可能拿不到播放地址，界面会明确提示；本地上传始终可用。
- 分离质量取决于 UVR 模型，对强混响、重打击乐或极端编曲的曲目可能残留串音。
- 串行队列 + CPU 推理，长曲（>5 分钟）耗时较长；GPU（CUDA/DML）需自行安装对应 onnxruntime 并在 `.env` 指定设备。
- 全功能免费（v1.1 起）；此前展示型付费墙已移除，无账号体系。
- 请仅处理你拥有合法使用权的音频。

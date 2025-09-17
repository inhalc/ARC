# Backend & Deployment Guide

本说明面向需要自行运行或部署后端的人，普通访问者只需进入 GitHub Pages 页面即可。

## 1. 安装依赖
1. 创建 Python 环境（建议 3.10+）。
2. 安装项目依赖：
   ```bash
   pip install -e .[dev]
   ```
3. 安装 PyTorch（本项目未在 `pyproject.toml` 中锁定，需根据显卡/操作系统自行选择）：
   ```bash
   # 以 CUDA 12.1 为例
   pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
   ```
4. 如需 GPU 加速，确保本地 CUDA 驱动与显卡（4070 Ti）配置正确。

## 2. 后端服务
- 开发模式启动：
  ```bash
  python scripts/run_api.py
  ```
  默认监听 `http://localhost:8000`，并开启自动重载。
- 生产部署推荐使用：
  ```bash
  uvicorn paper_agent.api:app --host 0.0.0.0 --port 8000
  ```
- 可选环境变量：
  - `PAPER_AGENT_DATA_DIR`：缓存目录（默认 `./data`）。
  - `PAPER_AGENT_OPENALEX_MAILTO` / `PAPER_AGENT_ARXIV_EMAIL`：API 建议填写的联系邮箱。
  - `PAPER_AGENT_EMBED_MODEL`：Sentence-Transformer 模型（默认 `BAAI/bge-base-en-v1.5`）。
  - `PAPER_AGENT_SUMMARY_MODEL`：摘要模型（默认 `facebook/bart-large-cnn`）。
  - `PAPER_AGENT_DEVICE`：`auto` / `cpu` / `cuda`。

> 首次运行会从 Hugging Face 下载模型，请预先配置访问加速或换用本地镜像。

## 3. 前端配置
- 修改 `frontend/config.js` 中的 `apiBase` 值，指向你部署的后端地址（生产环境请使用 HTTPS）。
- 推送到 `main` 分支时，`.github/workflows/deploy-pages.yml` 会自动把 `frontend/` 部署至 GitHub Pages。
- 在仓库 `Settings → Pages` 中，将 Source 设为 “GitHub Actions”。

## 4. 数据准备
- 可使用脚本生成离线报告：
  ```bash
  python scripts/generate_report.py "multimodal large language model" --category cs.CL --category cs.AI
  ```
- API 服务在首次调用时会自动抓取数据并缓存。

## 5. 常见问题
- **摘要生成速度慢**：更换到轻量模型（如 `philschmid/bart-large-cnn-samsum`) 或关闭 `summarise` 选项。
- **模型下载失败**：提前从 Hugging Face 手动下载模型放入 `~/.cache/huggingface` 或配置环境变量 `HF_ENDPOINT` 指向加速源。
- **CORS 报错**：确保生产后端允许来自 GitHub Pages 域名的跨域访问（目前默认 `*`）。

完成以上配置后，访问 GitHub Pages 页面即可体验完整的在线检索与导出流程。

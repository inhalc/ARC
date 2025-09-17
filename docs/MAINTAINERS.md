# Backend & Deployment Guide

本文面向需要自行运行或部署后端的同学，普通访问者只需打开 GitHub Pages 页面即可。

## 1. 环境准备
1. 克隆仓库并进入项目根目录。
2. 安装依赖（包含开发工具）：
   `ash
   pip install -e .[dev]
   `
3. 根据显卡与驱动安装匹配版本的 PyTorch（示例为 CUDA 12.1）：
   `ash
   pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
   `
4. 首次运行会从 Hugging Face 下载模型，若在国内网络可提前配置 HF_ENDPOINT 或手动缓存模型。

## 2. 配置一次性的 .env
- 将仓库根目录的 .env.example 复制为 .env，填入自己的邮箱：
  `ash
  copy .env.example .env  # Windows PowerShell
  `
- 编辑 .env，至少设置：
  `
  PAPER_AGENT_OPENALEX_MAILTO=your_email@example.com
  PAPER_AGENT_ARXIV_EMAIL=your_email@example.com
  `
- 后续可在此文件中追加其他可选配置（设备、模型路径等），启动脚本会自动加载，无需每次手动输入。

## 3. 启动后端服务
- 开发模式（含热重载）：
  `ash
  python scripts/run_api.py
  `
  默认监听 http://localhost:8000。
- 生产部署建议使用：
  `ash
  uvicorn paper_agent.api:app --host 0.0.0.0 --port 8000 --workers 2
  `
- 健康检查：浏览器访问 http://localhost:8000/health 应返回 {"status": "ok"}。

## 4. 前端对接
1. 修改 rontend/config.js：
   `js
   // 若使用本地后端保持 localhost，部署到公网时改成实际 API 域名
   const DEFAULT_API = window.location.hostname.endsWith('github.io')
     ? 'https://your-backend.example.com'
     : 'http://localhost:8000';
   `
   （代码中已内置此逻辑，你只需把占位域名替换成真实后端。）
2. 推送到 main 分支后，.github/workflows/deploy-pages.yml 会自动发布 rontend/。
3. 在 GitHub 仓库 Settings → Pages 中将 Source 设为 “GitHub Actions”。

## 5. 数据与报告
- 不启动服务也可直接生成离线报告：
  `ash
  python scripts/generate_report.py "multimodal large language model" --category cs.CL --markdown report.md --csv report.csv
  `
- API 首次查询会自动抓取数据并写入 data/ 缓存，可按需定期清理。

## 6. 常见问题
- **摘要生成偏慢**：切换轻量模型（如 philschmid/bart-large-cnn-samsum），或在前端取消“生成摘要精炼”。
- **模型下载失败**：手动下载模型到 ~/.cache/huggingface，或设置镜像源。
- **跨域错误**：默认允许全部来源，若部署自定义域名请在反向代理中放行。

准备完毕后，访问 GitHub Pages 页面即可体验在线检索、导出与 Why Related / Difference 分析。

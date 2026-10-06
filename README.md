# Chat AI 中文版

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6-646cff.svg)](https://vitejs.dev)
[![GitHub Pages](https://img.shields.io/badge/Deployed-GitHub%20Pages-222.svg)](https://yifenqian1990-wq.github.io/chat-ai-cn/)

一个开箱即用的多模型 AI 聊天客户端：中文界面，支持 Gemini、Ollama、OpenRouter、硅基流动（Qwen）等多种模型渠道，带联网搜索、语音朗读、图片多模态，纯前端运行，API Key 只保存在你自己的浏览器里。

🌐 **在线体验：https://yifenqian1990-wq.github.io/chat-ai-cn/**

> 演示站登录账号：`root` / 密码：`1234`（前端演示用，进入后在设置里填自己的 Key 即可使用）

## ✨ 功能特性

- 💬 **流式对话**：打字机式实时输出，支持 Markdown / 代码高亮渲染
- 🔌 **多模型渠道**：Gemini 原生、Ollama（本地）、OpenRouter、硅基流动 Qwen，还支持自定义 OpenAI 兼容接口
- 🖼️ **多模态**：可上传图片进行识图问答
- 🔍 **联网搜索**：Google Custom / Tavily AI / DuckDuckGo 三种搜索源，可让 AI 基于搜索结果回答
- 🔊 **语音朗读**：AI 回复一键转语音，支持 Google TTS、Edge TTS、Groq、PlayAI
- 🎙️ **实时语音**：Live 语音对话模式
- 📺 **YouTube 模块**：视频内容相关功能
- 🔐 **隐私友好**：纯前端应用，所有 API Key 和聊天记录只存在浏览器 localStorage，不经过任何中间服务器

## 🚀 快速开始（本地运行）

```bash
git clone https://github.com/yifenqian1990-wq/chat-ai-cn.git
cd chat-ai-cn
npm install

# 方式一：纯前端模式（推荐）
npm run build        # 构建
npx vite preview     # 预览，或直接用任意静态服务器托管 dist/

# 方式二：带本地搜索代理（解锁 Brave 搜索）
npm run dev          # 前后端一体，http://localhost:3000
```

> 说明：`npm run dev` 会同时启动 Express 后端（`server.ts`），提供 `/api/search/brave` 搜索代理接口；纯静态托管时 Brave 搜索不可用，可改用 Tavily 或 DuckDuckGo。

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 6 |
| 样式 | Tailwind CSS（CDN） |
| AI SDK | @google/genai、OpenAI 兼容接口 |
| 本地代理（可选） | Express + tsx（仅 Brave 搜索代理用） |
| 部署 | GitHub Pages（自动） |

## 📦 部署

本仓库已配置 GitHub Actions，推送到 `main` 分支后自动构建并发布到 GitHub Pages，无需手动操作。

想部署到自己的账号：Fork 本仓库 → Settings → Pages → Source 选择 `GitHub Actions`，推送即生效。

## ❓ FAQ

**Q: 打开页面提示登录，账号密码是什么？**
A: 演示账号 `root` / `1234`，纯前端校验，进设置页后可自行使用。

**Q: 需要我自己的 API Key 吗？**
A: 需要。在页面右上角设置里填入对应渠道的 Key（Gemini / OpenRouter / 硅基流动等），Key 只保存在你的浏览器本地，不会上传。

**Q: 没有 Key 能用吗？**
A: 可以连本地 Ollama（`http://localhost:11434`），或使用 DuckDuckGo 搜索等免 Key 功能。

**Q: Brave 搜索为什么用不了？**
A: Brave 搜索走本地 Express 代理（防 CORS），GitHub Pages 纯静态环境没有后端。可在设置里切换为 Tavily 或 DuckDuckGo，或本地 `npm run dev` 运行。

**Q: 聊天记录会上传吗？**
A: 不会。纯前端应用，记录只存在浏览器 localStorage，任何一方都拿不到。

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证开源。

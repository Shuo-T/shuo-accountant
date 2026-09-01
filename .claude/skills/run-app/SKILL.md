---
name: run-app
description: >
  Use this to start the 朔记 (ShuoAccountant) dev server or Tauri desktop app.
  Triggers when the user says "启动", "run app", "开发模式", "tauri dev",
  "npm run dev", "npm run tauri dev", or similar phrases about running the app.
type: lifecycle
---

# 朔记 — 启动应用

项目位于 `heima-accountant/`，基于 Tauri 2 + React + Vite。

## 启动 Web 开发模式

```bash
cd d:/AI Study/VSCode/HeiMaStudy/heima-accountant
npm run dev
```

应用启动在 `http://localhost:1420`，支持热更新。

## 启动 Tauri 桌面应用

```bash
cd d:/AI Study/VSCode/HeiMaStudy/heima-accountant
npm run tauri dev
```

桌面应用窗口启动后会加载本地开发服务器（端口 1420）。

## 注意事项

- 首次运行前请确保依赖已安装：`npm install`
- 如果 Tauri 相关命令找不到，确认 `@tauri-apps/cli` 已在 devDependencies 中
- Web 模式和 Tauri 模式可以并行运行，不会互相冲突
- 停止服务时直接按 `Ctrl+C` 中断进程即可

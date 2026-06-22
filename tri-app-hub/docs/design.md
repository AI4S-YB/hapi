# 三方互跳转方案 — 设计文档

> 日期：2026-06-15 · 状态：原型验证

## 目标

在 HAPI、Obsidian 知识库、GitLab 三者之间实现一键互跳转。每个应用全屏独立工作，顶部统一导航条切换。

## 架构

```
统一导航条 (shared-nav.js/css)
    │
    ├── HAPI (127.0.0.1:3006)   ← Caddy 反向代理注入导航
    ├── Obsidian Web (127.0.0.1:8686) ← Node.js 服务，渲染 Vault Markdown
    └── GitLab (your-gitlab.example.com:8929)  ← README 链接 + 书签栏
```

## 组件

| 组件 | 端口 | 技术 | 说明 |
|------|:--:|------|------|
| obsidian-web-server | 8686 | Node.js + Express + marked | 读 Vault .md → 渲染 HTML + 导航条 |
| Caddy 反向代理 | 3006 | Caddy | 在 HAPI 页面注入导航 JS/CSS |
| shared-nav | — | JS + CSS | 统一导航组件，一份代码三处引用 |

## Obsidian Web Server

- `GET /` → 目录浏览
- `GET /note?path=...` → Markdown 渲染
- `GET /assets/nav.js` → 导航组件（HAPI 注入引用此文件）
- 底部显示 `📝 在 Obsidian 中编辑` 链接（obsidian:// URI）

## 导航跳转逻辑

| 从 \ 到 | HAPI | Obsidian Web | GitLab |
|------|:--:|:--:|:--:|
| HAPI | — | http://127.0.0.1:8686 | http://your-gitlab.example.com:8929 |
| Obsidian Web | http://127.0.0.1:3006 | — | http://your-gitlab.example.com:8929 |
| GitLab | README 链接 | README 链接 | — |

## 不做什么

- ❌ 不建 GitLab/GitHub 仓库（纯本地原型）
- ❌ 不用 iframe
- ❌ 不修改 HAPI 二进制
- ❌ 不修改 GitLab 源码
- ❌ Obsidian Web 只读，不编辑

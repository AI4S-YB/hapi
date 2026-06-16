# HAPI + Obsidian + GitLab 统一工作台 — 设计方案

> 状态：设计阶段 | 日期：2026-06-16 | 项目：AI Interface

---

## 一、背景

### 当前状态

三个应用各自独立，通过顶部导航条实现页面间跳转：

```
┌──────────────────────────────────────────────────────────┐
│  🚀 HAPI  │  📝 知识库  │  📦 GitLab     ← 顶部导航条    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│         当前应用全屏内容（无上下文关联）                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 核心问题

导航条只解决了"跳转"，没解决"上下文断裂"：

- 在 HAPI 聊水稻育种方案 → 跳到 GitLab → 要手动搜索相关 Issue
- 在 GitLab 看到测试数据 Issue → 想查知识库里的历史测试 → 要手动打开 Obsidian
- 三个工具之间没有信息流通，用户心智负担重

### 目标

**三者不再是三个独立入口，而是一个统一工作台。** 用户在 HAPI 里处理任务时，相关的知识库内容、GitLab Issue 会自动关联过来，AI 能主动跨库查询并汇总。

---

## 二、核心能力（三层融合）

### 第一层：AI 主动关联（MCP Bridge）

AI 具备跨库查询能力，用户一句话，AI 自动查所有数据源：

```
用户：海口模型选型进展如何？

AI 自动执行：
  ① MCP: GitLab → 搜索 "海口 模型" Issue → 找到 !6
  ② MCP: Obsidian → 搜索 "海口 DS V4 Flash 性能" → 找到测试笔记
  ③ 汇总回答：当前进度、关键数据、待决策事项
```

### 第二层：上下文侧边栏（Context Panel）

HAPI 对话时，右侧面板实时显示关联内容：

```
┌──────────────────────────────┬──────────────────┐
│                              │  📋 相关           │
│   HAPI 对话区                │                  │
│                              │  !6 海口测试方案   │
│   用户：海口模型选型怎么样？   │  🟡 待审核        │
│                              │                  │
│   AI：已查到以下信息...       │  📄 性能测试数据   │
│   - !6 方案待你审核           │  0615-2026       │
│   - 上次测试 DS V4 Flash     │                  │
│     在并发128下吞吐最好       │  🔗 查看全部      │
│                              │                  │
└──────────────────────────────┴──────────────────┘
```

### 第三层：统一搜索（Unified Search）

一个搜索框，同时搜三个来源：

```
┌──────────────────────────────────────────┐
│  🔍 DS V4 Flash              [搜索]     │
├──────────────────────────────────────────┤
│  📄 知识库                               │
│  · 海口DS V4 Flash性能测试-20260615      │
│  · 模型选型对比分析                       │
│  📦 GitLab                               │
│  · !6 海口机房模型上线前测试方案          │
│  · !3 DS V4 Flash 接 New-API 测试        │
└──────────────────────────────────────────┘
```

---

## 三、技术架构

### 组件

```
                         ┌─────────────────────┐
                         │   Unified Search API │  (Node.js, 对外提供搜索接口)
                         │   :8687              │
                         └──────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │ GitLab Fetcher  │  │ Obsidian Index  │  │ HAPI History    │
    │ (API: 182.92..) │  │ (Vault .md)     │  │ (待设计)        │
    └─────────────────┘  └─────────────────┘  └─────────────────┘
              │                     │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   MCP Servers       │  (Claude Code 可直接调用)
              │                     │
              │  GitLab MCP:        │
              │  · search_issues    │
              │  · get_issue        │
              │  · list_mrs         │
              │                     │
              │  Obsidian MCP:      │
              │  · search_vault     │
              │  · read_note        │
              │  · list_directory   │
              └─────────────────────┘
```

### 技术选型

| 组件 | 技术 | 说明 |
|------|------|------|
| Unified Search API | Node.js + Express + SQLite FTS5 | 跨库搜索接口 |
| GitLab MCP Server | Node.js + GitLab API | 封装 GitLab Issue/MR/Project 查询 |
| Obsidian MCP Server | 复用已有 Obsidian Web Server | 增加搜索 API 端点 |
| Context Panel | 前端 JS 注入到 HAPI | 通过已有的 hapi-proxy 注入侧边栏组件 |

---

## 四、实施路线

### Phase 1：MCP 桥接（让 AI 能跨库查询）

| # | 任务 | 说明 |
|:--:|------|------|
| P1.1 | GitLab MCP Server | 封装 Issue 搜索、详情、MR 列表 |
| P1.2 | Obsidian MCP Server | 封装 Vault 搜索、笔记读取 |
| P1.3 | 集成测试 | AI 对话中实际调用两个 MCP |

### Phase 2：统一搜索 API

| # | 任务 | 说明 |
|:--:|------|------|
| P2.1 | Unified Search API | 合并 GitLab + Obsidian 搜索结果 |
| P2.2 | FTS5 索引 | 对 Obsidian Vault 建全文索引 |
| P2.3 | 搜索接口 | `GET /search?q=DS+V4+Flash` |

### Phase 3：上下文侧边栏

| # | 任务 | 说明 |
|:--:|------|------|
| P3.1 | Context Panel 组件 | JS/CSS 右侧面板 |
| P3.2 | HAPI Proxy 注入 | hapi-proxy 注入侧边栏 |
| P3.3 | 关键词提取 | 从对话中提取关键词 → 调用统一搜索 |

---

## 五、已有资产

| 资产 | 位置 | 用途 |
|------|------|------|
| tri-app-hub (导航条) | `~/Desktop/projects/tri-app-hub/` | 可复用的 proxy + nav 组件 |
| Obsidian Web Server | tri-app-hub/obsidian-web-server/ | 已有目录浏览 + Markdown 渲染，加搜索即可 |
| HAPI Proxy | tri-app-hub/caddy/hapi-proxy.js | 已有 HTML 注入能力 |
| GitLab Proxy | tri-app-hub/caddy/gitlab-proxy.js | 已有 GitLab 代理 + URL 改写 |

---

## 六、设计原则

- **HAPI 是主战场** — AI 对话是核心交互方式，侧边栏和搜索是辅助
- **不改源码** — HAPI/GitLab/Obsidian 的源码不碰，通过代理 + MCP 扩展
- **渐进式** — MCP 先通 → 搜索后补 → 侧边栏最后
- **不破坏现有** — hapi.moilab.net 的访问不受影响

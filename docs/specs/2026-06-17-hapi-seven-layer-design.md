# HAPI 七层融合工作台 — 设计方案

> 状态：设计完成 → 进入实现计划 | 日期：2026-06-17 | 项目：AI Interface

---

## 一、设计原则

1. **Claude Code 是引擎，HAPI 是呈现层** — 底层能力走 CLI/文件系统，HAPI 只做 UI 呈现
2. **最小侵入** — HAPI 聊天区完全不改，一切通过 proxy 注入实现
3. **轻量优先** — 先实现功能，不过度架构。本质是"给 Claude Code + HAPI 套个壳"

## 二、七层数据模型

| # | 层 | 管什么 | 底层实现 | HAPI 呈现 | 状态 |
|:--:|-----|------|------|------|:--:|
| 1 | 📦 GitLab | 项目/任务/代码 | glab CLI | Context Panel + gitlab-proxy | ✅ 已通 |
| 2 | 📄 知识库 | Obsidian MD 笔记 | 文件系统读写 | obsidian-web-server + Context Panel | ✅ 已通 |
| 3 | 💻 算力 | 机器/GPU/资源 | Obsidian MD + SSH 探测 | Context Panel 资源卡片 | 🟡 设计 |
| 4 | 📊 数据 | FastScale 元数据 | fan-files (Rust + tantivy) | 繁Files 按钮 + Context Panel | 🔴 待对接 |
| 5 | 🔮 文献 | 论文/引用 | Semantic Scholar API | 未来 Skill | 🟣 未来 |
| 6 | 🧩 Skills | Claude Code 能力 | fan-skill 生态 | Skills 管理面板 | ✅ 已有 |
| 7 | ⏰ 定时任务 | 周期/一次性任务 | Claude Code Cron | 定时任务面板 | ✅ 已有 |

## 三、界面布局

```
┌──────────────────────────────────────────────────────────┐
│  🔍 Unified Search    HAPI | 知识库 | GitLab | 算力 | ⚙ │  ← Nav (proxy 注入)
├────────┬──────────────────────────┬───────────────────────┤
│        │                          │  [📋关联|🧩Skill|⏰定时] │
│ 📁     │                          │                       │
│ Session│   HAPI 聊天区 (不改)      │  当前 Tab 内容         │
│ 列表   │                          │  - Context Panel      │
│        │                          │  - Skills 管理        │
│ + 新建 │                          │  - Cron 任务          │
│        │                          │                       │
├────────┴──────────────────────────┴───────────────────────┤
│  📎上传 📁浏览 💻Terminal 📊繁Files  [输入框]        ⌘⏎  │  ← Input (不改)
└──────────────────────────────────────────────────────────┘
```

### 注入方式

通过增强 `hapi-proxy.js`，在 `</head>` 前注入：

```
nav.js + nav.css      已有：导航条
search.js             新增：⌘K 统一搜索弹窗
context-panel.js      新增：右侧 Context Panel (含三 Tab)
panel.css             新增：面板样式
```

HAPI 自身 React 代码一行不改。

## 四、核心交互

### 4.1 统一搜索 (⌘K)

- 搜索框在导航栏中央
- 输入关键词 → 同时查询 Obsidian (全文索引) + GitLab (glab search)
- 结果分来源展示：知识库 + GitLab Issues + MRs
- 未来扩展：算力机器名、繁Files 文件路径、文献标题

### 4.2 Context Panel (📋 Tab)

- 根据当前 Session 绑定的项目自动关联
- 拉取四层数据：GitLab Issues、知识库笔记、算力资源、数据文件
- 点击卡片 → 跳转到对应页面 (GitLab Issue / Obsidian 笔记)

### 4.3 Skills 管理 (🧩 Tab)

- 列表显示已安装的 Claude Code Skills
- 启用/禁用开关
- fan-skill 市场集成 (来自 fan-marketplace)

### 4.4 定时任务 (⏰ Tab)

- 显示所有 Cron 任务 (活跃 / 暂停 / 一次性)
- 下次执行时间
- 最近执行日志
- 新建/编辑/暂停/删除

## 五、已有资产

| 资产 | 位置 | 用途 |
|------|------|------|
| HAPI | `127.0.0.1:3006` | AI 对话主界面 |
| hapi-proxy.js | `tri-app-hub/caddy/` | HTML 注入 (已有 nav bar) |
| gitlab-proxy.js | `tri-app-hub/caddy/` | GitLab URL 改写 + nav |
| obsidian-web-server | `tri-app-hub/obsidian-web-server/` | 目录浏览 + MD 渲染 |
| shared-nav | `tri-app-hub/shared-nav/` | nav.js + nav.css |
| fan-files | `AI4S-yb/fan-files` (Rust) | 文件索引守护进程 |
| fan-skill | `AI4S-yb/fan-skill` | Claude Code 技能系统 |
| fan-marketplace | `AI4S-yb/fan-marketplace` | 插件市场 |

## 六、不做的事

- ❌ 不改 HAPI 源码
- ❌ 不造 Git 操作的 MCP 中间层 (glab CLI 已覆盖)
- ❌ 不造统一 Git Provider 抽象层 (先 GitLab，GitHub 按需加)
- ❌ 不造文献管理系统 (未来以 Skill 形式轻量接入)
- ❌ 不造繁Files 替代品 (已有 fan-files，对接即可)

# HAPI Shell 面板重设计 — 方案 B (VS Code 风格)

> 状态：设计阶段 | 日期：2026-06-18

## 问题

- ⌘K 搜索弹窗和 Context Panel 内搜索割裂
- Context Tab 的"搜索"实际是 Session 名，用户误以为是搜索框
- Skills/Cron 与关联内容平级排列，认知混乱

## 方案：VS Code 侧边栏风格

搜索框固定在面板顶部。不同 Tab 下搜索框有不同上下文。

### 面板结构

```
┌─────────────────────────┐
│ 🔍 搜索框（固定顶部）      │  ← 始终可见
├─────────────────────────┤
│ 过滤 Tabs（搜索时出现）    │  ← 全部 | GitLab | 知识库
├─────────────────────────┤
│ 内容区                    │
│ · 未搜索+关联Tab：自动显示  │
│   当前Session的Issue/笔记  │
│ · 搜索时：显示搜索结果     │
│ · Skills Tab：Skills列表  │
│ · 定时 Tab：Cron列表      │
├─────────────────────────┤
│ [📋 关联] [🧩 Skills] [⏰ 定时] │  ← 底部模式切换
└─────────────────────────┘
```

### 三个状态

1. **选中 Session + 关联 Tab** → 自动用 Session 名搜 GitLab + Obsidian → 显示关联 Issue/笔记
2. **输入搜索词** → 过滤 Tabs 出现（全部/GitLab/知识库）→ 实时结果
3. **切到 Skills/定时 Tab** → 搜索框变成该 Tab 的筛选器 → 独立内容

### 改动范围

- `ContextPanel.tsx` — 重写，新面板结构
- `SearchModal.tsx` — 删除
- `router.tsx` — 移除 SearchModal 引用 + ⌘K handler
- Hub API — 不动（`/shell/search` 已满足需求）

### 不变的东西

- Session 列表 + 聊天区完全不动
- `/shell/setup/detect`, `/shell/search`, `/shell/cron` API 不动
- Skills/Cron 的实时检测逻辑不动

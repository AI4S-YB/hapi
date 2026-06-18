# 右侧内容区 — 三种视图统一

> 状态：设计完成 | 日期：2026-06-19

## 交互模型

左侧 Tab 选什么，右侧显示相应内容。一个 Outlet，三种视图。

| 左侧点击 | 右侧显示 |
|---------|---------|
| Session | 聊天窗口 (SessionChat，现有) |
| Issue | Issue 详情 (标题/描述/评论/状态) |
| 笔记 | 笔记内容 (Markdown 渲染) |

每个非 Session 视图底部两个按钮：`💬 讨论...` + `↗ 外部打开`

## 实现方案

**不动现有路由。** 在 SessionsPage 加两个 state：

```ts
const [selectedIssue, setSelectedIssue] = useState<{iid: string; repo: string} | null>(null)
const [selectedNote, setSelectedNote] = useState<{path: string} | null>(null)
```

右侧 `<Outlet />` 之前加条件判断：优先渲染选中的 Issue/Note，否则走正常路由。

## 新增 Hub 端点

- `GET /shell/issue?repo=team-wiki/projects/haikou-compute&iid=6` → Issue 详情 JSON
- `GET /shell/note?path=A1-研究项目/海口算力/DS-V4.md` → Note 内容 (Markdown)

## 新增前端组件

- `IssueView.tsx` — Issue 详情卡片（header + body + comments + 操作按钮）
- `NoteView.tsx` — 笔记内容（header + rendered MD + 操作按钮）
- 修改 `SidebarTabs.tsx` — IssuesPanel / NotesPanel 点击时回调父组件
- 修改 `router.tsx` — 条件渲染逻辑

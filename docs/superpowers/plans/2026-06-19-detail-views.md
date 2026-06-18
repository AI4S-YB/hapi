# Detail Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 左侧点 Issue/笔记 → 右侧显示详情。三种视图（Session/Issue/笔记）统一交互模式。

**Architecture:** SessionsPage 加两个 state（selectedIssue/selectedNote），右侧 Outlet 前条件渲染。Hub 加 `/shell/issue` 和 `/shell/note` 两个端点。

**Tech Stack:** React + TypeScript + Tailwind + Hono + glab CLI

---

### Task 1: Hub 端点 — `/shell/issue` + `/shell/note`

**Files:**
- Modify: `hapi-source/hub/src/web/routes/search.ts`

在 search.ts 末尾加两个新路由：

- [ ] **Step 1: 添加 Issue 详情端点**

```typescript
// GET /shell/issue?repo=...&iid=...
app.get('/shell/issue', async (c) => {
  const repo = c.req.query('repo') || ''
  const iid = c.req.query('iid') || ''
  if (!repo || !iid) {
    return c.json({ error: 'Missing repo or iid' }, 400)
  }
  try {
    const glab = spawnSync('glab', ['issue', 'view', iid, '--repo', repo], { timeout: 8000 })
    if (glab.status !== 0 || !glab.stdout) {
      return c.json({ error: 'Issue not found' }, 404)
    }
    const raw = new TextDecoder().decode(glab.stdout)

    // Parse glab output: key-value pairs + description after --
    const lines = raw.split('\n')
    const meta: Record<string, string> = {}
    let descStart = lines.length
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '--') { descStart = i; break }
      const m = lines[i].match(/^(\w[\w\s]*?):\s*(.+)/)
      if (m) meta[m[1].trim().toLowerCase()] = m[2].trim()
    }
    const description = lines.slice(descStart + 1).join('\n').trim()

    return c.json({
      iid,
      repo,
      title: meta.title || '',
      state: meta.state || '',
      author: meta.author || '',
      labels: meta.labels || '',
      comments: meta.comments || '0',
      description
    })
  } catch {
    return c.json({ error: 'Failed to fetch issue' }, 500)
  }
})
```

- [ ] **Step 2: 添加 Note 内容端点**

```typescript
// GET /shell/note?path=...
app.get('/shell/note', async (c) => {
  const notePath = c.req.query('path') || ''
  if (!notePath) return c.json({ error: 'Missing path' }, 400)

  const fullPath = `${OBSIDIAN_VAULT}/${notePath}`
  if (!fullPath.startsWith(OBSIDIAN_VAULT)) {
    return c.json({ error: 'Path traversal denied' }, 403)
  }

  try {
    const content = readFileSync(fullPath, 'utf8')
    const stat = fs.statSync(fullPath)
    return c.json({
      path: notePath,
      title: notePath.split('/').pop()?.replace('.md', '') || '',
      content,
      modifiedAt: stat.mtime.toISOString()
    })
  } catch {
    return c.json({ error: 'Note not found' }, 404)
  }
})
```

顶部加 import:
```typescript
import { existsSync, readFileSync, statSync } from 'node:fs'
```

- [ ] **Step 3: 验证端点**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface/hapi-source/hub
bun run typecheck 2>&1 | tail -3
```
Expected: No errors.

重启 hub 后测试:
```bash
curl "http://127.0.0.1:3007/shell/issue?repo=team-wiki/projects/haikou-compute&iid=6" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('title','FAIL'))"
curl "http://127.0.0.1:3007/shell/note?path=C3-代码工程/fanfile开发/01-test-report-complete.md" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('title','FAIL'), len(d.get('content','')))"
```

- [ ] **Step 4: Commit**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface
git add hapi-source/hub/src/web/routes/search.ts
git commit -m "feat: add /shell/issue and /shell/note endpoints"
```

---

### Task 2: IssueView.tsx 组件

**Files:**
- Create: `hapi-source/web/src/components/IssueView.tsx`

Issue 详情卡片 — header (标题/状态/仓库) + body (描述) + comments + 底部操作按钮。

- [ ] **Step 1: 编写 IssueView.tsx**

```typescript
import { useState, useEffect } from 'react'

interface IssueData {
  iid: string
  repo: string
  title: string
  state: string
  author: string
  labels: string
  comments: string
  description: string
}

export function IssueView(props: {
  repo: string
  iid: string
  onDiscuss?: () => void
  onBack?: () => void
}) {
  const [issue, setIssue] = useState<IssueData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/shell/issue?repo=${encodeURIComponent(props.repo)}&iid=${encodeURIComponent(props.iid)}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json() })
      .then(d => { if (d.error) throw new Error(d.error); setIssue(d) })
      .catch(err => setError(err.message))
  }, [props.repo, props.iid])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center text-sm text-red-500">{error}</div>
      </div>
    )
  }

  if (!issue) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-sm text-[var(--app-hint)]">加载中...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--app-border)] px-4 py-3">
        <div className="mb-1 flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold
            ${issue.state === 'open' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--app-border)] text-[var(--app-hint)]'}`}>
            {`!${issue.iid} · ${issue.state}`}
          </span>
          <span className="text-[10px] text-[var(--app-hint)]">{issue.repo}</span>
        </div>
        <h2 className="text-sm font-semibold text-[var(--app-fg)]">{issue.title}</h2>
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-[var(--app-hint)]">
          <span>作者: {issue.author}</span>
          <span>💬 {issue.comments} 评论</span>
          {issue.labels && <span className="rounded bg-[var(--app-subtle-bg)] px-1 py-0.5">{issue.labels}</span>}
        </div>
      </div>

      {/* Body */}
      <div className="app-scroll-y flex-1 min-h-0 px-4 py-3">
        <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--app-fg)]">
          {issue.description || '(无描述)'}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 border-t border-[var(--app-border)] px-4 py-2.5 flex gap-2">
        {props.onDiscuss && (
          <button onClick={props.onDiscuss}
            className="flex-1 rounded-md bg-[var(--app-link)] px-4 py-1.5 text-[11px] font-medium text-white
                       transition-opacity hover:opacity-90">
            讨论这个 Issue
          </button>
        )}
        <a href={`http://${window.location.hostname}:8080`} target="_blank" rel="noopener noreferrer"
          className="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-[11px] text-[var(--app-hint)]
                     no-underline transition-colors hover:bg-[var(--app-subtle-bg)]">
          GitLab ↗
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证编译**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface/hapi-source/web && bun run typecheck 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

---

### Task 3: NoteView.tsx 组件

**Files:**
- Create: `hapi-source/web/src/components/NoteView.tsx`

- [ ] **Step 1: 编写 NoteView.tsx**

```typescript
import { useState, useEffect } from 'react'

interface NoteData {
  path: string
  title: string
  content: string
  modifiedAt: string
}

export function NoteView(props: {
  notePath: string
  onDiscuss?: () => void
  onBack?: () => void
}) {
  const [note, setNote] = useState<NoteData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/shell/note?path=${encodeURIComponent(props.notePath)}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json() })
      .then(d => { if (d.error) throw new Error(d.error); setNote(d) })
      .catch(err => setError(err.message))
  }, [props.notePath])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center text-sm text-red-500">{error}</div>
      </div>
    )
  }

  if (!note) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-sm text-[var(--app-hint)]">加载中...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--app-border)] px-4 py-3">
        <div className="mb-1 flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-[var(--app-hint)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="text-[10px] text-[var(--app-hint)]">{note.path}</span>
        </div>
        <h2 className="text-sm font-semibold text-[var(--app-fg)]">{note.title}</h2>
        <div className="mt-1 text-[10px] text-[var(--app-hint)]">
          {new Date(note.modifiedAt).toLocaleDateString('zh-CN')}
        </div>
      </div>

      {/* Body */}
      <div className="app-scroll-y flex-1 min-h-0 px-4 py-3">
        <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--app-fg)]">
          {note.content}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 border-t border-[var(--app-border)] px-4 py-2.5 flex gap-2">
        {props.onDiscuss && (
          <button onClick={props.onDiscuss}
            className="flex-1 rounded-md bg-[var(--app-link)] px-4 py-1.5 text-[11px] font-medium text-white
                       transition-opacity hover:opacity-90">
            讨论这篇笔记
          </button>
        )}
        <a
          href={`http://${window.location.hostname}:8686/note?path=${encodeURIComponent(note.path)}`}
          target="_blank" rel="noopener noreferrer"
          className="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-[11px] text-[var(--app-hint)]
                     no-underline transition-colors hover:bg-[var(--app-subtle-bg)]">
          Obsidian ↗
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证编译** → `bun run typecheck`

- [ ] **Step 3: Commit**

---

### Task 4: SidebarTabs — 点击回调

**Files:**
- Modify: `hapi-source/web/src/components/SidebarTabs.tsx`

- [ ] **Step 1: IssuesPanel 加 `onSelect` prop**

修改 IssuesPanel 签名，加回调:

```typescript
export function IssuesPanel(props: {
  onSelect?: (iid: string, repo: string) => void
}) {
```

修改每行 Issue，点击时回调:
```tsx
<a
  key={i}
  onClick={(e) => {
    e.preventDefault()
    props.onSelect?.(item.iid || '', item.subtitle || '')
  }}
  className="...cursor-pointer..."
>
```

同样修改 NotesPanel:
```typescript
export function NotesPanel(props: {
  onSelect?: (path: string) => void
}) {
```
```tsx
<a
  key={i}
  onClick={(e) => {
    e.preventDefault()
    props.onSelect?.(item.path || '')
  }}
  className="...cursor-pointer..."
>
```

- [ ] **Step 2: router.tsx 传递 onSelect 回调**

在 SessionsPage 中，IssuesPanel 和 NotesPanel 传入 onSelect:
```tsx
{activeTab === 'issues' && (
  <IssuesPanel onSelect={(iid, repo) => setSelectedIssue({ iid, repo })} />
)}
{activeTab === 'notes' && (
  <NotesPanel onSelect={(path) => setSelectedNote({ path })} />
)}
```

- [ ] **Step 3: 验证编译** → `bun run typecheck`

- [ ] **Step 4: Commit**

---

### Task 5: router.tsx — 条件渲染 + 状态管理

**Files:**
- Modify: `hapi-source/web/src/router.tsx`

- [ ] **Step 1: 添加 state 和 import**

```tsx
import { IssueView } from '@/components/IssueView'
import { NoteView } from '@/components/NoteView'

// In SessionsPage, add state:
const [selectedIssue, setSelectedIssue] = useState<{iid: string; repo: string} | null>(null)
const [selectedNote, setSelectedNote] = useState<{path: string} | null>(null)

// Clear issue/note selection when switching to sessions tab
// Add to existing activeTab handling:
useEffect(() => {
  if (activeTab === 'sessions') {
    setSelectedIssue(null)
    setSelectedNote(null)
  }
}, [activeTab])
```

- [ ] **Step 2: 右侧面板条件渲染**

在 `<Outlet />` 之前加:
```tsx
{selectedIssue ? (
  <IssueView
    repo={selectedIssue.repo}
    iid={selectedIssue.iid}
    onDiscuss={() => {
      // Navigate to new session with issue context
      navigate({ to: '/sessions/new', search: {} })
    }}
    onBack={() => setSelectedIssue(null)}
  />
) : selectedNote ? (
  <NoteView
    notePath={selectedNote.path}
    onDiscuss={() => {
      navigate({ to: '/sessions/new', search: {} })
    }}
    onBack={() => setSelectedNote(null)}
  />
) : (
  <div className={`${isSessionsIndex ? 'hidden lg:flex' : 'flex'} min-w-0 flex-1 flex-col bg-[var(--app-bg)]`}>
    <div className="flex-1 min-h-0">
      <Outlet />
    </div>
  </div>
)}
```

- [ ] **Step 3: 验证编译** → `bun run typecheck`

- [ ] **Step 4: Commit**

---

### Task 6: 构建 + 部署 + 验证

- [ ] **Step 1: 构建前端 + hub**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface/hapi-source/web && bun run build 2>&1 | tail -3
cd /Users/kentnf/Desktop/projects/ai-interface/hapi-source/hub && bun run generate:embedded-web-assets 2>&1 | tail -2
```

- [ ] **Step 2: 重启并验证**

```bash
lsof -ti:3007 | xargs kill -9 2>/dev/null; sleep 1
cd /Users/kentnf/Desktop/projects/ai-interface/hapi-source/hub
HAPI_LISTEN_PORT=3007 bun run dev > /tmp/hapi-fork-hub.log 2>&1 &
sleep 4
# Test endpoints
curl -s "http://127.0.0.1:3007/shell/issue?repo=team-wiki/projects/haikou-compute&iid=6" | python3 -c "import sys,json; print(json.load(sys.stdin)['title'])"
curl -s "http://127.0.0.1:3007/shell/note?path=C3-代码工程/fanfile开发/01-test-report-complete.md" | python3 -c "import sys,json; print(json.load(sys.stdin)['title'])"
```

- [ ] **Step 3: 浏览器验证**

1. 打开 Issues Tab → 看到 Issue 列表 → 点击一个 → 右侧显示详情
2. 打开 Notes Tab → 看到笔记列表 → 点击一个 → 右侧显示内容
3. 点击 "讨论..." 按钮 → 创建新 Session
4. 点击 Sessions Tab → 左侧回到 Session 列表，右侧回到聊天

- [ ] **Step 4: Push**

---

## 实现总结

| # | Task | 文件 |
|:--:|------|------|
| 1 | Hub 端点 `/shell/issue` + `/shell/note` | search.ts 改 |
| 2 | IssueView.tsx | 新 |
| 3 | NoteView.tsx | 新 |
| 4 | SidebarTabs 加回调 | SidebarTabs.tsx 改 |
| 5 | router.tsx 条件渲染 | router.tsx 改 |
| 6 | 构建 + 部署 + 验证 | — |

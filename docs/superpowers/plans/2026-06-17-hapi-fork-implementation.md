# HAPI Fork — 七层融合工作台实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork HAPI 源码，在其 React 前端中直接添加右侧 Context Panel + ⌘K 搜索 + 搜索 API，实现"一个 `bun run dev` 跑起来"的单进程融合工作台。

**Architecture:** 直接修改 HAPI 的 React 前端（`web/src/`）+ Hub 后端（`hub/src/web/routes/`）。三栏布局：左侧 Session 列表（已有）→ 中间聊天区（已有）→ 右侧 Context Panel（新增）。搜索弹窗为独立组件，⌘K 触发。后端新增 `/api/search` 路由。

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind CSS + TanStack Router + Hono (hub) + Bun

**协议:** AGPL-3.0（继承自 HAPI）

---

## 文件结构

```
hapi-source/                                    ← Fork 自 github.com/tiann/hapi
├── web/src/
│   ├── components/
│   │   ├── ContextPanel.tsx                    [新建] 右侧面板 (三 Tab)
│   │   └── SearchModal.tsx                     [新建] ⌘K 搜索弹窗
│   └── router.tsx                              [修改] SessionsPage 改为三栏布局
├── hub/src/web/routes/
│   └── search.ts                               [新建] /api/search 后端路由
└── hub/src/web/server.ts                       [修改] 注册 search 路由
```

---

### Task 1: 验证开发环境

**Files:** 无修改。验证 hapi-source 可编译运行。

- [ ] **Step 1: 安装依赖**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface/hapi-source
which bun || echo "Bun not found — need to install"
bun install 2>&1 | tail -5
```

如果 bun 未安装:
```bash
curl -fsSL https://bun.sh/install | bash
```

- [ ] **Step 2: 验证 web 前端可编译**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface/hapi-source/web
bun run build 2>&1 | tail -10
```
Expected: Build succeeds, outputs in `web/dist/`.

- [ ] **Step 3: 验证 dev 模式可启动**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface/hapi-source
# 只启动 web 前端 dev server (不依赖 hub)
cd web && timeout 10 bun run dev 2>&1 || true
```
Expected: Vite dev server starts on a local port.

- [ ] **Step 4: Commit checkpoint**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface
git add hapi-source/ && git commit -m "chore: import HAPI source code (AGPL-3.0)

Forked from github.com/tiann/hapi

via HAPI

Co-Authored-By: HAPI <noreply@hapi.run>"
```

---

### Task 2: 创建 ContextPanel 组件

**Files:**
- Create: `hapi-source/web/src/components/ContextPanel.tsx`

**What:** React 组件，右侧面板，三 Tab（📋 关联 / 🧩 Skills / ⏰ 定时）。v1 使用 hardcoded demo 数据，遵循 HAPI 现有设计系统。

- [ ] **Step 1: 编写 ContextPanel.tsx**

```typescript
import { useState } from 'react'

type TabName = 'context' | 'skills' | 'cron'

export function ContextPanel(props: {
  isOpen: boolean
  onToggle: () => void
}) {
  const [activeTab, setActiveTab] = useState<TabName>('context')

  return (
    <>
      {/* Toggle button — always visible */}
      <button
        type="button"
        onClick={props.onToggle}
        className="fixed right-2 top-10 z-50 flex h-7 w-7 items-center justify-center
                   rounded-md border border-[var(--app-border)] bg-[var(--app-bg)]
                   text-[var(--app-fg)] shadow-sm transition-all hover:bg-[var(--app-secondary-bg)]"
        style={{
          right: props.isOpen ? '292px' : '8px',
          transition: 'right 0.2s ease'
        }}
        title={props.isOpen ? '关闭面板 (ESC)' : '打开面板'}
      >
        {props.isOpen ? '▶' : '◀'}
      </button>

      {/* Panel */}
      <div
        className="flex h-full min-h-0 flex-col border-l border-[var(--app-border)]
                   bg-[var(--app-bg)] transition-all duration-200"
        style={{
          width: props.isOpen ? '280px' : '0px',
          overflow: props.isOpen ? 'visible' : 'hidden',
          flexShrink: 0
        }}
      >
        {props.isOpen && (
          <>
            {/* Tabs */}
            <div className="flex shrink-0 border-b border-[var(--app-border)]">
              {([
                ['context', '📋 关联'],
                ['skills', '🧩 Skills'],
                ['cron', '⏰ 定时']
              ] as [TabName, string][]).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-3 py-2 text-xs transition-colors
                    ${activeTab === tab
                      ? 'border-b-2 border-[var(--app-link)] text-[var(--app-link)]'
                      : 'text-[var(--app-hint)] hover:text-[var(--app-fg)]'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="app-scroll-y flex-1 min-h-0 p-3">
              {activeTab === 'context' && <ContextTab />}
              {activeTab === 'skills' && <SkillsTab />}
              {activeTab === 'cron' && <CronTab />}
            </div>
          </>
        )}
      </div>
    </>
  )
}

function SectionTitle(props: { children: string }) {
  return (
    <div className="mb-1.5 text-[9px] uppercase tracking-wider text-[var(--app-hint)]">
      {props.children}
    </div>
  )
}

function Card(props: { title: string; subtitle?: string; status?: 'active' | 'paused'; borderColor?: string }) {
  return (
    <div
      className="mb-1 rounded-md bg-[var(--app-subtle-bg)] px-2.5 py-2 text-xs"
      style={props.borderColor ? { borderLeft: `3px solid ${props.borderColor}` } : undefined}
    >
      <div className="font-medium text-[var(--app-fg)]">{props.title}</div>
      {props.subtitle && (
        <div className="mt-0.5 text-[11px] text-[var(--app-hint)]">{props.subtitle}</div>
      )}
      {props.status && (
        <span
          className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px]
            ${props.status === 'active'
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-amber-500/10 text-amber-500'
            }`}
        >
          {props.status === 'active' ? '🟢 活跃' : '🟡 暂停'}
        </span>
      )}
    </div>
  )
}

// --- Context Tab ---
function ContextTab() {
  return (
    <>
      <SectionTitle>📦 GitLab · 当前项目</SectionTitle>
      <Card title="!6 海口测试方案" status="paused" borderColor="#fd971f" />
      <Card title="!3 DS V4 Flash 测试" status="active" borderColor="#a6e22e" />

      <div className="mt-3">
        <SectionTitle>📄 知识库</SectionTitle>
        <Card title="DS V4 Flash 性能测试" subtitle="2026-06-15 · 海口" />
        <Card title="模型选型对比分析" subtitle="2026-06-10" />
      </div>

      <div className="mt-3">
        <SectionTitle>💻 算力</SectionTitle>
        <div className="mb-1 rounded-md bg-[var(--app-subtle-bg)] px-2.5 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-[var(--app-fg)]">海口 A100×8</span>
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-500">空闲</span>
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--app-hint)]">8×A100 80G · 1.2T RAM</div>
        </div>
        <Card title="macmini (本地)" subtitle="M4 Pro · 64G RAM" status="active" />
      </div>

      <div className="mt-3">
        <SectionTitle>📊 数据 · 繁Files</SectionTitle>
        <Card title="/data/models/" subtitle="3 safetensors · 15.3 GB" />
        <div className="mt-1 text-center text-[10px] text-[var(--app-hint)]">
          最近扫描: 2026-06-17 09:30
        </div>
      </div>
    </>
  )
}

// --- Skills Tab ---
function SkillsTab() {
  const skills = [
    { name: 'brainstorming', desc: '设计讨论', enabled: true },
    { name: 'debugging', desc: '系统调试', enabled: true },
    { name: 'issue', desc: 'Issue 管理', enabled: true },
    { name: 'code-review', desc: '代码审查', enabled: false },
    { name: '文献搜索 (WIP)', desc: '自定义 Skill', enabled: true }
  ]

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--app-fg)]">已安装 Skills</span>
        <span className="cursor-pointer rounded bg-[var(--app-link)]/10 px-1.5 py-0.5 text-[10px] text-[var(--app-link)]">
          + 安装
        </span>
      </div>

      {skills.map((s) => (
        <div
          key={s.name}
          className="mb-0.5 flex items-center justify-between rounded-md bg-[var(--app-subtle-bg)] px-2.5 py-2 text-xs"
        >
          <div>
            <div className="text-[var(--app-fg)]">{s.name}</div>
            <div className="text-[11px] text-[var(--app-hint)]">{s.desc}</div>
          </div>
          <button
            type="button"
            className={`h-[18px] w-8 rounded-full transition-colors relative
              ${s.enabled ? 'bg-[var(--app-link)]' : 'bg-[var(--app-border)]'}`}
          >
            <span
              className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all
                ${s.enabled ? 'left-4' : 'left-0.5'}`}
            />
          </button>
        </div>
      ))}

      <div className="mt-3 border-t border-[var(--app-border)] pt-2">
        <div className="mb-1.5 text-[10px] text-[var(--app-hint)]">fan-skill 市场</div>
        <Card title="📦 bioinfo-lackey" subtitle="生信辅助 · ⬇ 1.2k" />
        <Card title="📦 scAgent-skill" subtitle="单细胞分析 · ⬇ 856" />
      </div>
    </>
  )
}

// --- Cron Tab ---
function CronTab() {
  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--app-fg)]">定时任务</span>
        <span className="cursor-pointer rounded bg-[var(--app-link)]/10 px-1.5 py-0.5 text-[10px] text-[var(--app-link)]">
          + 新建
        </span>
      </div>

      <div className="mb-2 rounded-md bg-[var(--app-subtle-bg)] px-2.5 py-2 text-xs"
        style={{ borderLeft: '3px solid #a6e22e' }}>
        <div className="flex items-center justify-between">
          <span className="font-medium text-[var(--app-fg)]">每日进展汇总</span>
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-500">活跃</span>
        </div>
        <div className="mt-0.5 text-[11px] text-[var(--app-hint)]">每天 18:00 · 汇总 GitLab Issue</div>
        <div className="text-[10px] text-[var(--app-hint)]">下次: 2026-06-17 18:00</div>
      </div>

      <div className="mb-2 rounded-md bg-[var(--app-subtle-bg)] px-2.5 py-2 text-xs"
        style={{ borderLeft: '3px solid #a6e22e' }}>
        <div className="flex items-center justify-between">
          <span className="font-medium text-[var(--app-fg)]">FastScale 周扫描</span>
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-500">活跃</span>
        </div>
        <div className="mt-0.5 text-[11px] text-[var(--app-hint)]">每周一 09:00 · 扫描 A100 → fan-files</div>
        <div className="text-[10px] text-[var(--app-hint)]">下次: 2026-06-22 09:00</div>
      </div>

      <div className="mb-2 rounded-md bg-[var(--app-subtle-bg)] px-2.5 py-2 text-xs"
        style={{ borderLeft: '3px solid #fd971f' }}>
        <div className="flex items-center justify-between">
          <span className="font-medium text-[var(--app-fg)]">GPU 状态心跳</span>
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-500">暂停</span>
        </div>
        <div className="mt-0.5 text-[11px] text-[var(--app-hint)]">每 30min · 检查 GPU 在线状态</div>
      </div>

      <div className="mt-3 border-t border-[var(--app-border)] pt-2">
        <div className="mb-1.5 text-[10px] text-[var(--app-hint)]">执行日志</div>
        <div className="border-b border-[var(--app-border)] py-0.5 text-[10px] text-emerald-500">
          ✓ 06-17 09:00 FastScale 扫描 · 846 文件 · 54s
        </div>
        <div className="border-b border-[var(--app-border)] py-0.5 text-[10px] text-emerald-500">
          ✓ 06-16 18:00 每日汇总 · 3 issues 更新
        </div>
        <div className="py-0.5 text-[10px] text-red-500">
          ✗ 06-16 09:30 GPU 心跳 · 超时
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface/hapi-source/web
bun run typecheck 2>&1 | tail -5
```
Expected: No new type errors from ContextPanel.tsx.

- [ ] **Step 3: Commit**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface
git add hapi-source/web/src/components/ContextPanel.tsx
git commit -m "feat: add ContextPanel component with 3 tabs (context/skills/cron)

Hardcoded demo data for v1. Follows HAPI design system.

via HAPI

Co-Authored-By: HAPI <noreply@hapi.run>"
```

---

### Task 3: 创建 SearchModal 组件

**Files:**
- Create: `hapi-source/web/src/components/SearchModal.tsx`

**What:** ⌘K 搜索弹窗，React 组件。用 `useEffect` 监听键盘事件。v1 使用 hardcoded demo 搜索结果。

- [ ] **Step 1: 编写 SearchModal.tsx**

```typescript
import { useState, useEffect, useRef, useCallback } from 'react'

interface SearchResult {
  source: 'obsidian' | 'gitlab'
  title: string
  subtitle: string
  url: string
}

export function SearchModal(props: {
  isOpen: boolean
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (props.isOpen && inputRef.current) {
      inputRef.current.focus()
      setQuery('')
      setResults([])
      setActiveIdx(-1)
    }
  }, [props.isOpen])

  // ⌘K global toggle
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (props.isOpen) {
          props.onClose()
        } else {
          // onClose is also used as onOpen via parent state
          props.onClose()
        }
      }
      if (e.key === 'Escape' && props.isOpen) {
        props.onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [props.isOpen, props.onClose])

  // Mock search — v1 demo
  const doSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }

    // Hardcoded demo results
    const demo: SearchResult[] = [
      { source: 'gitlab', title: '!6 海口测试方案', subtitle: 'team-wiki/haikou-compute · 🟡 待审核', url: '' },
      { source: 'gitlab', title: '!3 DS V4 Flash 测试', subtitle: 'team-wiki/qatask · 🟢 进行中', url: '' },
      { source: 'obsidian', title: 'DS V4 Flash 性能测试', subtitle: 'A1-研究项目/海口算力/ · 2026-06-15', url: '' },
      { source: 'obsidian', title: '模型选型对比分析', subtitle: 'C1-领域知识/模型评测/ · 2026-06-10', url: '' }
    ].filter(r =>
      r.title.toLowerCase().includes(q.toLowerCase()) ||
      r.subtitle.toLowerCase().includes(q.toLowerCase())
    )

    setResults(demo)
    setActiveIdx(-1)
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 200)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, results.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter' && activeIdx >= 0 && results[activeIdx]) {
      // In v2: navigate to result URL
      props.onClose()
    }
  }

  if (!props.isOpen) return null

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={props.onClose}
      />

      {/* Modal */}
      <div className="absolute left-1/2 top-[15%] w-[560px] max-w-[90vw] -translate-x-1/2
                      overflow-hidden rounded-xl bg-[var(--app-bg)] shadow-2xl
                      border border-[var(--app-border)]">
        {/* Input */}
        <div className="flex items-center gap-2 border-b border-[var(--app-border)] px-4 py-3">
          <span className="text-base shrink-0">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索知识库 + GitLab..."
            className="flex-1 bg-transparent text-sm text-[var(--app-fg)] outline-none
                       placeholder:text-[var(--app-hint)]"
          />
          <span className="rounded border border-[var(--app-border)] px-1.5 py-0.5
                          text-[10px] text-[var(--app-hint)]">
            ESC
          </span>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {query && results.length === 0 && (
            <div className="py-8 text-center text-sm text-[var(--app-hint)]">
              未找到相关结果
            </div>
          )}
          {results.length > 0 && (
            <>
              {/* GitLab section */}
              {results.filter(r => r.source === 'gitlab').length > 0 && (
                <div className="mb-2">
                  <div className="mb-1 px-2 text-[10px] uppercase tracking-wider text-[var(--app-hint)]">
                    📦 GitLab
                  </div>
                  {results.filter(r => r.source === 'gitlab').map((r, i) => {
                    const idx = results.indexOf(r)
                    return (
                      <div
                        key={r.title}
                        className={`cursor-pointer rounded-md px-3 py-2 text-sm
                          ${idx === activeIdx ? 'bg-[var(--app-secondary-bg)]' : 'hover:bg-[var(--app-subtle-bg)]'}`}
                        onClick={() => props.onClose()}
                      >
                        <div className="font-medium text-[var(--app-fg)]">{r.title}</div>
                        <div className="mt-0.5 text-xs text-[var(--app-hint)]">{r.subtitle}</div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Obsidian section */}
              {results.filter(r => r.source === 'obsidian').length > 0 && (
                <div>
                  <div className="mb-1 px-2 text-[10px] uppercase tracking-wider text-[var(--app-hint)]">
                    📄 知识库
                  </div>
                  {results.filter(r => r.source === 'obsidian').map((r, i) => {
                    const idx = results.indexOf(r)
                    return (
                      <div
                        key={r.title}
                        className={`cursor-pointer rounded-md px-3 py-2 text-sm
                          ${idx === activeIdx ? 'bg-[var(--app-secondary-bg)]' : 'hover:bg-[var(--app-subtle-bg)]'}`}
                        onClick={() => props.onClose()}
                      >
                        <div className="font-medium text-[var(--app-fg)]">{r.title}</div>
                        <div className="mt-0.5 text-xs text-[var(--app-hint)]">{r.subtitle}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface/hapi-source/web
bun run typecheck 2>&1 | tail -5
```
Expected: No new type errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface
git add hapi-source/web/src/components/SearchModal.tsx
git commit -m "feat: add SearchModal component with ⌘K toggle (hardcoded v1)

via HAPI

Co-Authored-By: HAPI <noreply@hapi.run>"
```

---

### Task 4: 修改 SessionsPage 布局 — 集成 ContextPanel + SearchModal

**Files:**
- Modify: `hapi-source/web/src/router.tsx`

**What:** 在 `SessionsPage` 组件中添加 `useState` 管理面板和搜索状态，在布局右侧插入 `ContextPanel`，顶部添加 `SearchModal`。

- [ ] **Step 1: 在 router.tsx 顶部添加 import**

在现有 import 语句之后添加:

```typescript
import { ContextPanel } from '@/components/ContextPanel'
import { SearchModal } from '@/components/SearchModal'
```

在 `SessionsPage` 函数内部，在现有 state 声明之后（`const [isDuplicateMergeConfirmOpen, ...]` 附近），添加面板和搜索状态:

```typescript
const [isPanelOpen, setIsPanelOpen] = useState(false)
const [isSearchOpen, setIsSearchOpen] = useState(false)
```

- [ ] **Step 2: 修改 JSX return — 添加 SearchModal**

在 `SessionsPage` 的 return JSX 中，在 `<CodexSessionSyncDialog .../>` 之前，添加:

```typescript
<SearchModal
  isOpen={isSearchOpen}
  onClose={() => setIsSearchOpen(false)}
/>
```

**需要修改 ⌘K 逻辑**：SearchModal 内部已有 ⌘K toggle，但需要额外的入口。修改 `useEffect` 在 `SessionsPage` 中：

在 `SessionsPage` 函数内添加:

```typescript
// ⌘K toggle for search modal
useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setIsSearchOpen(prev => !prev)
    }
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}, [])
```

**注意**: 需要从 react 中引入 `useEffect`（已在文件顶部导入）。

- [ ] **Step 3: 修改 JSX — 三栏布局**

当前 SessionsPage 的 return 布局是两栏（`<div className="flex h-full min-h-0">` + 左侧 session 列表 + 分隔条 + 右侧 Outlet）。

需要改为在右侧 Outlet 之后再添加 ContextPanel。

找到 return JSX 中 `</div>{/* Close flex container */}` 的位置（第 545 行附近），在 `<Outlet />` 的 `</div>` 之后、外层的 flex container `</div>` 之前，添加 ContextPanel:

定位到这段代码（约在 540-545 行）：
```typescript
<div className={`${isSessionsIndex ? 'hidden lg:flex' : 'flex'} min-w-0 flex-1 flex-col bg-[var(--app-bg)]`}>
    <div className="flex-1 min-h-0">
        <Outlet />
    </div>
</div>
```

在它之后、外层的 `</div>` (flex container 关闭标签) 之前，添加：

```typescript
<ContextPanel
  isOpen={isPanelOpen}
  onToggle={() => setIsPanelOpen(prev => !prev)}
/>
```

**完整的三栏布局结构变为：**
```typescript
<div className="flex h-full min-h-0">
  {/* Column 1: Session list (existing) */}
  <div className={`${isSessionsIndex ? 'flex' : 'hidden lg:flex'} w-full shrink-0 ...`}>
    ...session list content...
  </div>

  {/* Resize handle (existing) */}
  <div className="sidebar-resize-handle ..." />

  {/* Column 2: Chat area (existing) */}
  <div className={`${isSessionsIndex ? 'hidden lg:flex' : 'flex'} min-w-0 flex-1 ...`}>
    <div className="flex-1 min-h-0"><Outlet /></div>
  </div>

  {/* Column 3: Context Panel (NEW) */}
  <ContextPanel
    isOpen={isPanelOpen}
    onToggle={() => setIsPanelOpen(prev => !prev)}
  />

  {/* Dialogs (existing) */}
  <CodexSessionSyncDialog ... />
  <ConfirmDialog ... />
</div>
```

- [ ] **Step 4: 验证 TypeScript 编译通过**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface/hapi-source/web
bun run typecheck 2>&1 | tail -10
```
Expected: No type errors.

- [ ] **Step 5: 启动 dev 模式验证**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface/hapi-source
# Start both hub + web in dev mode
bun run dev 2>&1 &
sleep 5
# Check web is running
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/
```
Expected: 200. Open in browser to verify three-column layout.

- [ ] **Step 6: Commit**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface
git add hapi-source/web/src/router.tsx
git commit -m "feat: integrate ContextPanel + SearchModal into SessionsPage layout

Three-column layout: sessions | chat | context panel.
⌘K triggers search modal.

via HAPI

Co-Authored-By: HAPI <noreply@hapi.run>"
```

---

### Task 5: 添加搜索 API 到 Hub 后端

**Files:**
- Create: `hapi-source/hub/src/web/routes/search.ts`
- Modify: `hapi-source/hub/src/web/server.ts`

**What:** 添加 `GET /api/search?q=...` 到 hub 后端。搜索 Obsidian vault (grep) + GitLab (glab CLI)。

- [ ] **Step 1: 创建 search.ts 路由**

```typescript
import { Hono } from 'hono'
import { spawnSync } from 'child_process'
import { os } from 'bun'

const OBSIDIAN_VAULT = `${os.homedir()}/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault`

interface SearchResults {
  obsidian: Array<{ path: string; title: string }>
  gitlab: Array<{ iid: string; title: string }>
}

export function createSearchRoutes(): Hono {
  const app = new Hono()

  app.get('/api/search', async (c) => {
    const q = c.req.query('q') || ''
    const results: SearchResults = { obsidian: [], gitlab: [] }

    if (!q) {
      return c.json(results)
    }

    // Search Obsidian vault
    try {
      const grep = spawnSync('grep', [
        '-rli', q, OBSIDIAN_VAULT,
        '--include=*.md'
      ], { timeout: 5000 })
      if (grep.stdout) {
        const lines = new TextDecoder().decode(grep.stdout).trim().split('\n').filter(Boolean)
        results.obsidian = lines.slice(0, 10).map((p: string) => {
          const rel = p.replace(OBSIDIAN_VAULT + '/', '')
          return { path: rel, title: rel.replace('.md', '').split('/').pop() || rel }
        })
      }
    } catch {
      // grep not found or timeout
    }

    // Search GitLab via glab
    try {
      const glab = spawnSync('glab', [
        'search', 'issues', q,
        '--search-scope=all',
        '--per-page=5'
      ], { timeout: 8000 })
      if (glab.stdout) {
        const lines = new TextDecoder().decode(glab.stdout).trim().split('\n').filter(Boolean)
        results.gitlab = lines
          .filter((l: string) => /^\d+/.test(l))
          .map((l: string) => {
            const parts = l.split(/\s+/)
            return { iid: parts[0], title: parts.slice(1).join(' ') }
          })
      }
    } catch {
      // glab not found or error
    }

    return c.json(results)
  })

  return app
}
```

- [ ] **Step 2: 在 server.ts 中注册路由**

找到 `hapi-source/hub/src/web/server.ts`，在现有路由注册代码附近添加:

```typescript
import { createSearchRoutes } from './routes/search'

// ... existing code ...

// Register search routes
app.route('/', createSearchRoutes())
```

具体插入位置：找到其他 `app.route(...)` 或 `app.get(...)` 注册的地方，在它们附近添加。

- [ ] **Step 3: 验证搜索 API 工作**

```bash
# 启动 hub dev
cd /Users/kentnf/Desktop/projects/ai-interface/hapi-source
bun run dev:hub 2>&1 &
sleep 3
# Test search endpoint
curl -s "http://localhost:3006/api/search?q=test" | python3 -m json.tool | head -20
```
Expected: JSON with `obsidian` and `gitlab` arrays.

- [ ] **Step 4: Commit**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface
git add hapi-source/hub/src/web/routes/search.ts hapi-source/hub/src/web/server.ts
git commit -m "feat: add /api/search route to hub (grep vault + glab)

via HAPI

Co-Authored-By: HAPI <noreply@hapi.run>"
```

---

### Task 6: 端到端验证

**Files:** 无新建文件。

- [ ] **Step 1: 完整启动**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface/hapi-source
bun run dev 2>&1 &
sleep 8
# Verify
curl -s -o /dev/null -w "Web: %{http_code}\n" http://localhost:5173/
curl -s -o /dev/null -w "Hub: %{http_code}\n" http://localhost:3006/api/search?q=test
```

- [ ] **Step 2: 浏览器手动验证清单**

打开 `http://localhost:5173`：

1. ✅ 左侧 Session 列表正常显示
2. ✅ 中间聊天区正常渲染
3. ✅ 右侧面板切换按钮可见（◀/▶）
4. ✅ 点击按钮 → 面板滑出 → 三个 Tab (📋关联/🧩Skills/⏰定时) 可切换
5. ✅ 再次点击按钮 → 面板收起
6. ✅ ⌘K → 搜索弹窗出现 → 输入关键词 → demo 结果展示
7. ✅ ESC → 搜索弹窗关闭
8. ✅ 左侧 Session 列表功能正常（新建/浏览/设置）

- [ ] **Step 3: 提交最终验证结果并 push**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface
git add -A
git commit -m "verify: end-to-end test passed — three-column layout + ⌘K search

All 6 tasks complete. HAPI fork with Context Panel + Search.

via HAPI

Co-Authored-By: HAPI <noreply@hapi.run>"
git push origin main
```

---

## 实现路线总结

| # | Task | 文件 | 类型 |
|:--:|------|------|:--:|
| 1 | 验证开发环境 | — | 设置 |
| 2 | ContextPanel 组件 | `web/src/components/ContextPanel.tsx` | 新建 |
| 3 | SearchModal 组件 | `web/src/components/SearchModal.tsx` | 新建 |
| 4 | SessionsPage 三栏布局 | `web/src/router.tsx` | 修改 |
| 5 | Hub 搜索 API | `hub/src/web/routes/search.ts` + `server.ts` | 新建+修改 |
| 6 | 端到端验证 | — | 测试 |

**完成后**: `bun run dev` 一个命令启动完整融合工作台。三栏布局（Session + Chat + Context Panel），⌘K 搜索，Tab 面板。不再有 proxy 注入——一切都是原生 React 组件。

**v1 限制**：Context Panel 和 Search 使用 hardcoded demo 数据。v2 迭代接入实时 GitLab API + Obsidian 全文索引 + Skills 文件系统读取 + Cron 任务 JSON 文件读取。

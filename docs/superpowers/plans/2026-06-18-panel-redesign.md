# Panel Redesign — 方案 B 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重写 ContextPanel 为 VS Code 侧边栏风格 — 顶部固定搜索框 + 过滤 tabs + 底部模式 tabs。删除 SearchModal 弹窗。

**Architecture:** 单文件重写 ContextPanel.tsx，复用现有的 `/shell/search`、`/shell/setup/detect`、`/shell/cron` API。router.tsx 清理 SearchModal + ⌘K handler。后端不动。

**Tech Stack:** React 18 + TypeScript + Tailwind CSS (HAPI 现有栈)

---

### Task 1: 删除 SearchModal + 清理 router.tsx

**Files:**
- Delete: `hapi-source/web/src/components/SearchModal.tsx`
- Modify: `hapi-source/web/src/router.tsx`

- [ ] **Step 1: 删除 SearchModal.tsx**

```bash
rm /Users/kentnf/Desktop/projects/ai-interface/hapi-source/web/src/components/SearchModal.tsx
```

- [ ] **Step 2: 从 router.tsx 移除 SearchModal import**

找到并删除:
```typescript
import { SearchModal } from '@/components/SearchModal'
```

- [ ] **Step 3: 移除 router.tsx 中的 SearchModal JSX**

找到并删除:
```typescript
            <SearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
            />
```

- [ ] **Step 4: 移除 isSearchOpen state + ⌘K handler**

删除:
```typescript
    const [isSearchOpen, setIsSearchOpen] = useState(false)
```

删除整个 ⌘K useEffect block:
```typescript
    // ⌘K toggle for search modal (skip when user is typing in inputs)
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                const tag = (e.target as HTMLElement)?.tagName
                if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
                    return
                }
                e.preventDefault()
                setIsSearchOpen(prev => !prev)
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])
```

- [ ] **Step 5: 验证编译**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface/hapi-source/web && bun run typecheck 2>&1 | tail -3
```
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface
git add hapi-source/web/src/components/SearchModal.tsx hapi-source/web/src/router.tsx
git commit -m "refactor: remove SearchModal + ⌘K handler — prepare for panel search"
```

---

### Task 2: 重写 ContextPanel.tsx

**Files:**
- Modify: `hapi-source/web/src/components/ContextPanel.tsx`

**What:** 完全重写。新结构：
- 顶部：固定搜索框（始终可见）
- 中部：过滤 tabs（搜索时出现）或内容区
- 底部：模式 tabs（📋 关联 / 🧩 Skills / ⏰ 定时）

- [ ] **Step 1: 编写完整的 ContextPanel.tsx**

```typescript
import { useState, useEffect, useCallback } from 'react'

// --- Types ---

type TabName = 'context' | 'skills' | 'cron'
type FilterTab = 'all' | 'gitlab' | 'obsidian'

interface SearchItem {
  source: 'obsidian' | 'gitlab'
  title: string
  subtitle: string
}

interface LiveData {
  obsidian: { found: boolean; vaults: Array<{ name: string; path: string }> }
  github: { found: boolean; user?: string; error?: string }
  gitlab: { found: boolean; user?: string; error?: string }
  machines: Array<{ host: string; hasKey: boolean; hasConfig: boolean }>
  skills: Array<{ name: string }>
}

interface CronData {
  platform: string
  tasks: Array<{ source: string; id: string; label: string; schedule: string; command: string; enabled: boolean }>
  sources: Record<string, { found: boolean; count?: number; available: boolean }>
}

interface PanelProps {
  isOpen: boolean
  projectHint?: string
}

// --- Main Component ---

export function ContextPanel(props: PanelProps) {
  const [activeTab, setActiveTab] = useState<TabName>('context')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchItem[]>([])
  const [searching, setSearching] = useState(false)
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [liveData, setLiveData] = useState<LiveData | null>(null)
  const [cronData, setCronData] = useState<CronData | null>(null)

  // Live detection on panel open
  useEffect(() => {
    if (!props.isOpen) return
    fetch('/shell/setup/detect')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => setLiveData(d))
      .catch(() => {})
  }, [props.isOpen])

  // Auto-search when context tab + session selected
  useEffect(() => {
    if (activeTab !== 'context' || !props.isOpen) return
    const hint = props.projectHint
    if (!hint && !query) return
    const q = query || hint || ''
    if (!q) { setResults([]); return }
    doSearch(q)
  }, [activeTab, props.projectHint, props.isOpen])

  // Debounced search on query change
  useEffect(() => {
    if (activeTab !== 'context' || !query) return
    const timer = setTimeout(() => doSearch(query), 250)
    return () => clearTimeout(timer)
  }, [query])

  const doSearch = useCallback((q: string) => {
    setSearching(true)
    fetch(`/shell/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => {
        const items: SearchItem[] = [
          ...(d.obsidian || []).map((r: { path: string; title: string }) => ({
            source: 'obsidian' as const, title: r.title, subtitle: r.path
          })),
          ...(d.gitlab || []).map((r: { iid: string; title: string }) => ({
            source: 'gitlab' as const, title: `!${r.iid} ${r.title}`, subtitle: r.title
          }))
        ]
        setResults(items.slice(0, 10))
      })
      .catch(() => {})
      .finally(() => setSearching(false))
  }, [])

  // Cron data
  useEffect(() => {
    if (activeTab !== 'cron' || !props.isOpen) return
    fetch('/shell/cron')
      .then(r => r.json()).then(d => setCronData(d)).catch(() => {})
  }, [activeTab, props.isOpen])

  // Clear search when switching tabs
  useEffect(() => {
    setQuery('')
    setResults([])
    setFilterTab('all')
  }, [activeTab])

  if (!props.isOpen) return null

  const filteredResults = filterTab === 'all'
    ? results
    : results.filter(r => r.source === filterTab)

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-[var(--app-border)] bg-[var(--app-bg)]"
      style={{ width: '280px', flexShrink: 0 }}>
      
      {/* Search bar — fixed top */}
      <div className="shrink-0 border-b border-[var(--app-border)] px-2.5 py-2">
        <div className="flex items-center gap-1.5 rounded-md border bg-[var(--app-subtle-bg)] px-2 py-1.5
          ${query ? 'border-[var(--app-link)]' : 'border-[var(--app-border)]'}">
          <span className="shrink-0 text-xs text-[var(--app-hint)]">🔍</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={activeTab === 'context' ? '搜索 GitLab + 知识库...' : '筛选...'}
            className="flex-1 bg-transparent text-xs text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)]"
          />
          {query && (
            <button onClick={() => setQuery('')} className="shrink-0 text-[10px] text-[var(--app-hint)] hover:text-[var(--app-fg)]">✕</button>
          )}
        </div>
      </div>

      {/* Filter tabs — only when searching */}
      {activeTab === 'context' && query && (
        <div className="flex shrink-0 border-b border-[var(--app-border)] px-2">
          {([
            ['all', '全部'],
            ['gitlab', 'GitLab'],
            ['obsidian', '知识库']
          ] as [FilterTab, string][]).map(([k, v]) => (
            <button key={k} type="button" onClick={() => setFilterTab(k)}
              className={`px-2.5 py-1.5 text-[10px] border-b-2 transition-colors
                ${filterTab === k ? 'border-[var(--app-link)] text-[var(--app-link)]' : 'border-transparent text-[var(--app-hint)] hover:text-[var(--app-fg)]'}`}>
              {v}
            </button>
          ))}
        </div>
      )}

      {/* Content area */}
      <div className="app-scroll-y flex-1 min-h-0 px-2.5 py-2">
        {activeTab === 'context' && (
          <>
            {searching && <div className="py-6 text-center text-[10px] text-[var(--app-hint)]">搜索中...</div>}
            {!searching && (
              <>
                {!query && !props.projectHint && (
                  <div className="py-8 text-center text-[10px] text-[var(--app-hint)]">
                    选择一个 Session 后自动显示关联内容
                  </div>
                )}
                {!query && props.projectHint && results.length === 0 && (
                  <div className="py-4 text-center text-[10px] text-[var(--app-hint)]">
                    未找到与 "{props.projectHint}" 相关的内容
                  </div>
                )}
                {results.length > 0 && (
                  <>
                    {/* GitLab section */}
                    {filteredResults.filter(r => r.source === 'gitlab').length > 0 && (
                      <div className="mb-2">
                        <div className="mb-1 text-[9px] uppercase tracking-wider text-[var(--app-hint)]">
                          仓库 ({filteredResults.filter(r => r.source === 'gitlab').length})
                        </div>
                        {filteredResults.filter(r => r.source === 'gitlab').map((r, i) => (
                          <div key={i} className="mb-0.5 rounded-md bg-[var(--app-subtle-bg)] px-2 py-1.5 text-xs border-l-[3px] border-l-[var(--app-link)]">
                            <div className="text-[var(--app-fg)] truncate font-medium">{r.title}</div>
                            <div className="mt-0.5 text-[10px] text-[var(--app-hint)] truncate">{r.subtitle}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Obsidian section */}
                    {filteredResults.filter(r => r.source === 'obsidian').length > 0 && (
                      <div>
                        <div className="mb-1 text-[9px] uppercase tracking-wider text-[var(--app-hint)]">
                          知识库 ({filteredResults.filter(r => r.source === 'obsidian').length})
                        </div>
                        {filteredResults.filter(r => r.source === 'obsidian').map((r, i) => (
                          <div key={i} className="mb-0.5 rounded-md bg-[var(--app-subtle-bg)] px-2 py-1.5 text-xs border-l-[3px] border-l-[var(--app-link)]/40">
                            <div className="text-[var(--app-fg)] truncate font-medium">{r.title}</div>
                            <div className="mt-0.5 text-[10px] text-[var(--app-hint)] truncate">{r.subtitle}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {/* Machines — compact footer */}
                {liveData && liveData.machines.length > 0 && (
                  <div className="mt-3 border-t border-[var(--app-border)] pt-2">
                    <div className="mb-1 text-[9px] uppercase tracking-wider text-[var(--app-hint)]">
                      {`机器 (${liveData.machines.length})`}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {liveData.machines.map(m => (
                        <span key={m.host} className={`rounded px-1 py-0.5 text-[10px] ${m.hasKey ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--app-border)] text-[var(--app-hint)]'}`}>
                          {m.host}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'skills' && liveData && (
          <>
            <div className="mb-1 text-[10px] font-semibold text-[var(--app-fg)]">
              {`已安装 (${liveData.skills.length})`}
            </div>
            {liveData.skills.filter(s => !query || s.name.includes(query)).map(s => (
              <div key={s.name} className="mb-0.5 flex items-center justify-between rounded-md bg-[var(--app-subtle-bg)] px-2 py-1.5 text-xs">
                <div className="text-[var(--app-fg)]">{s.name}</div>
                <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-[10px] text-emerald-500">✓</span>
              </div>
            ))}
          </>
        )}

        {activeTab === 'cron' && cronData && (
          <>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[var(--app-fg)]">{`任务 (${cronData.tasks.length})`}</span>
              <span className="text-[9px] text-[var(--app-hint)]">{cronData.platform === 'darwin' ? 'macOS' : 'Linux'}</span>
            </div>
            <div className="mb-1 flex gap-1 text-[9px]">
              <SourceBadge label="CC" found={cronData.sources.claudeCode?.found} available={cronData.sources.claudeCode?.available} />
              <SourceBadge label="launchd" found={cronData.sources.launchd?.found} available={cronData.sources.launchd?.available} />
              <SourceBadge label="cron" found={cronData.sources.crontab?.found} available={cronData.sources.crontab?.available} />
            </div>
            {cronData.tasks.length > 0 ? cronData.tasks.map(t => (
              <div key={t.id} className={`mb-0.5 rounded-md bg-[var(--app-subtle-bg)] px-2 py-1.5 text-xs border-l-[3px] ${t.source === 'claude-code' ? 'border-l-[var(--app-link)]' : t.source === 'launchd' ? 'border-l-amber-500' : 'border-l-emerald-500'}`}>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium text-[var(--app-fg)] truncate">{t.label}</span>
                  <span className="shrink-0 rounded bg-[var(--app-subtle-bg)] px-1 py-0.5 text-[9px] text-[var(--app-hint)]">{t.source}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-[var(--app-hint)]">{t.schedule}</div>
                <div className="mt-0.5 truncate text-[10px] text-[var(--app-hint)]">{t.command}</div>
              </div>
            )) : <div className="py-4 text-center text-[10px] text-[var(--app-hint)]">无定时任务</div>}
          </>
        )}
      </div>

      {/* Bottom mode tabs */}
      <div className="flex shrink-0 border-t border-[var(--app-border)]">
        {([
          ['context', '📋 关联'],
          ['skills', '🧩 Skills'],
          ['cron', '⏰ 定时']
        ] as [TabName, string][]).map(([k, v]) => (
          <button key={k} type="button" onClick={() => setActiveTab(k)}
            className={`flex-1 py-1.5 text-[10px] transition-colors ${activeTab === k ? 'border-t-2 border-[var(--app-link)] -mt-px text-[var(--app-link)]' : 'text-[var(--app-hint)] hover:text-[var(--app-fg)]'}`}>
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}

function SourceBadge(props: { label: string; found?: boolean; available?: boolean }) {
  return (
    <span className={`rounded px-1 py-0.5 ${!props.available ? 'bg-[var(--app-border)]/30 text-[var(--app-hint)]' : props.found ? 'bg-[var(--app-link)]/10 text-[var(--app-link)]' : 'bg-[var(--app-border)] text-[var(--app-hint)]'}`}>
      {!props.available ? `${props.label} (-)` : props.found ? props.label : `${props.label} (0)`}
    </span>
  )
}
```

- [ ] **Step 2: 验证编译**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface/hapi-source/web && bun run typecheck 2>&1 | tail -3
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface
git add hapi-source/web/src/components/ContextPanel.tsx
git commit -m "refactor: rewrite ContextPanel — VS Code sidebar style

- Fixed search bar at top (no ⌘K overlay needed)
- Filter tabs (全部/GitLab/知识库) appear when searching
- Bottom mode tabs (关联/Skills/定时)
- Auto-searches with projectHint when session selected
- Search bar filters skills in Skills tab

via HAPI

Co-Authored-By: HAPI <noreply@hapi.run>"
```

---

### Task 3: 构建 + 部署 + 验证

**Files:** 无新建。

- [ ] **Step 1: 编译前端 + 生成嵌入资源**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface/hapi-source/web && bun run build 2>&1 | tail -3
cd /Users/kentnf/Desktop/projects/ai-interface/hapi-source/hub && bun run generate:embedded-web-assets 2>&1 | tail -2
```

- [ ] **Step 2: 重启 Hub**

```bash
lsof -ti:3007 | xargs kill -9 2>/dev/null
sleep 1
cd /Users/kentnf/Desktop/projects/ai-interface/hapi-source/hub
HAPI_LISTEN_PORT=3007 bun run dev > /tmp/hapi-fork-hub.log 2>&1 &
sleep 4
```

- [ ] **Step 3: 验证**

```bash
curl -s -o /dev/null -w "Hub: %{http_code}\n" http://127.0.0.1:3007/
curl -s "http://127.0.0.1:3007/shell/search?q=test" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Search OK:', len(d.get('obsidian',[])), 'obsidian,', len(d.get('gitlab',[])), 'gitlab')"
```
Expected: Hub 200, Search returns results.

- [ ] **Step 4: 浏览器手动验证**

打开 `http://127.0.0.1:3007/?hub=http://127.0.0.1:3007&token=<token>`

检查:
1. ✅ 点 📋 按钮打开面板
2. ✅ 面板顶部有搜索框
3. ✅ 选一个 Session → 关联 Tab 自动显示搜索结果
4. ✅ 在搜索框输入关键词 → 过滤 tabs 出现 → 结果更新
5. ✅ 切到 Skills Tab → 显示真实 Skills 列表
6. ✅ 切到 定时 Tab → 显示真实 Cron 任务
7. ✅ 搜索框可筛选 Skills

- [ ] **Step 5: Push**

```bash
cd /Users/kentnf/Desktop/projects/ai-interface
git push origin main
```

---

## 实现总结

| # | Task | 改动 |
|:--:|------|------|
| 1 | 删除 SearchModal + 清理 router.tsx | 删 1 文件，改 1 文件 |
| 2 | 重写 ContextPanel.tsx | 改 1 文件 |
| 3 | 构建 + 部署 + 验证 | 无代码改动 |

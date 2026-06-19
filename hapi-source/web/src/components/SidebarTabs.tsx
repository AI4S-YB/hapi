import { useState, useEffect, useMemo } from 'react'

type SidebarTab = 'sessions' | 'issues' | 'notes'

interface IssueItem {
  iid: string
  title: string
  state: string
  repo: string
}

interface NoteItem {
  title: string
  path: string
  isDir: boolean
}

export { type SidebarTab }

export function SidebarTabs(props: {
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
}) {
  const tabs: [SidebarTab, string][] = [
    ['sessions', 'Sessions'],
    ['issues', 'Issues'],
    ['notes', '笔记']
  ]

  return (
    <div className="flex shrink-0 border-b border-[var(--app-border)]">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => props.onTabChange(key)}
          className={`flex-1 py-2 text-[11px] font-medium transition-colors
            ${props.activeTab === key
              ? 'border-b-2 border-[var(--app-link)] text-[var(--app-link)]'
              : 'text-[var(--app-hint)] hover:text-[var(--app-fg)]'
            }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// --- Issues Panel (grouped by project) ---
export function IssuesPanel(props: {
  onSelect?: (iid: string, repo: string) => void
}) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<IssueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [stale, setStale] = useState(false)

  useEffect(() => { loadIssues('') }, [])

  useEffect(() => {
    const timer = setTimeout(() => loadIssues(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  function loadIssues(q: string) {
    setLoading(true)
    fetch(`/shell/issues?q=${encodeURIComponent(q.trim())}`)
      .then(r => r.json())
      .then(d => {
        if (d.issues) {
          setItems(d.issues)
          if (d.cached) {
            setStale(true)
            // Background refresh
            fetch('/shell/issues?force=1')
              .then(r => r.json())
              .then(fresh => { if (fresh.issues) { setItems(fresh.issues); setStale(false) } })
              .catch(() => {})
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  // Group by repo
  const grouped = useMemo(() => {
    const groups: Record<string, IssueItem[]> = {}
    for (const item of items) {
      const short = item.repo.replace('team-wiki/', '').replace('projects/', '')
      if (!groups[short]) groups[short] = []
      groups[short].push(item)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [items])

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="shrink-0 border-b border-[var(--app-border)] px-3 py-2">
        <div className="relative">
          <svg className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--app-hint)]"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="搜索 Issues..."
            className="w-full rounded border border-[var(--app-border)] bg-[var(--app-subtle-bg)] py-1 pl-7 pr-2 text-[11px] text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]"
          />
        </div>
        {stale && (
          <div className="mt-1 text-[9px] text-[var(--app-hint)]">显示缓存中... 正在刷新</div>
        )}
      </div>
      <div className="app-scroll-y flex-1 min-h-0">
        {loading && <div className="px-3 py-8 text-center text-[11px] text-[var(--app-hint)]">加载中...</div>}
        {!loading && items.length === 0 && (
          <div className="px-3 py-8 text-center text-[11px] text-[var(--app-hint)]">
            {query ? '未找到匹配的 Issue' : '未找到 Issue。\n确认 glab 已登录: glab auth login'}
          </div>
        )}
        {!loading && grouped.map(([repo, repoIssues]) => (
          <div key={repo}>
            <div className="sticky top-0 border-b border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-1 text-[10px] font-medium text-[var(--app-hint)]">
              {repo} ({repoIssues.length})
            </div>
            {repoIssues.map((item, i) => (
              <a key={i} href="#" onClick={(e) => { e.preventDefault(); props.onSelect?.(item.iid, item.repo) }}
                className="flex items-center gap-2 border-b border-[var(--app-border)] px-3 py-1.5 transition-colors hover:bg-[var(--app-subtle-bg)] no-underline">
                <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold
                  ${item.state === 'opened' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--app-border)] text-[var(--app-hint)]'}`}>
                  {`!${item.iid}`}
                </span>
                <span className="text-[11px] text-[var(--app-fg)] truncate">{item.title}</span>
              </a>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Notes Panel (tree view) ---
export function NotesPanel(props: {
  onSelect?: (path: string) => void
}) {
  const [items, setItems] = useState<NoteItem[]>([])
  const [cwd, setCwd] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadDir('') }, [])

  function loadDir(path: string) {
    setLoading(true)
    setCwd(path)
    fetch(`/shell/obsidian/tree?path=${encodeURIComponent(path)}`)
      .then(r => r.json())
      .then(d => {
        const all: NoteItem[] = [
          ...(d.dirs || []).map((n: string) => ({ title: n, path: path ? `${path}/${n}` : n, isDir: true })),
          ...(d.files || []).map((n: string) => ({ title: n, path: path ? `${path}/${n}` : n, isDir: false }))
        ]
        setItems(all)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="shrink-0 border-b border-[var(--app-border)] px-3 py-1.5">
        <div className="flex items-center gap-1 text-[10px] text-[var(--app-hint)]">
          <button onClick={() => loadDir('')} className="hover:text-[var(--app-fg)]">知识库</button>
          {cwd.split('/').filter(Boolean).map((part, i, arr) => (
            <span key={i}>
              <span className="mx-0.5">/</span>
              {i === arr.length - 1 ? (
                <span className="text-[var(--app-fg)]">{part}</span>
              ) : (
                <button onClick={() => loadDir(arr.slice(0, i + 1).join('/'))}
                  className="hover:text-[var(--app-fg)]">{part}</button>
              )}
            </span>
          ))}
        </div>
      </div>
      <div className="app-scroll-y flex-1 min-h-0">
        {loading && <div className="px-3 py-8 text-center text-[11px] text-[var(--app-hint)]">加载中...</div>}
        {!loading && items.length === 0 && (
          <div className="px-3 py-8 text-center text-[11px] text-[var(--app-hint)]">空目录</div>
        )}
        {!loading && items.map((item, i) => (
          <a key={i} href="#"
            onClick={(e) => {
              e.preventDefault()
              if (item.isDir) loadDir(item.path)
              else props.onSelect?.(item.path)
            }}
            className="flex items-center gap-2 border-b border-[var(--app-border)] px-3 py-1.5 transition-colors hover:bg-[var(--app-subtle-bg)] no-underline">
            <span className="shrink-0 text-xs">{item.isDir ? '📁' : '📄'}</span>
            <span className={`text-[11px] truncate ${item.isDir ? 'font-medium text-[var(--app-fg)]' : 'text-[var(--app-fg)]'}`}>
              {item.title}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}

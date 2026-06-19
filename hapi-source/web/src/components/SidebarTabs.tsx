import { useState, useEffect, useMemo } from 'react'

type SidebarTab = 'sessions' | 'issues' | 'notes'

interface IssueItem {
  iid: string
  title: string
  state: string
  repo: string
}

interface CommentItem {
  author: string
  body: string
  createdAt: string
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
  onSettings?: () => void
  labels?: { sessions: string; issues: string; notes: string }
}) {
  const lb = props.labels || { sessions: 'Sessions', issues: 'Issues', notes: 'Knowledge' }
  const tabs: [SidebarTab, string][] = [
    ['sessions', lb.sessions],
    ['issues', lb.issues],
    ['notes', lb.notes]
  ]
  return (
    <div className="flex shrink-0 items-center border-b border-[var(--app-border)]">
      {tabs.map(([key, label]) => (
        <button key={key} type="button" onClick={() => props.onTabChange(key)}
          className={`flex-1 py-2 text-[11px] font-medium transition-colors
            ${props.activeTab === key
              ? 'border-b-2 border-[var(--app-link)] text-[var(--app-link)]'
              : 'text-[var(--app-hint)] hover:text-[var(--app-fg)]'}`}>
          {label}
        </button>
      ))}
      {props.onSettings && (
        <button type="button" onClick={props.onSettings}
          className="shrink-0 px-3 py-2 text-[11px] text-[var(--app-hint)] hover:text-[var(--app-fg)] transition-colors border-l border-[var(--app-border)]"
          title="设置">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      )}
    </div>
  )
}

// --- Issues Panel (tree: Project → Issue → 主帖 + 评论) ---
export interface IssueSelect {
  repo: string
  iid: string
  type: 'issue' | 'main' | 'comment'
  comment?: CommentItem
}

export function IssuesPanel(props: {
  onSelect?: (sel: IssueSelect) => void
}) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<IssueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [stale, setStale] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [comments, setComments] = useState<Record<string, CommentItem[]>>({})

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

  function toggleExpand(repo: string, iid: string) {
    const key = `${repo}/${iid}`
    if (expanded.has(key)) {
      setExpanded(prev => { const n = new Set(prev); n.delete(key); return n })
    } else {
      setExpanded(prev => new Set(prev).add(key))
      if (!comments[key]) {
        fetch(`/shell/issue/comments?repo=${encodeURIComponent(repo)}&iid=${encodeURIComponent(iid)}`)
          .then(r => r.json())
          .then(d => { if (d.comments) setComments(prev => ({ ...prev, [key]: d.comments })) })
          .catch(() => {})
      }
    }
  }

  const grouped = useMemo(() => {
    const groups: Record<string, IssueItem[]> = {}
    for (const item of items) {
      const short = item.repo.replace('team-wiki/', '').replace('projects/', '').replace('members/', '')
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
        {stale && <div className="mt-1 text-[9px] text-[var(--app-hint)]">显示缓存中... 正在刷新</div>}
      </div>
      <div className="app-scroll-y flex-1 min-h-0">
        {loading && <div className="px-3 py-8 text-center text-[11px] text-[var(--app-hint)]">加载中...</div>}
        {!loading && grouped.map(([repo, repoIssues]) => (
          <div key={repo}>
            <div className="sticky top-0 border-b border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-1 text-[10px] font-medium text-[var(--app-hint)]">
              {repo} ({repoIssues.length})
            </div>
            {repoIssues.map((item) => {
              const key = `${item.repo}/${item.iid}`
              const isExpanded = expanded.has(key)
              const threadComments = comments[key] || []
              return (
                <div key={key} className={`${isExpanded ? 'bg-[var(--app-subtle-bg)]/30' : ''}`}>
                  {/* Issue row */}
                  <a href="#" onClick={(e) => { e.preventDefault(); toggleExpand(item.repo, item.iid) }}
                    className="flex items-center gap-1.5 border-b border-[var(--app-border)] px-2 py-1.5 transition-colors hover:bg-[var(--app-subtle-bg)] no-underline">
                    <span className="shrink-0 w-3 text-center text-[8px] text-[var(--app-hint)]">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                    <span className={`shrink-0 rounded px-1 py-0.5 text-[8px] font-semibold
                      ${item.state === 'opened' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--app-border)] text-[var(--app-hint)]'}`}>
                      {`!${item.iid}`}
                    </span>
                    <span className="text-[10px] text-[var(--app-fg)] truncate flex-1">{item.title}</span>
                    {threadComments.length > 0 && (
                      <span className="shrink-0 text-[9px] text-[var(--app-hint)]">{threadComments.length}</span>
                    )}
                  </a>
                  {/* Expanded thread */}
                  {isExpanded && (
                    <>
                      <a href="#" onClick={(e) => {
                        e.preventDefault()
                        props.onSelect?.({ repo: item.repo, iid: item.iid, type: 'main' })
                      }} className="flex items-center gap-1.5 border-b border-[var(--app-border)] py-1 pl-8 pr-2 transition-colors hover:bg-[var(--app-subtle-bg)] no-underline">
                        <span className="shrink-0 text-[9px]">📝</span>
                        <span className="text-[10px] text-[var(--app-fg)] truncate flex-1">主帖</span>
                        <span className="shrink-0 text-[9px] text-[var(--app-hint)]">详情</span>
                      </a>
                      {threadComments.length === 0 && (
                        <div className="py-1 pl-8 pr-2 text-[9px] text-[var(--app-hint)]">加载中...</div>
                      )}
                      {threadComments.map((c, ci) => (
                        <a key={ci} href="#" onClick={(e) => {
                          e.preventDefault()
                          props.onSelect?.({ repo: item.repo, iid: item.iid, type: 'comment', comment: c })
                        }} className="flex items-center gap-1.5 border-b border-[var(--app-border)] py-1 pl-8 pr-2 transition-colors hover:bg-[var(--app-subtle-bg)] no-underline">
                          <span className="shrink-0 text-[9px]">💬</span>
                          <span className="text-[10px] text-[var(--app-fg)] truncate flex-1">
                            <span className="text-[var(--app-link)]">{c.author}</span>
                            <span className="text-[var(--app-hint)]"> · {(c.body || '').slice(0, 40)}</span>
                          </span>
                          <span className="shrink-0 text-[8px] text-[var(--app-hint)]">
                            {new Date(c.createdAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                          </span>
                        </a>
                      ))}
                    </>
                  )}
                </div>
              )
            })}
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
        setItems([
          ...(d.dirs || []).map((n: string) => ({ title: n, path: path ? `${path}/${n}` : n, isDir: true })),
          ...(d.files || []).map((n: string) => ({ title: n, path: path ? `${path}/${n}` : n, isDir: false }))
        ])
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
        {!loading && items.map((item, i) => (
          <a key={i} href="#" onClick={(e) => {
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

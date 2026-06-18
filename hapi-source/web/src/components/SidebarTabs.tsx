import { useState, useEffect } from 'react'

type SidebarTab = 'sessions' | 'issues' | 'notes'

interface SearchItem {
  source: 'gitlab' | 'obsidian'
  title: string
  subtitle: string
  iid?: string
  status?: string
  path?: string
}

interface SidebarTabsProps {
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
}

export { type SidebarTab }

export function SidebarTabs(props: SidebarTabsProps) {
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

export function IssuesPanel(props: {
  onSelect?: (iid: string, repo: string) => void
}) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<SearchItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { doSearch('') }, [])

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  function doSearch(q: string) {
    setLoading(true)
    const searchQ = q.trim() || '!'
    fetch(`/shell/search?q=${encodeURIComponent(searchQ)}`)
      .then(r => r.json())
      .then(d => {
        const issues = (d.gitlab || []).map((r: any) => ({
          source: 'gitlab' as const,
          title: `!${r.iid} ${r.title}`,
          subtitle: r.title,
          iid: r.iid
        }))
        setItems(issues.slice(0, 20))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="shrink-0 border-b border-[var(--app-border)] px-3 py-2">
        <div className="relative">
          <svg className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--app-hint)]"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索 Issues..."
            className="w-full rounded border border-[var(--app-border)] bg-[var(--app-subtle-bg)] py-1 pl-7 pr-2 text-[11px] text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]"
          />
        </div>
      </div>
      <div className="app-scroll-y flex-1 min-h-0">
        {loading && <div className="px-3 py-8 text-center text-[11px] text-[var(--app-hint)]">加载中...</div>}
        {!loading && items.length === 0 && (
          <div className="px-3 py-8 text-center text-[11px] text-[var(--app-hint)]">未找到 Issues</div>
        )}
        {!loading && items.map((item, i) => (
          <a
            key={i}
            href="#"
            onClick={(e) => {
              e.preventDefault()
              props.onSelect?.(item.iid || '', item.subtitle || '')
            }}
            className="block border-b border-[var(--app-border)] px-3 py-2.5 transition-colors hover:bg-[var(--app-subtle-bg)] no-underline"
          >
            <div className="text-[11px] font-medium text-[var(--app-fg)]">{item.title}</div>
            <div className="mt-0.5 text-[10px] text-[var(--app-hint)]">{item.subtitle}</div>
          </a>
        ))}
      </div>
    </div>
  )
}

export function NotesPanel(props: {
  onSelect?: (path: string) => void
}) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<SearchItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { doSearch('') }, [])

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  function doSearch(q: string) {
    setLoading(true)
    fetch(`/shell/search?q=${encodeURIComponent(q.trim() || '.md')}`)
      .then(r => r.json())
      .then(d => {
        const notes = (d.obsidian || []).map((r: any) => ({
          source: 'obsidian' as const,
          title: r.title,
          subtitle: r.path,
          path: r.path
        }))
        setItems(notes.slice(0, 20))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="shrink-0 border-b border-[var(--app-border)] px-3 py-2">
        <div className="relative">
          <svg className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--app-hint)]"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索笔记..."
            className="w-full rounded border border-[var(--app-border)] bg-[var(--app-subtle-bg)] py-1 pl-7 pr-2 text-[11px] text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]"
          />
        </div>
      </div>
      <div className="app-scroll-y flex-1 min-h-0">
        {loading && <div className="px-3 py-8 text-center text-[11px] text-[var(--app-hint)]">加载中...</div>}
        {!loading && items.length === 0 && (
          <div className="px-3 py-8 text-center text-[11px] text-[var(--app-hint)]">未找到笔记</div>
        )}
        {!loading && items.map((item, i) => (
          <a
            key={i}
            href="#"
            onClick={(e) => {
              e.preventDefault()
              props.onSelect?.(item.path || '')
            }}
            className="block border-b border-[var(--app-border)] px-3 py-2.5 transition-colors hover:bg-[var(--app-subtle-bg)] no-underline"
          >
            <div className="text-[11px] font-medium text-[var(--app-fg)]">{item.title}</div>
            <div className="mt-0.5 text-[10px] text-[var(--app-hint)]">{item.subtitle}</div>
          </a>
        ))}
      </div>
    </div>
  )
}

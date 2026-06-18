import { useState, useEffect, useCallback } from 'react'

type FilterTab = 'all' | 'gitlab' | 'obsidian'

interface SearchItem {
  source: 'obsidian' | 'gitlab'
  title: string
  subtitle: string
}

interface LiveData {
  machines: Array<{ host: string; hasKey: boolean }>
}

interface PanelProps {
  isOpen: boolean
  projectHint?: string
}

export function ContextPanel(props: PanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchItem[]>([])
  const [searching, setSearching] = useState(false)
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [machines, setMachines] = useState<LiveData['machines']>([])

  // Load machines on open
  useEffect(() => {
    if (!props.isOpen) return
    fetch('/shell/setup/detect')
      .then(r => r.json())
      .then(d => { if (d.machines) setMachines(d.machines) })
      .catch(() => {})
  }, [props.isOpen])

  // Auto-search when session selected + no manual query
  useEffect(() => {
    if (!props.isOpen) return
    const hint = props.projectHint
    if (!hint || query) return
    doSearch(hint)
  }, [props.projectHint, props.isOpen])

  // Debounced search on manual query
  useEffect(() => {
    if (!query) return
    const timer = setTimeout(() => doSearch(query), 250)
    return () => clearTimeout(timer)
  }, [query])

  const doSearch = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    fetch(`/shell/search?q=${encodeURIComponent(q.trim())}`)
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
        setResults(items.slice(0, 12))
      })
      .catch(() => {})
      .finally(() => setSearching(false))
  }, [])

  if (!props.isOpen) return null

  const filteredResults = filterTab === 'all'
    ? results
    : results.filter(r => r.source === filterTab)

  const isSearching = Boolean(query)
  const displayResults = query ? results : results // auto or manual
  const displayFiltered = query ? filteredResults : displayResults
  const isActive = results.length > 0

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-[var(--app-border)] bg-[var(--app-bg)]"
      style={{ width: '280px', flexShrink: 0 }}>

      {/* Search bar */}
      <div className="shrink-0 border-b border-[var(--app-border)] px-2.5 py-2">
        <div className={`flex items-center gap-1.5 rounded-md border bg-[var(--app-subtle-bg)] px-2 py-1.5
          ${isSearching ? 'border-[var(--app-link)]' : 'border-[var(--app-border)]'}`}>
          <span className="shrink-0 text-xs text-[var(--app-hint)]">🔍</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索 GitLab + 知识库..."
            className="flex-1 bg-transparent text-xs text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)]"
          />
          {query && (
            <button onClick={() => setQuery('')}
              className="shrink-0 text-[10px] text-[var(--app-hint)] hover:text-[var(--app-fg)]">✕</button>
          )}
        </div>
      </div>

      {/* Filter tabs — only when user is searching */}
      {query && isActive && (
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

      {/* Content */}
      <div className="app-scroll-y flex-1 min-h-0 px-2.5 py-2">
        {searching && (
          <div className="py-6 text-center text-[10px] text-[var(--app-hint)]">搜索中...</div>
        )}

        {!searching && !isActive && (
          <div className="py-8 text-center text-[10px] text-[var(--app-hint)]">
            {props.projectHint
              ? `未找到与 "${props.projectHint}" 相关的内容`
              : '选择一个 Session 后自动显示关联内容'}
          </div>
        )}

        {!searching && isActive && (
          <>
            {/* GitLab section */}
            {displayFiltered.filter(r => r.source === 'gitlab').length > 0 && (
              <div className="mb-2">
                <div className="mb-1 text-[9px] uppercase tracking-wider text-[var(--app-hint)]">
                  {`GitLab (${displayFiltered.filter(r => r.source === 'gitlab').length})`}
                </div>
                {displayFiltered.filter(r => r.source === 'gitlab').map((r, i) => (
                  <div key={i} className="mb-0.5 rounded-md bg-[var(--app-subtle-bg)] px-2.5 py-1.5 text-xs border-l-[3px] border-l-[var(--app-link)]">
                    <div className="text-[var(--app-fg)] truncate font-medium">{r.title}</div>
                    <div className="mt-0.5 text-[10px] text-[var(--app-hint)] truncate">{r.subtitle}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Obsidian section */}
            {displayFiltered.filter(r => r.source === 'obsidian').length > 0 && (
              <div>
                <div className="mb-1 text-[9px] uppercase tracking-wider text-[var(--app-hint)]">
                  {`知识库 (${displayFiltered.filter(r => r.source === 'obsidian').length})`}
                </div>
                {displayFiltered.filter(r => r.source === 'obsidian').map((r, i) => (
                  <div key={i} className="mb-0.5 rounded-md bg-[var(--app-subtle-bg)] px-2.5 py-1.5 text-xs border-l-[3px] border-l-[var(--app-link)]/40">
                    <div className="text-[var(--app-fg)] truncate font-medium">{r.title}</div>
                    <div className="mt-0.5 text-[10px] text-[var(--app-hint)] truncate">{r.subtitle}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Machines footer */}
        {machines.length > 0 && (
          <div className="mt-3 border-t border-[var(--app-border)] pt-2">
            <div className="mb-1 text-[9px] uppercase tracking-wider text-[var(--app-hint)]">
              {`机器 (${machines.length})`}
            </div>
            <div className="flex flex-wrap gap-1">
              {machines.map(m => (
                <span key={m.host} className={`rounded px-1 py-0.5 text-[10px] ${m.hasKey ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--app-border)] text-[var(--app-hint)]'}`}>
                  {m.host}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

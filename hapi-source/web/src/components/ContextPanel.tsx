import { useState, useEffect, useCallback } from 'react'

type FilterTab = 'all' | 'gitlab' | 'obsidian'

interface SearchItem {
  source: 'obsidian' | 'gitlab'
  title: string
  subtitle: string
}

interface MachineInfo {
  host: string
  hasKey: boolean
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
  const [machines, setMachines] = useState<MachineInfo[]>([])
  const [panelTitle, setPanelTitle] = useState('')

  useEffect(() => {
    if (!props.isOpen) return
    fetch('/shell/setup/detect')
      .then(r => r.json())
      .then(d => { if (d.machines) setMachines(d.machines) })
      .catch(() => {})
  }, [props.isOpen])

  useEffect(() => {
    if (!props.isOpen) return
    const hint = props.projectHint
    setPanelTitle(hint || '')
    if (!hint || query) return
    doSearch(hint)
  }, [props.projectHint, props.isOpen])

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

  const gitlabCount = filteredResults.filter(r => r.source === 'gitlab').length
  const obsidianCount = filteredResults.filter(r => r.source === 'obsidian').length

  return (
    <div
      className="flex h-full min-h-0 flex-col border-l border-[var(--app-border)] bg-[var(--app-bg)]"
      style={{ width: '280px', flexShrink: 0 }}
    >
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--app-border)] px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-[var(--app-fg)]">
            {panelTitle || '关联'}
          </div>
          {machines.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-[var(--app-hint)]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {`${machines.length} 机器在线`}
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 border-b border-[var(--app-border)] px-3 py-2">
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--app-hint)]"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索 Issue、笔记..."
            className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-subtle-bg)]
                       py-1.5 pl-8 pr-6 text-xs text-[var(--app-fg)] outline-none
                       placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--app-hint)] hover:text-[var(--app-fg)]"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      {query && results.length > 0 && (
        <div className="flex shrink-0 gap-1 border-b border-[var(--app-border)] px-3 py-1.5">
          {([
            ['all', `全部 ${results.length}`],
            ['gitlab', `Issue ${gitlabCount}`],
            ['obsidian', `笔记 ${obsidianCount}`]
          ] as [FilterTab, string][]).map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilterTab(k)}
              className={`rounded px-2 py-0.5 text-[10px] transition-colors
                ${filterTab === k
                  ? 'bg-[var(--app-link)]/10 text-[var(--app-link)]'
                  : 'text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]'
                }`}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="app-scroll-y flex-1 min-h-0">
        {searching && (
          <div className="flex items-center justify-center py-12 text-xs text-[var(--app-hint)]">
            <svg className="mr-2 h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            搜索中...
          </div>
        )}

        {!searching && results.length === 0 && (
          <div className="px-4 py-12 text-center">
            <div className="mb-2 text-2xl opacity-20">
              {query ? '🔍' : '📋'}
            </div>
            <div className="text-xs text-[var(--app-hint)]">
              {query
                ? '未找到匹配内容'
                : props.projectHint
                  ? `未找到与 "${props.projectHint}" 相关的内容`
                  : '选择一个 Session 查看关联内容'}
            </div>
          </div>
        )}

        {!searching && results.length > 0 && (
          <div className="px-3 py-2 space-y-3">
            {/* GitLab Issues */}
            {gitlabCount > 0 && (
              <div>
                <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-[var(--app-hint)]">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" opacity="0.6">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  Issues
                </div>
                <div className="space-y-0.5">
                  {filteredResults.filter(r => r.source === 'gitlab').map((r, i) => (
                    <div
                      key={i}
                      className="cursor-pointer rounded-md px-2.5 py-2 text-xs transition-colors
                                 hover:bg-[var(--app-subtle-bg)] border-l-[3px] border-l-[var(--app-link)]"
                    >
                      <div className="font-medium text-[var(--app-fg)] leading-snug">{r.title}</div>
                      <div className="mt-0.5 text-[11px] text-[var(--app-hint)]">{r.subtitle}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Obsidian notes */}
            {obsidianCount > 0 && (
              <div>
                <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-[var(--app-hint)]">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  笔记
                </div>
                <div className="space-y-0.5">
                  {filteredResults.filter(r => r.source === 'obsidian').map((r, i) => (
                    <div
                      key={i}
                      className="cursor-pointer rounded-md px-2.5 py-2 text-xs transition-colors
                                 hover:bg-[var(--app-subtle-bg)]"
                    >
                      <div className="font-medium text-[var(--app-fg)] leading-snug">{r.title}</div>
                      <div className="mt-0.5 text-[11px] text-[var(--app-hint)]">{r.subtitle}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Machines footer */}
        {machines.length > 0 && (
          <div className="border-t border-[var(--app-border)] px-3 py-2">
            <div className="flex flex-wrap gap-1">
              {machines.map(m => (
                <span
                  key={m.host}
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]
                    ${m.hasKey
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-[var(--app-subtle-bg)] text-[var(--app-hint)]'
                    }`}
                >
                  <span className={`inline-block h-1 w-1 rounded-full ${m.hasKey ? 'bg-emerald-500' : 'bg-[var(--app-hint)]'}`} />
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

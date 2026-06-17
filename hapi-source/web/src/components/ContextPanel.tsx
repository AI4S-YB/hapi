import { useState, useEffect, useCallback } from 'react'

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

  const isSearching = activeTab === 'context' && Boolean(query)

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-[var(--app-border)] bg-[var(--app-bg)]"
      style={{ width: '280px', flexShrink: 0 }}>

      {/* Search bar — fixed top */}
      <div className="shrink-0 border-b border-[var(--app-border)] px-2.5 py-2">
        <div className={`flex items-center gap-1.5 rounded-md border bg-[var(--app-subtle-bg)] px-2 py-1.5
          ${isSearching ? 'border-[var(--app-link)]' : 'border-[var(--app-border)]'}`}>
          <span className="shrink-0 text-xs text-[var(--app-hint)]">🔍</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={
              activeTab === 'context' ? '搜索 GitLab + 知识库...' :
              activeTab === 'skills' ? '筛选 Skills...' : '筛选任务...'
            }
            className="flex-1 bg-transparent text-xs text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)]"
          />
          {query && (
            <button onClick={() => setQuery('')}
              className="shrink-0 text-[10px] text-[var(--app-hint)] hover:text-[var(--app-fg)]">✕</button>
          )}
        </div>
      </div>

      {/* Filter tabs — only when searching in context tab */}
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
            {searching && (
              <div className="py-6 text-center text-[10px] text-[var(--app-hint)]">搜索中...</div>
            )}
            {!searching && (
              <>
                {!query && !props.projectHint && (
                  <div className="py-8 text-center text-[10px] text-[var(--app-hint)]">
                    选择一个 Session 后自动显示关联内容
                  </div>
                )}
                {!query && props.projectHint && results.length === 0 && (
                  <div className="py-4 text-center text-[10px] text-[var(--app-hint)]">
                    {`未找到与 "${props.projectHint}" 相关的内容`}
                  </div>
                )}
                {results.length > 0 && (
                  <>
                    {/* GitLab section */}
                    {filteredResults.filter(r => r.source === 'gitlab').length > 0 && (
                      <div className="mb-2">
                        <div className="mb-1 text-[9px] uppercase tracking-wider text-[var(--app-hint)]">
                          {`仓库 (${filteredResults.filter(r => r.source === 'gitlab').length})`}
                        </div>
                        {filteredResults.filter(r => r.source === 'gitlab').map((r, i) => (
                          <div key={i} className="mb-0.5 rounded-md bg-[var(--app-subtle-bg)] px-2.5 py-1.5 text-xs border-l-[3px] border-l-[var(--app-link)]">
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
                          {`知识库 (${filteredResults.filter(r => r.source === 'obsidian').length})`}
                        </div>
                        {filteredResults.filter(r => r.source === 'obsidian').map((r, i) => (
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

        {/* Skills tab */}
        {activeTab === 'skills' && liveData && (
          <>
            <div className="mb-1 text-[10px] font-semibold text-[var(--app-fg)]">
              {`已安装 (${liveData.skills.length})`}
            </div>
            {liveData.skills.filter(s => !query || s.name.includes(query)).map(s => (
              <div key={s.name} className="mb-0.5 flex items-center justify-between rounded-md bg-[var(--app-subtle-bg)] px-2.5 py-1.5 text-xs">
                <div className="text-[var(--app-fg)]">{s.name}</div>
                <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-[10px] text-emerald-500">✓</span>
              </div>
            ))}
          </>
        )}

        {/* Cron tab */}
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
              <div key={t.id} className={`mb-0.5 rounded-md bg-[var(--app-subtle-bg)] px-2.5 py-1.5 text-xs border-l-[3px]
                ${t.source === 'claude-code' ? 'border-l-[var(--app-link)]' : t.source === 'launchd' ? 'border-l-amber-500' : 'border-l-emerald-500'}`}>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium text-[var(--app-fg)] truncate">{t.label}</span>
                  <span className="shrink-0 rounded bg-[var(--app-subtle-bg)] px-1 py-0.5 text-[9px] text-[var(--app-hint)]">{t.source}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-[var(--app-hint)]">{t.schedule}</div>
                <div className="mt-0.5 truncate text-[10px] text-[var(--app-hint)]">{t.command}</div>
              </div>
            )) : (
              <div className="py-4 text-center text-[10px] text-[var(--app-hint)]">无定时任务</div>
            )}
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
            className={`flex-1 py-1.5 text-[10px] transition-colors
              ${activeTab === k ? 'border-t-2 border-[var(--app-link)] -mt-px text-[var(--app-link)]' : 'text-[var(--app-hint)] hover:text-[var(--app-fg)]'}`}>
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}

function SourceBadge(props: { label: string; found?: boolean; available?: boolean }) {
  return (
    <span className={`rounded px-1 py-0.5
      ${!props.available ? 'bg-[var(--app-border)]/30 text-[var(--app-hint)]'
        : props.found ? 'bg-[var(--app-link)]/10 text-[var(--app-link)]' : 'bg-[var(--app-border)] text-[var(--app-hint)]'}`}>
      {!props.available ? `${props.label} (-)` : props.found ? props.label : `${props.label} (0)`}
    </span>
  )
}

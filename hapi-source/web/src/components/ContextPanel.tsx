import { useState, useEffect } from 'react'

type TabName = 'context' | 'skills' | 'cron'

interface LiveData {
  obsidian: { found: boolean; vaults: Array<{ name: string; path: string }> }
  github: { found: boolean; user?: string; error?: string }
  gitlab: { found: boolean; user?: string; error?: string }
  machines: Array<{ host: string; hasKey: boolean; hasConfig: boolean }>
  skills: Array<{ name: string }>
}

interface SearchItem {
  source: 'obsidian' | 'gitlab'
  title: string
  subtitle: string
}

interface PanelProps {
  isOpen: boolean
  projectHint?: string  // derived from selected session metadata
}

export function ContextPanel(props: PanelProps) {
  const [activeTab, setActiveTab] = useState<TabName>('context')
  const [liveData, setLiveData] = useState<LiveData | null>(null)
  const [dataError, setDataError] = useState<string | null>(null)

  useEffect(() => {
    if (!props.isOpen) return
    setDataError(null)
    fetch('/shell/setup/detect')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => setLiveData(d))
      .catch(err => setDataError(err.message))
  }, [props.isOpen])

  if (!props.isOpen) return null

  return (
    <div
      className="flex h-full min-h-0 flex-col border-l border-[var(--app-border)]
                 bg-[var(--app-bg)]"
      style={{ width: '280px', flexShrink: 0 }}
    >
      <div className="flex shrink-0 border-b border-[var(--app-border)]">
        {([
          ['context', '关联'],
          ['skills', 'Skills'],
          ['cron', '定时']
        ] as [TabName, string][]).map(([tab, label]) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={`flex-1 px-3 py-2 text-xs transition-colors
              ${activeTab === tab
                ? 'border-b-2 border-[var(--app-link)] text-[var(--app-link)]'
                : 'text-[var(--app-hint)] hover:text-[var(--app-fg)]'
              }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="app-scroll-y flex-1 min-h-0 p-3">
        {dataError && (
          <div className="mb-2 rounded bg-red-500/10 px-2 py-1.5 text-xs text-red-500">
            {dataError}
          </div>
        )}
        {!liveData && !dataError && (
          <div className="py-8 text-center text-xs text-[var(--app-hint)]">加载中...</div>
        )}
        {liveData && activeTab === 'context' && <ContextTab data={liveData} projectHint={props.projectHint} />}
        {liveData && activeTab === 'skills' && <SkillsTab data={liveData} />}
        {liveData && activeTab === 'cron' && <CronTab />}
      </div>
    </div>
  )
}

// --- Context Tab: mini dashboard with real search results ---
function ContextTab({ data, projectHint }: { data: LiveData; projectHint?: string }) {
  const query = projectHint || ''
  const [results, setResults] = useState<SearchItem[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!query) {
      setResults([])
      return
    }
    setSearching(true)
    fetch(`/shell/search?q=${encodeURIComponent(query)}`)
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
        setResults(items.slice(0, 8))
      })
      .catch(() => {})
      .finally(() => setSearching(false))
  }, [query])

  return (
    <>
      {/* Quick summary bar */}
      <div className="mb-2 flex gap-1 text-[10px]">
        <span className={`rounded px-1.5 py-0.5 ${data.gitlab.found ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
          {data.gitlab.found ? 'GitLab' : 'GitLab ✗'}
        </span>
        <span className={`rounded px-1.5 py-0.5 ${data.obsidian.found ? 'bg-[var(--app-link)]/10 text-[var(--app-link)]' : 'bg-amber-500/10 text-amber-500'}`}>
          {`知识库 ${data.obsidian.vaults.length || 0}`}
        </span>
        <span className="rounded bg-[var(--app-subtle-bg)] px-1.5 py-0.5 text-[var(--app-hint)]">
          {`机器 ${data.machines.length}`}
        </span>
      </div>

      {/* Related content — real search results */}
      {query ? (
        <>
          <div className="mb-1 text-[9px] uppercase tracking-wider text-[var(--app-hint)]">
            {`🔍 搜索 "${query}"`}
          </div>
          {searching ? (
            <div className="py-4 text-center text-xs text-[var(--app-hint)]">搜索中...</div>
          ) : results.length > 0 ? (
            results.map((r, i) => (
              <div key={i} className={`mb-0.5 rounded-md bg-[var(--app-subtle-bg)] px-2.5 py-1.5 text-xs
                ${r.source === 'gitlab' ? 'border-l-[3px] border-l-[var(--app-link)]' : 'border-l-[3px] border-l-[var(--app-link)]/50'}`}>
                <div className="text-[var(--app-fg)] truncate">{r.title}</div>
                <div className="mt-0.5 text-[10px] text-[var(--app-hint)] truncate">{r.subtitle}</div>
              </div>
            ))
          ) : (
            <div className="py-4 text-center text-xs text-[var(--app-hint)]">无匹配结果</div>
          )}
        </>
      ) : (
        <div className="py-4 text-center text-xs text-[var(--app-hint)]">
          选择一个 Session 后将显示关联的<br />
          GitLab Issues 和知识库笔记
        </div>
      )}

      {/* Machines — compact list */}
      {data.machines.length > 0 && (
        <div className="mt-3 border-t border-[var(--app-border)] pt-2">
          <div className="mb-1 text-[9px] uppercase tracking-wider text-[var(--app-hint)]">
            {`💻 机器 (${data.machines.length})`}
          </div>
          <div className="flex flex-wrap gap-1">
            {data.machines.map(m => (
              <span key={m.host}
                className={`rounded px-1.5 py-0.5 text-[10px]
                  ${m.hasKey ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--app-border)] text-[var(--app-hint)]'}`}>
                {m.host}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// --- Skills Tab ---
function SkillsTab({ data }: { data: LiveData }) {
  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--app-fg)]">
          {`已安装 Skills (${data.skills.length})`}
        </span>
      </div>

      {data.skills.length > 0 ? (
        data.skills.map(s => (
          <div key={s.name}
            className="mb-0.5 flex items-center justify-between rounded-md bg-[var(--app-subtle-bg)] px-2.5 py-2 text-xs">
            <div className="text-[var(--app-fg)]">{s.name}</div>
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-500">✓</span>
          </div>
        ))
      ) : (
        <div className="text-xs text-[var(--app-hint)]">未检测到 Skills。安装后会自动出现。</div>
      )}
    </>
  )
}

// --- Cron Tab ---
const SOURCE_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  'launchd': 'launchd',
  'crontab': 'crontab'
}

function CronTab() {
  const [cronData, setCronData] = useState<{
    platform: string;
    tasks: Array<{ source: string; id: string; label: string; schedule: string; command: string; enabled: boolean }>;
    sources: Record<string, { found: boolean; count?: number; available: boolean }>
  } | null>(null)

  useEffect(() => {
    fetch('/shell/cron')
      .then(r => r.json())
      .then(d => setCronData(d))
      .catch(() => setCronData(null))
  }, [])

  if (!cronData) {
    return <div className="py-8 text-center text-xs text-[var(--app-hint)]">加载中...</div>
  }

  const { tasks, sources, platform } = cronData
  const isMacOS = platform === 'darwin'

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--app-fg)]">
          {`定时任务 (${tasks.length})`}
        </span>
        <span className="text-[9px] text-[var(--app-hint)]">{isMacOS ? 'macOS' : 'Linux'}</span>
      </div>

      <div className="mb-2 flex gap-1 text-[9px]">
        <LayerBadge label="Claude Code" found={sources.claudeCode?.found} available={sources.claudeCode?.available} />
        <LayerBadge label="launchd" found={sources.launchd?.found} available={sources.launchd?.available} />
        <LayerBadge label="crontab" found={sources.crontab?.found} available={sources.crontab?.available} />
      </div>

      {tasks.length > 0 ? (
        tasks.map(t => (
          <div key={t.id}
            className={`mb-1 rounded-md bg-[var(--app-subtle-bg)] px-2.5 py-2 text-xs
              ${t.source === 'claude-code' ? 'border-l-[3px] border-l-[var(--app-link)]' : ''}
              ${t.source === 'launchd' ? 'border-l-[3px] border-l-amber-500' : ''}
              ${t.source === 'crontab' ? 'border-l-[3px] border-l-emerald-500' : ''}`}>
            <div className="flex items-center justify-between gap-1">
              <span className="font-medium text-[var(--app-fg)] truncate">{t.label}</span>
              <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium
                ${t.source === 'claude-code' ? 'bg-[var(--app-link)]/10 text-[var(--app-link)]' : ''}
                ${t.source === 'launchd' ? 'bg-amber-500/10 text-amber-500' : ''}
                ${t.source === 'crontab' ? 'bg-emerald-500/10 text-emerald-500' : ''}`}>
                {SOURCE_LABELS[t.source] || t.source}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1">
              <span className="text-[10px] text-[var(--app-hint)]">{t.schedule}</span>
              <span className={`rounded px-1 py-0.5 text-[10px]
                ${t.enabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--app-border)] text-[var(--app-hint)]'}`}>
                {t.enabled ? '活跃' : '停用'}
              </span>
            </div>
            <div className="mt-0.5 truncate text-[10px] text-[var(--app-hint)]">{t.command}</div>
          </div>
        ))
      ) : (
        <div className="py-4 text-center text-xs text-[var(--app-hint)]">
          未检测到用户定时任务。
        </div>
      )}
    </>
  )
}

function LayerBadge(props: { label: string; found?: boolean; available?: boolean }) {
  return (
    <span className={`rounded px-1 py-0.5
      ${!props.available
        ? 'bg-[var(--app-border)]/30 text-[var(--app-hint)]'
        : props.found
          ? 'bg-[var(--app-link)]/10 text-[var(--app-link)]'
          : 'bg-[var(--app-border)] text-[var(--app-hint)]'
      }`}>
      {!props.available ? `${props.label} (-)` : props.found ? props.label : `${props.label} (0)`}
    </span>
  )
}

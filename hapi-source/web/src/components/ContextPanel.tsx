import { useState, useEffect } from 'react'

type TabName = 'context' | 'skills' | 'cron'

// Data shape from /api/setup/detect
interface LiveData {
  obsidian: { found: boolean; vaults: Array<{ name: string; path: string }> }
  github: { found: boolean; user?: string; error?: string }
  gitlab: { found: boolean; user?: string; error?: string }
  machines: Array<{ host: string; hasKey: boolean; hasConfig: boolean }>
  skills: Array<{ name: string }>
}

interface PanelProps {
  isOpen: boolean
}

export function ContextPanel(props: PanelProps) {
  const [activeTab, setActiveTab] = useState<TabName>('context')
  const [liveData, setLiveData] = useState<LiveData | null>(null)
  const [dataError, setDataError] = useState<string | null>(null)

  // Fetch live detection data every time panel opens
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
      {/* Tabs */}
      <div className="flex shrink-0 border-b border-[var(--app-border)]">
        {([
          ['context', '关联'],
          ['skills', 'Skills'],
          ['cron', '定时']
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
        {dataError && (
          <div className="mb-2 rounded bg-red-500/10 px-2 py-1.5 text-xs text-red-500">
            检测失败: {dataError}
          </div>
        )}
        {!liveData && !dataError && (
          <div className="py-8 text-center text-xs text-[var(--app-hint)]">加载中...</div>
        )}
        {liveData && activeTab === 'context' && <ContextTab data={liveData} />}
        {liveData && activeTab === 'skills' && <SkillsTab data={liveData} />}
        {liveData && activeTab === 'cron' && <CronTab />}
      </div>
    </div>
  )
}

// --- Shared UI ---
function SectionTitle(props: { children: string }) {
  return <div className="mb-1.5 text-[9px] uppercase tracking-wider text-[var(--app-hint)]">{props.children}</div>
}

function Card(props: { title: string; subtitle?: string; borderColor?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-1 rounded-md bg-[var(--app-subtle-bg)] px-2.5 py-2 text-xs"
      style={props.borderColor ? { borderLeft: `3px solid ${props.borderColor}` } : undefined}>
      <div className="font-medium text-[var(--app-fg)]">{props.title}</div>
      {props.subtitle && <div className="mt-0.5 text-[11px] text-[var(--app-hint)]">{props.subtitle}</div>}
      {props.children}
    </div>
  )
}

function StatusBadge(props: { active: boolean; activeLabel?: string; inactiveLabel?: string }) {
  return (
    <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px]
      ${props.active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--app-border)] text-[var(--app-hint)]'}`}>
      {props.active ? (props.activeLabel || '已连接') : (props.inactiveLabel || '未连接')}
    </span>
  )
}

// --- Context Tab (live data) ---
function ContextTab({ data }: { data: LiveData }) {
  return (
    <>
      {/* Git */}
      <SectionTitle>📦 Git 仓库</SectionTitle>
      <Card title="GitLab" borderColor={data.gitlab.found ? '#a6e22e' : '#fd971f'}>
        <StatusBadge active={data.gitlab.found}
          activeLabel={data.gitlab.user ? `已认证 · ${data.gitlab.user}` : '已认证'}
          inactiveLabel={data.gitlab.error || '未检测到'} />
      </Card>
      <Card title="GitHub" borderColor={data.github.found ? '#a6e22e' : '#fd971f'}>
        <StatusBadge active={data.github.found}
          activeLabel={data.github.user ? `已认证 · ${data.github.user}` : '已认证'}
          inactiveLabel={data.github.error || '未检测到'} />
      </Card>

      {/* Obsidian */}
      <div className="mt-3">
        <SectionTitle>📄 知识库</SectionTitle>
        {data.obsidian.found ? (
          data.obsidian.vaults.map(v => (
            <Card key={v.path} title={v.name} subtitle={v.path} borderColor="#66d9ef" />
          ))
        ) : (
          <div className="text-xs text-[var(--app-hint)]">未检测到 Obsidian Vault</div>
        )}
      </div>

      {/* Machines */}
      <div className="mt-3">
        <SectionTitle>{`💻 机器 (${data.machines.length})`}</SectionTitle>
        {data.machines.length > 0 ? (
          data.machines.map(m => (
            <Card key={m.host} title={m.host} borderColor={m.hasKey ? '#a6e22e' : '#fd971f'}>
              <div className="mt-1 flex gap-1">
                {m.hasKey && <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-[10px] text-emerald-500">🔑 SSH Key</span>}
                {m.hasConfig && <span className="rounded bg-[var(--app-link)]/10 px-1 py-0.5 text-[10px] text-[var(--app-link)]">config</span>}
                {!m.hasKey && <span className="rounded bg-amber-500/10 px-1 py-0.5 text-[10px] text-amber-500">无密钥</span>}
              </div>
            </Card>
          ))
        ) : (
          <div className="text-xs text-[var(--app-hint)]">未检测到 SSH 机器</div>
        )}
      </div>

      {/* Compute */}
      <div className="mt-3">
        <SectionTitle>📊 数据 · 繁Files</SectionTitle>
        <div className="text-xs text-[var(--app-hint)]">
          繁Files 集成将在下一步实现
        </div>
      </div>
    </>
  )
}

// --- Skills Tab (live from filesystem) ---
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
            <div>
              <div className="text-[var(--app-fg)]">{s.name}</div>
            </div>
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-500">✓</span>
          </div>
        ))
      ) : (
        <div className="text-xs text-[var(--app-hint)]">
          未检测到 Skills。安装后会自动出现在这里。
        </div>
      )}
    </>
  )
}

// --- Cron Tab (live from /api/cron, platform-aware) ---

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
        <span className="text-[9px] text-[var(--app-hint)]">
          {isMacOS ? 'macOS' : 'Linux'}
        </span>
      </div>

      {/* Source layer legend */}
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
          未检测到用户定时任务。<br />
          {isMacOS
            ? '系统级 launchd 服务已自动过滤。'
            : 'Claude Code 的 CronCreate 创建持久任务后会自动出现。'}
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

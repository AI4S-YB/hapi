import { useState } from 'react'

type TabName = 'context' | 'skills' | 'cron'

export function ContextPanel(props: {
  isOpen: boolean
  onToggle: () => void
}) {
  const [activeTab, setActiveTab] = useState<TabName>('context')

  return (
    <>
      {/* Toggle button */}
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

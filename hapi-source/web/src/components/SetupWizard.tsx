import { useState, useEffect, useCallback } from 'react'

interface DetectionResult {
  obsidian: { found: boolean; vaults: Array<{ name: string; path: string }> }
  github: { found: boolean; user?: string; url?: string; error?: string }
  gitlab: { found: boolean; user?: string; url?: string; error?: string }
  machines: Array<{ host: string; hasKey: boolean; hasConfig: boolean }>
  skills: Array<{ name: string; path: string }>
}

export function SetupWizard(props: {
  onComplete: () => void
}) {
  const [step, setStep] = useState<'detecting' | 'review' | 'saving'>('detecting')
  const [data, setData] = useState<DetectionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedVault, setSelectedVault] = useState<string>('')
  const [selectedMachines, setSelectedMachines] = useState<Set<string>>(new Set())

  const detect = useCallback(async () => {
    setStep('detecting')
    setError(null)
    try {
      const res = await fetch('/shell/setup/detect')
      if (!res.ok) throw new Error('Detection failed')
      const d: DetectionResult = await res.json()
      setData(d)
      // Auto-select first vault
      if (d.obsidian.vaults.length > 0) {
        setSelectedVault(d.obsidian.vaults[0].path)
      }
      // Auto-select all machines
      setSelectedMachines(new Set(d.machines.map(m => m.host)))
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detection failed')
      setStep('review')
    }
  }, [])

  useEffect(() => { void detect() }, [detect])

  const toggleMachine = (host: string) => {
    const next = new Set(selectedMachines)
    if (next.has(host)) next.delete(host)
    else next.add(host)
    setSelectedMachines(next)
  }

  const save = async () => {
    setStep('saving')
    try {
      const config = {
        obsidian: { vaultPath: selectedVault },
        github: data?.github.found ? { user: data.github.user } : undefined,
        gitlab: data?.gitlab.found ? { user: data.gitlab.user, url: data.gitlab.url } : undefined,
        machines: data?.machines.filter(m => selectedMachines.has(m.host)).map(m => ({
          host: m.host,
          hasKey: m.hasKey,
          hasConfig: m.hasConfig
        })),
        skills: data?.skills.map(s => s.name),
        configuredAt: new Date().toISOString()
      }
      const res = await fetch('/shell/setup/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      if (!res.ok) throw new Error('Save failed')
      props.onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setStep('review')
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[600px] max-h-[80vh] max-w-[95vw] overflow-y-auto rounded-xl border
                      border-[var(--app-border)] bg-[var(--app-bg)] p-8 shadow-2xl">
        <h1 className="mb-2 text-xl font-bold text-[var(--app-fg)]">🔧 初始设置</h1>
        <p className="mb-6 text-sm text-[var(--app-hint)]">
          自动检测您的开发环境。确认后配置将保存到 ~/.hapi-shell/config.json
        </p>

        {step === 'detecting' && (
          <div className="py-12 text-center text-sm text-[var(--app-hint)]">
            ⏳ 正在检测您的环境...
          </div>
        )}

        {step === 'saving' && (
          <div className="py-12 text-center text-sm text-[var(--app-hint)]">
            💾 正在保存配置...
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-md bg-red-500/10 p-3 text-sm text-red-500">
            {error}
            <button onClick={detect} className="ml-2 underline">重试</button>
          </div>
        )}

        {step === 'review' && data && (
          <>
            {/* Obsidian */}
            <Section title="📄 知识库 (Obsidian)">
              {data.obsidian.found ? (
                <select
                  value={selectedVault}
                  onChange={e => setSelectedVault(e.target.value)}
                  className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-subtle-bg)]
                             px-3 py-2 text-sm text-[var(--app-fg)]"
                >
                  {data.obsidian.vaults.map(v => (
                    <option key={v.path} value={v.path}>{v.name} — {v.path}</option>
                  ))}
                </select>
              ) : (
                <Hint text="未检测到 Obsidian Vault。您可以稍后手动设置路径。" />
              )}
            </Section>

            {/* Git */}
            <Section title="📦 Git 仓库">
              <Badge label="GitHub" found={data.github.found} detail={data.github.user} hint={data.github.error} />
              <Badge label="GitLab" found={data.gitlab.found} detail={data.gitlab.user} hint={data.gitlab.error} />
            </Section>

            {/* Machines */}
            <Section title="💻 机器">
              {data.machines.length > 0 ? (
                <div className="space-y-1">
                  {data.machines.map(m => (
                    <label key={m.host}
                      className="flex items-center gap-2 rounded-md bg-[var(--app-subtle-bg)] px-3 py-2 cursor-pointer">
                      <input type="checkbox" checked={selectedMachines.has(m.host)}
                        onChange={() => toggleMachine(m.host)}
                        className="accent-[var(--app-link)]" />
                      <span className="text-sm text-[var(--app-fg)]">{m.host}</span>
                      {m.hasKey && <span className="text-[10px] text-emerald-500">🔑</span>}
                      {m.hasConfig && <span className="text-[10px] text-[var(--app-link)]">cfg</span>}
                    </label>
                  ))}
                </div>
              ) : (
                <Hint text="未检测到 SSH 机器。稍后可通过知识库手动添加。" />
              )}
            </Section>

            {/* Skills */}
            <Section title="🧩 Skills">
              {data.skills.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {data.skills.map(s => (
                    <span key={s.name}
                      className="rounded bg-[var(--app-subtle-bg)] px-2 py-1 text-xs text-[var(--app-fg)]">
                      {s.name}
                    </span>
                  ))}
                </div>
              ) : (
                <Hint text="未检测到 Skills。" />
              )}
            </Section>

            <div className="mt-6 flex gap-3">
              <button onClick={save}
                className="flex-1 rounded-md bg-[var(--app-link)] px-4 py-2.5 text-sm font-medium text-white
                           transition-opacity hover:opacity-90">
                确认并保存
              </button>
              <button onClick={props.onComplete}
                className="rounded-md border border-[var(--app-border)] px-4 py-2.5 text-sm text-[var(--app-hint)]
                           hover:bg-[var(--app-subtle-bg)]">
                跳过
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-xs font-semibold text-[var(--app-fg)]">{props.title}</div>
      {props.children}
    </div>
  )
}

function Badge(props: { label: string; found: boolean; detail?: string; hint?: string }) {
  return (
    <div className={`mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm
      ${props.found ? 'bg-emerald-500/5' : 'bg-amber-500/5'}`}>
      <span className={props.found ? 'text-emerald-500' : 'text-amber-500'}>
        {props.found ? '✅' : '⚠️'}
      </span>
      <span className="text-[var(--app-fg)]">{props.label}</span>
      {props.detail && <span className="text-xs text-[var(--app-hint)]">({props.detail})</span>}
      {props.hint && <span className="text-xs text-amber-500">— {props.hint}</span>}
    </div>
  )
}

function Hint(props: { text: string }) {
  return <div className="text-xs text-[var(--app-hint)]">{props.text}</div>
}

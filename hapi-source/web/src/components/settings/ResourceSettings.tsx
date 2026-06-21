import { useState, useEffect } from 'react'
import { useTranslation } from '@/lib/use-translation'
import { ComputeDialog, type MachineConfig } from '@/components/settings/ComputeDialog'

export function ResourceSettings() {
  const { t } = useTranslation()
  const [gitProvider, setGitProvider] = useState<'gitlab' | 'github'>('gitlab')
  const [gitUrl, setGitUrl] = useState('')
  const [gitToken, setGitToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [gitStatus, setGitStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [gitMsg, setGitMsg] = useState('')
  const [gitlabEnabled, setGitlabEnabled] = useState(true)

  const [obsidianPath, setObsidianPath] = useState('')
  const [obsidianEnabled, setObsidianEnabled] = useState(true)
  const [obsidianStatus, setObsidianStatus] = useState<'idle' | 'ok' | 'fail'>('idle')

  const [machines, setMachines] = useState<MachineConfig[]>([])
  const [fanFilesStatus, setFanFilesStatus] = useState<{
    installed: boolean; indexedFiles?: number; servers?: Array<{name: string; files: number}>
  } | null>(null)
  const [editMachine, setEditMachine] = useState<MachineConfig | null>(null)
  const [showAddMachine, setShowAddMachine] = useState(false)
  const [notifyEnabled, setNotifyEnabled] = useState(true)
  const [notifyInterval, setNotifyInterval] = useState(10)

  useEffect(() => {
    // Load saved config first
    fetch('/shell/config')
      .then(r => r.json())
      .then(configData => {
        if (configData.configured) {
          if (configData.gitlab?.url) setGitUrl(configData.gitlab.url)
          if (configData.gitlab?.token) setGitToken(configData.gitlab.token)
          if (configData.gitlab?.provider) setGitProvider(configData.gitlab.provider)
          if (typeof configData.gitlab?.enabled === 'boolean') setGitlabEnabled(configData.gitlab.enabled)
          if (configData.obsidian?.vaultPath) setObsidianPath(configData.obsidian.vaultPath)
          if (typeof configData.obsidian?.enabled === 'boolean') setObsidianEnabled(configData.obsidian.enabled)
        }

        // Then fill gaps with detection
        return fetch('/shell/setup/detect').then(r => r.json()).then(detectData => ({ configData, detectData }))
      })
      .then(({ configData, detectData }) => {
        const hasUrl = !!(configData?.configured && configData?.gitlab?.url) || !!gitUrl
        const hasToken = !!(configData?.configured && configData?.gitlab?.token) || !!gitToken
        const hasPath = !!(configData?.configured && configData?.obsidian?.vaultPath) || !!obsidianPath

        if (!hasPath && detectData.obsidian?.vaults?.length) {
          setObsidianPath(detectData.obsidian.vaults[0].path)
        }
        if (detectData.gitlab?.found) {
          if (!hasUrl) setGitUrl(detectData.gitlab.url || 'http://182.92.166.143:8929')
          if (!hasToken && detectData.gitlab.token) setGitToken(detectData.gitlab.token)
        }
        if (detectData.machines && machines.length === 0) {
          // Convert SSH hosts to basic machine configs
          setMachines(detectData.machines.map((m: any) => ({
            name: m.host, host: m.ip || m.host.split(':')[0],
            port: parseInt(m.host.split(':')[1]) || 22,
            user: 'root', authMethod: 'key' as const,
            keyPath: m.hasKey ? '~/.ssh/id_ed25519' : '',
            description: `Detected from SSH known_hosts`,
            dataPaths: []
          })))
        }
      })
      .catch(() => {})

    // Load saved compute config
    fetch('/shell/compute')
      .then(r => r.json())
      .then(d => { if (d.machines?.length) setMachines(d.machines.map((m: any) => ({ ...m, dataPaths: m.dataPaths || [] }))) })
      .catch(() => {})

    // Load fan-files data status
    fetch('/shell/data/status')
      .then(r => r.json())
      .then(d => { if (d.installed) setFanFilesStatus(d) })
      .catch(() => {})

    // Load notify config
    fetch('/shell/notify/config')
      .then(r => r.json())
      .then(d => {
        if (typeof d.enabled === 'boolean') setNotifyEnabled(d.enabled)
        if (d.intervalMinutes) setNotifyInterval(d.intervalMinutes)
      })
      .catch(() => {})
  }, [])

  function saveNotify() {
    fetch('/shell/notify/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: notifyEnabled, intervalMinutes: notifyInterval })
    }).catch(() => {})
  }

  function saveMachines(updated: MachineConfig[]) {
    setMachines(updated)
    fetch('/shell/compute/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machines: updated })
    }).catch(() => {})
  }

  useEffect(() => {
    if (!obsidianPath) { setObsidianStatus('idle'); return }
    fetch('/shell/obsidian/tree?path=')
      .then(r => { setObsidianStatus(r.ok ? 'ok' : 'fail') })
      .catch(() => setObsidianStatus('fail'))
  }, [obsidianPath])

  function testGit() {
    setGitStatus('testing'); setGitMsg('')
    fetch('/shell/issues?q=&force=1')
      .then(r => r.json())
      .then(d => {
        if (d.issues?.length > 0) {
          setGitStatus('ok')
          setGitMsg(`${d.issues.length} issues`)
        } else {
          setGitStatus('fail')
          setGitMsg(t('settings.resources.gitTestFail'))
        }
      })
      .catch(err => {
        setGitStatus('fail')
        setGitMsg(err.message || t('settings.resources.gitTestFail'))
      })
  }

  function saveResources() {
    fetch('/shell/setup/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gitlab: { enabled: gitlabEnabled, provider: gitProvider, url: gitUrl, token: gitToken },
        obsidian: { enabled: obsidianEnabled, vaultPath: obsidianPath },
        compute: { enabled: true }
      })
    }).then(() => window.location.reload()).catch(() => {})
  }

  return (
    <div>
      <div className="border-b border-[var(--app-divider)]">
        <div className="px-3 py-2 text-xs font-semibold text-[var(--app-hint)] uppercase tracking-wide">
          Resources
        </div>

        {/* 议题 */}
        <ToggleRow label={t('settings.resources.issues')} enabled={gitlabEnabled} onChange={setGitlabEnabled}
          status={gitStatus === 'ok' ? t('settings.resources.connected') : gitStatus === 'fail' ? t('settings.resources.connectFailed') : undefined}
          statusOk={gitStatus === 'ok'} />
        {gitlabEnabled && (
          <div className="px-3 pb-3 space-y-2">
            <div>
              <Label text={t('settings.resources.gitProvider')} />
              <select value={gitProvider} onChange={e => setGitProvider(e.target.value as any)}
                className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-sm text-[var(--app-fg)] outline-none focus:border-[var(--app-link)]">
                <option value="gitlab">GitLab</option>
                <option value="github">GitHub</option>
              </select>
            </div>
            <div>
              <Label text="URL" />
              <input value={gitUrl} onChange={e => setGitUrl(e.target.value)}
                placeholder={gitProvider === 'gitlab' ? 'http://your-gitlab.com' : 'https://github.com'}
                className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-sm text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]" />
            </div>
            <div>
              <Label text="Access Token" />
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={gitToken} onChange={e => setGitToken(e.target.value)}
                    placeholder={gitProvider === 'gitlab' ? 'glpat-...' : 'ghp_...'}
                    className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 pr-8 text-sm text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]" />
                  <button type="button" onClick={() => setShowToken(!showToken)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-xs text-[var(--app-hint)] hover:text-[var(--app-fg)]"
                    title={showToken ? t('settings.resources.hide') : t('settings.resources.show')}>
                    {showToken ? '🙈' : '👁'}
                  </button>
                </div>
                <button onClick={testGit} disabled={gitStatus === 'testing'}
                  className="shrink-0 rounded border border-[var(--app-divider)] px-3 py-1.5 text-xs text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] disabled:opacity-50">
                  {gitStatus === 'testing' ? t('settings.resources.testing') : t('settings.resources.testConn')}
                </button>
              </div>
              {gitStatus === 'ok' && <div className="mt-1 text-xs text-emerald-500">✓ {gitMsg}</div>}
              {gitStatus === 'fail' && <div className="mt-1 text-xs text-red-500">✗ {gitMsg}</div>}
            </div>
            <div className="text-xs text-[var(--app-hint)]">{t('settings.resources.issuesHint')}</div>
          </div>
        )}
      </div>

      {/* 知识库 */}
      <div className="border-b border-[var(--app-divider)]">
        <ToggleRow label={t('settings.resources.knowledge')} enabled={obsidianEnabled} onChange={setObsidianEnabled}
          status={obsidianStatus === 'ok' ? t('settings.resources.detected') : undefined} statusOk />
        {obsidianEnabled && (
          <div className="px-3 pb-3">
            <Label text={t('settings.resources.vaultPath')} />
            <div className="flex gap-2">
              <input value={obsidianPath} onChange={e => setObsidianPath(e.target.value)}
                placeholder="~/Library/.../ObsidianVault"
                className="flex-1 rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-sm text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]" />
              <button onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.webkitdirectory = true; inp.click() }}
                className="shrink-0 rounded border border-[var(--app-divider)] px-3 py-1.5 text-xs text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]">
                {t('settings.resources.browse')}
              </button>
            </div>
            {obsidianStatus === 'ok' && <div className="mt-1 text-xs text-emerald-500">✓ {t('settings.resources.pathValid')}</div>}
            {obsidianStatus === 'fail' && <div className="mt-1 text-xs text-red-500">✗ {t('settings.resources.pathInvalid')}</div>}
            <div className="mt-1 text-xs text-[var(--app-hint)]">{t('settings.resources.knowledgeHint')}</div>
          </div>
        )}
      </div>

      {/* 议题通知 */}
      <div className="border-b border-[var(--app-divider)]">
        <div className="flex w-full items-center justify-between px-3 py-2.5">
          <span className="text-[var(--app-fg)] text-sm">议题通知</span>
          <button type="button" onClick={() => { setNotifyEnabled(!notifyEnabled); saveNotify() }}
            className={`relative h-5 w-9 rounded-full transition-colors ${notifyEnabled ? 'bg-[var(--app-link)]' : 'bg-[var(--app-divider)]'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${notifyEnabled ? 'left-4' : 'left-0.5'}`} />
          </button>
        </div>
        {notifyEnabled && (
          <div className="px-3 pb-3 space-y-2">
            <div>
              <Label text="检查频率" />
              <select value={notifyInterval} onChange={e => { setNotifyInterval(Number(e.target.value)); setTimeout(saveNotify, 0) }}
                className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-sm text-[var(--app-fg)] outline-none focus:border-[var(--app-link)]">
                <option value={5}>每 5 分钟</option>
                <option value={10}>每 10 分钟</option>
                <option value={30}>每 30 分钟</option>
                <option value={60}>每小时</option>
                <option value={360}>每 6 小时</option>
                <option value={1440}>每天</option>
              </select>
            </div>
            <div className="text-xs text-[var(--app-hint)]">
              检查 GitLab 是否有新指派给你的议题，发现后推送通知。
            </div>
          </div>
        )}
      </div>

      {/* 计算与数据资源 */}
      <div className="border-b border-[var(--app-divider)]">
        <div className="flex w-full items-center justify-between px-3 py-2.5">
          <span className="text-[var(--app-fg)] text-sm">{t('settings.resources.compute')}</span>
        </div>
        <div className="px-3 pb-3 flex flex-wrap gap-1.5">
          {machines.map((m, i) => (
            <button key={i} type="button" onClick={() => setEditMachine(m)}
              className="rounded bg-[var(--app-subtle-bg)] px-2 py-1 text-xs text-[var(--app-fg)] hover:bg-[var(--app-secondary-bg)] transition-colors">
              {m.name || m.host}{m.host !== m.name ? ` (${m.host})` : ''}
            </button>
          ))}
          <button type="button" onClick={() => setShowAddMachine(true)}
            className="rounded border border-dashed border-[var(--app-divider)] px-2 py-1 text-xs text-[var(--app-hint)] hover:border-[var(--app-link)] hover:text-[var(--app-link)] transition-colors">
            + 添加
          </button>
        </div>
      </div>

      {/* Compute Dialog */}
      {(editMachine || showAddMachine) && (
        <ComputeDialog
          machine={editMachine}
          dataStats={fanFilesStatus}
          onSave={(m) => {
            if (editMachine) {
              const idx = machines.indexOf(editMachine)
              const updated = [...machines]
              updated[idx] = m
              saveMachines(updated)
            } else {
              saveMachines([...machines, m])
            }
            setEditMachine(null)
            setShowAddMachine(false)
          }}
          onDelete={editMachine ? () => {
            saveMachines(machines.filter(x => x !== editMachine))
            setEditMachine(null)
          } : undefined}
          onClose={() => { setEditMachine(null); setShowAddMachine(false) }}
        />
      )}

      <div className="px-3 py-3">
        <button onClick={saveResources}
          className="w-full rounded-md bg-[var(--app-link)] px-4 py-2 text-sm font-medium text-white
                     transition-opacity hover:opacity-90">
          {t('settings.resources.save')}
        </button>
        <div className="mt-1 text-center text-xs text-[var(--app-hint)]">
          {t('settings.resources.saveHint')}
        </div>
      </div>
    </div>
  )
}

function ToggleRow(props: {
  label: string; enabled: boolean; onChange?: (v: boolean) => void
  status?: string; statusOk?: boolean
  machineCount?: number; machines?: string[]
}) {
  return (
    <>
      <div className="flex w-full items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[var(--app-fg)] text-sm">{props.label}</span>
          {props.status && (
            <span className={`rounded px-1.5 py-0.5 text-xs ${props.statusOk ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--app-subtle-bg)] text-[var(--app-hint)]'}`}>
              {props.status}
            </span>
          )}
          {props.machineCount !== undefined && (
            <span className="rounded bg-[var(--app-subtle-bg)] px-1.5 py-0.5 text-xs text-[var(--app-hint)]">
              {props.machineCount} {props.machineCount === 1 ? 'machine' : 'machines'}
            </span>
          )}
        </div>
        {props.onChange && (
          <button type="button" onClick={() => props.onChange?.(!props.enabled)}
            className={`relative h-5 w-9 rounded-full transition-colors ${props.enabled ? 'bg-[var(--app-link)]' : 'bg-[var(--app-divider)]'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${props.enabled ? 'left-4' : 'left-0.5'}`} />
          </button>
        )}
      </div>
      {props.machines && props.machines.length > 0 && (
        <div className="px-3 pb-3 flex flex-wrap gap-1">
          {props.machines.slice(0, 8).map(h => (
            <span key={h} className="rounded bg-[var(--app-subtle-bg)] px-2 py-0.5 text-xs text-[var(--app-fg)]">{h}</span>
          ))}
          {props.machines.length > 8 && (
            <span className="rounded bg-[var(--app-subtle-bg)] px-2 py-0.5 text-xs text-[var(--app-hint)]">+{props.machines.length - 8}</span>
          )}
        </div>
      )}
    </>
  )
}

function Label(props: { text: string }) {
  return <div className="mb-1 text-xs text-[var(--app-hint)]">{props.text}</div>
}

import { useState, useEffect } from 'react'

export function ResourceSettings() {
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

  const [machineCount, setMachineCount] = useState(0)
  const [machines, setMachines] = useState<string[]>([])

  useEffect(() => {
    fetch('/shell/config')
      .then(r => r.json())
      .then(d => {
        if (d.configured) {
          if (d.gitlab?.url) setGitUrl(d.gitlab.url)
          if (d.gitlab?.token) setGitToken(d.gitlab.token)
          if (d.gitlab?.provider) setGitProvider(d.gitlab.provider)
          if (typeof d.gitlab?.enabled === 'boolean') setGitlabEnabled(d.gitlab.enabled)
          if (d.obsidian?.vaultPath) setObsidianPath(d.obsidian.vaultPath)
          if (typeof d.obsidian?.enabled === 'boolean') setObsidianEnabled(d.obsidian.enabled)
        }
      })
      .catch(() => {})

    fetch('/shell/setup/detect')
      .then(r => r.json())
      .then(d => {
        if (!obsidianPath && d.obsidian?.vaults?.length) setObsidianPath(d.obsidian.vaults[0].path)
        if (d.machines) {
          setMachines(d.machines.map((m: any) => m.host))
          setMachineCount(d.machines.length)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!obsidianPath) { setObsidianStatus('idle'); return }
    fetch('/shell/obsidian/tree?path=')
      .then(r => { setObsidianStatus(r.ok ? 'ok' : 'fail') })
      .catch(() => setObsidianStatus('fail'))
  }, [obsidianPath])

  function testGit() {
    setGitStatus('testing')
    setGitMsg('')
    fetch('/shell/issues?q=&force=1')
      .then(r => r.json())
      .then(d => {
        if (d.issues?.length > 0) {
          setGitStatus('ok')
          setGitMsg(`${d.issues.length} issues 可访问`)
        } else {
          setGitStatus('fail')
          setGitMsg('无法获取 Issues。检查地址和 Token')
        }
      })
      .catch(err => {
        setGitStatus('fail')
        setGitMsg(err.message || '连接失败')
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

        {/* 议题 (Git Issues) */}
        <Section label="议题" enabled={gitlabEnabled} onChange={setGitlabEnabled}
          status={gitStatus === 'ok' ? '已连接' : gitStatus === 'fail' ? '连接失败' : undefined}
          statusOk={gitStatus === 'ok'} />
        {gitlabEnabled && (
          <div className="px-3 pb-3 space-y-2">
            {/* Provider selector */}
            <div>
              <Label text="Git 服务" />
              <select value={gitProvider} onChange={e => setGitProvider(e.target.value as any)}
                className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-[11px] text-[var(--app-fg)] outline-none focus:border-[var(--app-link)]">
                <option value="gitlab">GitLab</option>
                <option value="github">GitHub</option>
              </select>
            </div>
            <InputField label="URL" value={gitUrl} onChange={setGitUrl}
              placeholder={gitProvider === 'gitlab' ? 'http://your-gitlab.com' : 'https://github.com'} />
            <div>
              <Label text="Access Token" />
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={gitToken} onChange={e => setGitToken(e.target.value)}
                    placeholder={gitProvider === 'gitlab' ? 'glpat-...' : 'ghp_...'}
                    className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1 pr-8 text-[11px] text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]" />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-[10px] text-[var(--app-hint)] hover:text-[var(--app-fg)]"
                    title={showToken ? '隐藏' : '显示'}>
                    {showToken ? '🙈' : '👁'}
                  </button>
                </div>
                <button onClick={testGit}
                  disabled={gitStatus === 'testing'}
                  className="shrink-0 rounded border border-[var(--app-divider)] px-3 py-1 text-[10px] text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] disabled:opacity-50">
                  {gitStatus === 'testing' ? '测试中...' : '测试连接'}
                </button>
              </div>
              {gitStatus === 'ok' && <div className="mt-1 text-[10px] text-emerald-500">✓ {gitMsg}</div>}
              {gitStatus === 'fail' && <div className="mt-1 text-[10px] text-red-500">✗ {gitMsg}</div>}
            </div>
            <div className="text-[9px] text-[var(--app-hint)]">
              支持 GitLab 和 GitHub。关闭开关可隐藏「议题」Tab。
            </div>
          </div>
        )}
      </div>

      {/* 知识库 */}
      <div className="border-b border-[var(--app-divider)]">
        <Section label="知识库" enabled={obsidianEnabled} onChange={setObsidianEnabled}
          status={obsidianStatus === 'ok' ? '已检测' : undefined} statusOk />
        {obsidianEnabled && (
          <div className="px-3 pb-3">
            <Label text="Vault 路径" />
            <div className="flex gap-2">
              <input value={obsidianPath} onChange={e => setObsidianPath(e.target.value)}
                placeholder="~/Library/.../ObsidianVault"
                className="flex-1 rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1 text-[11px] text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]" />
              <button
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.webkitdirectory = true
                  input.click()
                }}
                className="shrink-0 rounded border border-[var(--app-divider)] px-3 py-1 text-[10px] text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]">
                浏览...
              </button>
            </div>
            {obsidianStatus === 'ok' && <div className="mt-1 text-[10px] text-emerald-500">✓ 路径有效</div>}
            {obsidianStatus === 'fail' && <div className="mt-1 text-[10px] text-red-500">✗ 路径无效</div>}
            <div className="mt-1 text-[9px] text-[var(--app-hint)]">
              Obsidian Vault 路径。关闭开关可隐藏「知识库」Tab。
            </div>
          </div>
        )}
      </div>

      {/* 计算资源 */}
      <div className="border-b border-[var(--app-divider)]">
        <Section label="计算资源" enabled machineCount={machineCount} machines={machines} />
      </div>

      {/* Save */}
      <div className="px-3 py-3">
        <button onClick={saveResources}
          className="w-full rounded-md bg-[var(--app-link)] px-4 py-2 text-[11px] font-medium text-white
                     transition-opacity hover:opacity-90">
          保存资源设置
        </button>
        <div className="mt-1 text-center text-[9px] text-[var(--app-hint)]">
          关闭资源开关后，对应 Tab 将在刷新后隐藏
        </div>
      </div>
    </div>
  )
}

function Section(props: {
  label: string
  enabled: boolean
  onChange?: (v: boolean) => void
  status?: string
  statusOk?: boolean
  machineCount?: number
  machines?: string[]
}) {
  return (
    <>
      <div className="flex w-full items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[var(--app-fg)] text-sm">{props.label}</span>
          {props.status && (
            <span className={`rounded px-1.5 py-0.5 text-[9px] ${
              props.statusOk ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--app-subtle-bg)] text-[var(--app-hint)]'
            }`}>
              {props.status}
            </span>
          )}
          {props.machineCount !== undefined && (
            <span className="rounded bg-[var(--app-subtle-bg)] px-1.5 py-0.5 text-[9px] text-[var(--app-hint)]">
              {props.machineCount} 台
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
            <span key={h} className="rounded bg-[var(--app-subtle-bg)] px-2 py-0.5 text-[10px] text-[var(--app-fg)]">{h}</span>
          ))}
          {props.machines.length > 8 && (
            <span className="rounded bg-[var(--app-subtle-bg)] px-2 py-0.5 text-[10px] text-[var(--app-hint)]">+{props.machines.length - 8} 更多</span>
          )}
        </div>
      )}
    </>
  )
}

function InputField(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label text={props.label} />
      <input value={props.value} onChange={e => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1 text-[11px] text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]" />
    </div>
  )
}

function Label(props: { text: string }) {
  return <div className="mb-1 text-[10px] text-[var(--app-hint)]">{props.text}</div>
}

import { useState, useEffect } from 'react'

interface ResourceConfig {
  gitlab?: {
    enabled: boolean
    url: string
    token: string
  }
  obsidian?: {
    enabled: boolean
    vaultPath: string
  }
  compute?: {
    enabled: boolean
  }
}

export function ResourceSettings() {
  const [config, setConfig] = useState<ResourceConfig>({})
  const [gitlabUrl, setGitlabUrl] = useState('')
  const [gitlabToken, setGitlabToken] = useState('')
  const [gitlabStatus, setGitlabStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [gitlabMsg, setGitlabMsg] = useState('')
  const [gitlabEnabled, setGitlabEnabled] = useState(true)

  const [obsidianPath, setObsidianPath] = useState('')
  const [obsidianEnabled, setObsidianEnabled] = useState(true)
  const [obsidianStatus, setObsidianStatus] = useState<'idle' | 'ok' | 'fail'>('idle')

  const [computeEnabled, setComputeEnabled] = useState(true)
  const [machineCount, setMachineCount] = useState(0)
  const [machines, setMachines] = useState<string[]>([])

  // Load config + detection
  useEffect(() => {
    // Load saved config
    fetch('/shell/config')
      .then(r => r.json())
      .then(d => {
        if (d.configured) {
          setConfig(d)
          if (d.gitlab?.url) setGitlabUrl(d.gitlab.url)
          if (d.gitlab?.token) setGitlabToken(d.gitlab.token)
          if (typeof d.gitlab?.enabled === 'boolean') setGitlabEnabled(d.gitlab.enabled)
          if (d.obsidian?.vaultPath) setObsidianPath(d.obsidian.vaultPath)
          if (typeof d.obsidian?.enabled === 'boolean') setObsidianEnabled(d.obsidian.enabled)
          if (typeof d.compute?.enabled === 'boolean') setComputeEnabled(d.compute.enabled)
        }
      })
      .catch(() => {})

    // Load detection data
    fetch('/shell/setup/detect')
      .then(r => r.json())
      .then(d => {
        // Auto-fill from detection if not set
        if (!obsidianPath && d.obsidian?.vaults?.length) {
          setObsidianPath(d.obsidian.vaults[0].path)
        }
        if (d.gitlab?.found && !gitlabUrl) {
          // glab detection doesn't give us the URL easily, keep what user set
        }
        if (d.machines) {
          setMachines(d.machines.map((m: any) => m.host))
          setMachineCount(d.machines.length)
        }
      })
      .catch(() => {})
  }, [])

  // Verify obsidian path
  useEffect(() => {
    if (!obsidianPath) { setObsidianStatus('idle'); return }
    fetch(`/shell/obsidian/tree?path=`)
      .then(r => { setObsidianStatus(r.ok ? 'ok' : 'fail') })
      .catch(() => setObsidianStatus('fail'))
  }, [obsidianPath])

  // Test GitLab connection
  function testGitlab() {
    setGitlabStatus('testing')
    setGitlabMsg('')
    fetch(`/shell/issues?q=&force=1`)
      .then(r => r.json())
      .then(d => {
        if (d.issues?.length > 0) {
          setGitlabStatus('ok')
          setGitlabMsg(`${d.issues.length} issues 可访问`)
        } else {
          setGitlabStatus('fail')
          setGitlabMsg('无法获取 Issues。检查 Token 和 URL')
        }
      })
      .catch(err => {
        setGitlabStatus('fail')
        setGitlabMsg(err.message || '连接失败')
      })
  }

  // Save resource config
  function saveResources() {
    fetch('/shell/setup/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...config,
        gitlab: { enabled: gitlabEnabled, url: gitlabUrl, token: gitlabToken },
        obsidian: { enabled: obsidianEnabled, vaultPath: obsidianPath },
        compute: { enabled: computeEnabled }
      })
    }).then(() => {
      // Reload to apply tab changes
      window.location.reload()
    }).catch(() => {})
  }

  return (
    <div>
      {/* GitLab */}
      <div className="border-b border-[var(--app-divider)]">
        <div className="px-3 py-2 text-xs font-semibold text-[var(--app-hint)] uppercase tracking-wide">
          Resources
        </div>

        {/* GitLab row */}
        <ToggleRow label="GitLab" enabled={gitlabEnabled} onChange={setGitlabEnabled}
          status={gitlabStatus === 'ok' ? '已连接' : gitlabStatus === 'fail' ? '连接失败' : undefined}
          statusOk={gitlabStatus === 'ok'} />
        {gitlabEnabled && (
          <div className="px-3 pb-3 space-y-2">
            <InputField label="URL" value={gitlabUrl} onChange={setGitlabUrl} placeholder="http://182.92.166.143:8929" />
            <div>
              <Label text="Access Token" />
              <div className="flex gap-2">
                <input type="password" value={gitlabToken} onChange={e => setGitlabToken(e.target.value)}
                  placeholder="glpat-..."
                  className="flex-1 rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1 text-[11px] text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]" />
                <button onClick={testGitlab}
                  disabled={gitlabStatus === 'testing'}
                  className="shrink-0 rounded border border-[var(--app-divider)] px-3 py-1 text-[10px] text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] disabled:opacity-50">
                  {gitlabStatus === 'testing' ? '测试中...' : '测试连接'}
                </button>
              </div>
              {gitlabStatus === 'ok' && (
                <div className="mt-1 text-[10px] text-emerald-500">✓ {gitlabMsg}</div>
              )}
              {gitlabStatus === 'fail' && (
                <div className="mt-1 text-[10px] text-red-500">✗ {gitlabMsg}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Obsidian */}
      <div className="border-b border-[var(--app-divider)]">
        <ToggleRow label="Obsidian 知识库" enabled={obsidianEnabled} onChange={setObsidianEnabled}
          status={obsidianStatus === 'ok' ? '已检测' : undefined} statusOk />
        {obsidianEnabled && (
          <div className="px-3 pb-3">
            <Label text="Vault 路径" />
            <div className="flex gap-2">
              <input value={obsidianPath} onChange={e => setObsidianPath(e.target.value)}
                className="flex-1 rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1 text-[11px] text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]" />
              <button
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.webkitdirectory = true
                  input.onchange = (e: any) => {
                    const files = e.target?.files
                    if (files?.[0]) {
                      // Extract directory path from file path
                      const fp = files[0].webkitRelativePath || ''
                      setObsidianPath(fp ? obsidianPath : obsidianPath)
                    }
                  }
                  input.click()
                }}
                className="shrink-0 rounded border border-[var(--app-divider)] px-3 py-1 text-[10px] text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]">
                浏览...
              </button>
            </div>
            {obsidianStatus === 'ok' && (
              <div className="mt-1 text-[10px] text-emerald-500">✓ 路径有效</div>
            )}
            {obsidianStatus === 'fail' && (
              <div className="mt-1 text-[10px] text-red-500">✗ 路径无效</div>
            )}
          </div>
        )}
      </div>

      {/* Compute Resources */}
      <div className="border-b border-[var(--app-divider)]">
        <ToggleRow label="计算资源" enabled={computeEnabled} onChange={setComputeEnabled}
          status={`${machineCount} 台`} statusOk />
        {computeEnabled && machines.length > 0 && (
          <div className="px-3 pb-3 flex flex-wrap gap-1">
            {machines.slice(0, 8).map(h => (
              <span key={h} className="rounded bg-[var(--app-subtle-bg)] px-2 py-0.5 text-[10px] text-[var(--app-fg)]">{h}</span>
            ))}
            {machines.length > 8 && (
              <span className="rounded bg-[var(--app-subtle-bg)] px-2 py-0.5 text-[10px] text-[var(--app-hint)]">+{machines.length - 8} 更多</span>
            )}
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="px-3 py-3">
        <button onClick={saveResources}
          className="w-full rounded-md bg-[var(--app-link)] px-4 py-2 text-[11px] font-medium text-white
                     transition-opacity hover:opacity-90">
          保存资源设置
        </button>
        <div className="mt-1 text-center text-[9px] text-[var(--app-hint)]">
          关闭资源开关后，对应 Tab 将在下次刷新后隐藏
        </div>
      </div>
    </div>
  )
}

function ToggleRow(props: {
  label: string
  enabled: boolean
  onChange: (v: boolean) => void
  status?: string
  statusOk?: boolean
}) {
  return (
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
      </div>
      <button
        type="button"
        onClick={() => props.onChange(!props.enabled)}
        className={`relative h-5 w-9 rounded-full transition-colors ${
          props.enabled ? 'bg-[var(--app-link)]' : 'bg-[var(--app-divider)]'
        }`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
          props.enabled ? 'left-4' : 'left-0.5'
        }`} />
      </button>
    </div>
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

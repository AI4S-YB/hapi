import { useState } from 'react'

export interface MachineConfig {
  name: string
  host: string
  port: number
  user: string
  authMethod: 'key' | 'password'
  keyPath: string
  description: string
  dataPaths: string[]
}

interface Props {
  machine: MachineConfig | null
  dataStats?: { indexedFiles?: number; servers?: Array<{ name: string; files: number }> } | null
  onSave: (m: MachineConfig) => void
  onDelete?: () => void
  onClose: () => void
}

const defaults: MachineConfig = {
  name: '', host: '', port: 22, user: 'root',
  authMethod: 'key', keyPath: '~/.ssh/id_ed25519',
  description: '', dataPaths: []
}

export function ComputeDialog(props: Props) {
  const [m, setM] = useState<MachineConfig>(props.machine || defaults)
  const [newDataPath, setNewDataPath] = useState('')

  // Find matching fan-files server
  const ffServer = props.dataStats?.servers?.find(s => s.name === m.name)

  function addDataPath() {
    if (!newDataPath.trim()) return
    setM({ ...m, dataPaths: [...m.dataPaths, newDataPath.trim()] })
    setNewDataPath('')
  }

  function removeDataPath(idx: number) {
    setM({ ...m, dataPaths: m.dataPaths.filter((_, i) => i !== idx) })
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[460px] max-w-[95vw] max-h-[88vh] overflow-y-auto rounded-xl border
                      border-[var(--app-border)] bg-[var(--app-bg)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3">
          <span className="text-sm font-semibold text-[var(--app-fg)]">
            {props.machine ? m.name || '编辑' : '添加计算资源'}
          </span>
          <button onClick={props.onClose}
            className="rounded p-1 text-[var(--app-hint)] hover:text-[var(--app-fg)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ====== 计算资源 ====== */}
        <div className="border-b border-[var(--app-border)]">
          <div className="px-4 py-2 text-xs font-semibold text-[var(--app-hint)] uppercase tracking-wide bg-[var(--app-subtle-bg)]/50">
            计算资源
          </div>
          <div className="space-y-2.5 px-4 py-3">
            <Field label="名称">
              <input value={m.name} onChange={e => setM({...m, name: e.target.value})}
                placeholder="dev-server"
                className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-sm text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]" />
            </Field>

            <div className="flex gap-2">
              <div className="flex-1"><Field label="主机地址">
                <input value={m.host} onChange={e => setM({...m, host: e.target.value})}
                  placeholder="dev-server 或 47.95.117.10"
                  className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-sm text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]" />
                <div className="mt-0.5 text-[10px] text-[var(--app-hint)]">SSH 主机名或 IP 地址</div>
              </Field></div>
              <div className="w-20"><Field label="端口">
                <input type="number" value={m.port} onChange={e => setM({...m, port: Number(e.target.value) || 22})}
                  className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-sm text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]" />
              </Field></div>
            </div>

            <Field label="SSH 用户">
              <input value={m.user} onChange={e => setM({...m, user: e.target.value})}
                className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-sm text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]" />
            </Field>

            <Field label="认证方式">
              <select value={m.authMethod} onChange={e => setM({...m, authMethod: e.target.value as any})}
                className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-sm text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]">
                <option value="key">SSH 密钥</option>
                <option value="password">密码</option>
              </select>
            </Field>

            {m.authMethod === 'key' && (
              <Field label="密钥路径">
                <input value={m.keyPath} onChange={e => setM({...m, keyPath: e.target.value})}
                  className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-sm text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]" />
              </Field>
            )}

            <Field label="描述 / 用途">
              <textarea rows={2} value={m.description} onChange={e => setM({...m, description: e.target.value})}
                placeholder="GPU 型号、内存、用途..."
                className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-sm text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)] resize-y" />
            </Field>
          </div>
        </div>

        {/* ====== 数据资源 ====== */}
        <div>
          <div className="px-4 py-2 text-xs font-semibold text-[var(--app-hint)] uppercase tracking-wide bg-[var(--app-subtle-bg)]/50">
            数据资源
          </div>
          <div className="space-y-2.5 px-4 py-3">
            {/* fan-files stats */}
            {ffServer && (
              <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-emerald-500 font-medium">fan-files</span>
                  <span className="text-[var(--app-fg)]">{ffServer.files.toLocaleString()} 文件已索引</span>
                </div>
              </div>
            )}

            {/* Data paths */}
            <Field label="扫描路径">
              <div className="space-y-1.5">
                {m.dataPaths.map((p, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="flex-1 rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1 text-xs text-[var(--app-fg)]">{p}</span>
                    <button onClick={() => removeDataPath(i)}
                      className="shrink-0 rounded p-1 text-[10px] text-[var(--app-hint)] hover:text-red-500">✕</button>
                  </div>
                ))}
                <div className="flex gap-1">
                  <input value={newDataPath} onChange={e => setNewDataPath(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDataPath() } }}
                    placeholder="/data/biodata"
                    className="flex-1 w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-xs text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]" />
                  <button onClick={addDataPath}
                    className="shrink-0 rounded border border-dashed border-[var(--app-divider)] px-2 py-1 text-xs text-[var(--app-hint)] hover:border-[var(--app-link)] hover:text-[var(--app-link)]">
                    + 添加
                  </button>
                </div>
              </div>
            </Field>
            <div className="text-[10px] text-[var(--app-hint)]">
              这些路径将被 fan-files 扫描和索引。添加后需要在 fan-files 中配置对应的 server。
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-[var(--app-border)] px-4 py-3">
          {props.onDelete ? (
            <button onClick={props.onDelete}
              className="rounded border border-red-500/30 px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10">
              删除
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={props.onClose}
              className="rounded border border-[var(--app-divider)] px-3 py-1.5 text-xs text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]">
              取消
            </button>
            <button onClick={() => props.onSave(m)}
              className="rounded bg-[var(--app-link)] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90">
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs text-[var(--app-hint)]">{props.label}</div>
      {props.children}
    </div>
  )
}

import { useState } from 'react'

export interface MachineConfig {
  name: string
  host: string
  port: number
  user: string
  authMethod: 'key' | 'password'
  keyPath: string
  description: string
}

interface Props {
  machine: MachineConfig | null  // null = adding new
  dataStats?: { indexedFiles?: number; servers?: Array<{name: string; files: number}> } | null
  onSave: (m: MachineConfig) => void
  onDelete?: () => void
  onClose: () => void
}

const defaults: MachineConfig = {
  name: '', host: '', port: 22, user: 'root',
  authMethod: 'key', keyPath: '~/.ssh/id_ed25519', description: ''
}

export function ComputeDialog(props: Props) {
  const [m, setM] = useState<MachineConfig>(props.machine || defaults)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[420px] max-w-[95vw] max-h-[85vh] overflow-y-auto rounded-xl border
                      border-[var(--app-border)] bg-[var(--app-bg)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3">
          <span className="text-sm font-semibold text-[var(--app-fg)]">
            {props.machine ? '编辑计算资源' : '添加计算资源'}
          </span>
          <button onClick={props.onClose}
            className="rounded p-1 text-[var(--app-hint)] hover:text-[var(--app-fg)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-3 px-4 py-3">
          <Field label="名称">
            <input value={m.name} onChange={e => setM({...m, name: e.target.value})}
              className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-sm text-[var(--app-fg)] outline-none focus:border-[var(--app-link)]" />
          </Field>

          <div className="flex gap-2">
            <div className="flex-1"><Field label="主机地址">
              <input value={m.host} onChange={e => setM({...m, host: e.target.value})}
                placeholder="dev-server 或 your-server.com"
                className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-sm text-[var(--app-fg)] outline-none focus:border-[var(--app-link)]" />
              <div className="mt-0.5 text-[10px] text-[var(--app-hint)]">SSH 主机名，非 IP 地址</div>
            </Field></div>
            <div className="w-20"><Field label="端口">
              <input type="number" value={m.port} onChange={e => setM({...m, port: Number(e.target.value) || 22})}
                className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-sm text-[var(--app-fg)] outline-none focus:border-[var(--app-link)]" />
            </Field></div>
          </div>

          <Field label="SSH 用户">
            <input value={m.user} onChange={e => setM({...m, user: e.target.value})}
              className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-sm text-[var(--app-fg)] outline-none focus:border-[var(--app-link)]" />
          </Field>

          <Field label="认证方式">
            <select value={m.authMethod} onChange={e => setM({...m, authMethod: e.target.value as any})}
              className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-sm text-[var(--app-fg)] outline-none focus:border-[var(--app-link)]">
              <option value="key">SSH 密钥</option>
              <option value="password">密码</option>
            </select>
          </Field>

          {m.authMethod === 'key' && (
            <Field label="密钥路径">
              <input value={m.keyPath} onChange={e => setM({...m, keyPath: e.target.value})}
                className="w-full rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-sm text-[var(--app-fg)] outline-none focus:border-[var(--app-link)]" />
            </Field>
          )}

          {/* fan-files data stats — only if this machine has scanned data */}
          {props.dataStats?.servers?.filter(s => s.name === m.name).map(s => (
            <div key={s.name} className="rounded-md bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-emerald-500 font-medium">📊 fan-files</span>
                <span className="text-[var(--app-fg)]">{s.files.toLocaleString()} 文件已索引</span>
              </div>
              <div className="mt-1 text-[10px] text-[var(--app-hint)]">路径: /data/biodata · 扫描于 fan-files config</div>
            </div>
          ))}

          <Field label="描述 / 用途">
            <textarea rows={3} value={m.description} onChange={e => setM({...m, description: e.target.value})}
              placeholder="GPU 型号、内存、用途等..."
              className="w-full resize-y rounded border border-[var(--app-divider)] bg-[var(--app-bg)] px-2 py-1.5 text-sm text-[var(--app-fg)] outline-none placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)]" />
          </Field>
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

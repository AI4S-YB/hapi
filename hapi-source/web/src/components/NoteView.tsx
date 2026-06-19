import { useState, useEffect } from 'react'

interface NoteData {
  path: string
  title: string
  content: string
  modifiedAt: string
}

export function NoteView(props: {
  notePath: string
  onDiscuss?: () => void
}) {
  const [note, setNote] = useState<NoteData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/shell/note?path=${encodeURIComponent(props.notePath)}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json() })
      .then(d => { if (d.error) throw new Error(d.error); setNote(d) })
      .catch(err => setError(err.message))
  }, [props.notePath])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center text-sm text-red-500">{error}</div>
      </div>
    )
  }

  if (!note) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-sm text-[var(--app-hint)]">加载中...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-[var(--app-border)] px-4 py-3">
        <div className="mb-1 flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-[var(--app-hint)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="text-[10px] text-[var(--app-hint)]">{note.path}</span>
        </div>
        <h2 className="text-sm font-semibold text-[var(--app-fg)]">{note.title}</h2>
        <div className="mt-1 text-[10px] text-[var(--app-hint)]">
          {new Date(note.modifiedAt).toLocaleDateString('zh-CN')}
        </div>
      </div>

      <div className="app-scroll-y flex-1 min-h-0 px-4 py-3">
        <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--app-fg)]">
          {note.content}
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--app-border)] px-4 py-2.5 flex gap-2">
        <a
          href={`http://${window.location.hostname}:8686/note?path=${encodeURIComponent(note.path)}`}
          target="_blank" rel="noopener noreferrer"
          className="flex-1 rounded-md border border-[var(--app-border)] px-4 py-1.5 text-center text-[11px] text-[var(--app-fg)]
                     no-underline transition-colors hover:bg-[var(--app-subtle-bg)]">
          Obsidian 打开 ↗
        </a>
        {props.onDiscuss && (
          <button onClick={props.onDiscuss}
            className="rounded-md bg-[var(--app-link)] px-3 py-1.5 text-[11px] font-medium text-white
                       transition-opacity hover:opacity-90">
            讨论
          </button>
        )}
      </div>
    </div>
  )
}

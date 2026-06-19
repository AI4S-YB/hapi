import { useState, useEffect } from 'react'

interface CommentData {
  author: string
  body: string
  createdAt: string
}

interface IssueData {
  iid: string
  repo: string
  title: string
  state: string
  author: string
  labels: string
  comments: string
  description: string
}

export function IssueView(props: {
  repo: string
  iid: string
  onDiscuss?: () => void
}) {
  const [issue, setIssue] = useState<IssueData | null>(null)
  const [comments, setComments] = useState<CommentData[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/shell/issue?repo=${encodeURIComponent(props.repo)}&iid=${encodeURIComponent(props.iid)}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json() })
      .then(d => { if (d.error) throw new Error(d.error); setIssue(d) })
      .catch(err => setError(err.message))

    fetch(`/shell/issue/comments?repo=${encodeURIComponent(props.repo)}&iid=${encodeURIComponent(props.iid)}`)
      .then(r => r.json())
      .then(d => { if (d.comments) setComments(d.comments) })
      .catch(() => {})
  }, [props.repo, props.iid])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center text-sm text-red-500">{error}</div>
      </div>
    )
  }

  if (!issue) {
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
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold
            ${issue.state === 'open' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--app-border)] text-[var(--app-hint)]'}`}>
            {`!${issue.iid} · ${issue.state}`}
          </span>
          <span className="text-[10px] text-[var(--app-hint)]">{issue.repo}</span>
        </div>
        <h2 className="text-sm font-semibold text-[var(--app-fg)]">{issue.title}</h2>
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-[var(--app-hint)]">
          <span>作者: {issue.author}</span>
          <span>💬 {issue.comments} 评论</span>
          {issue.labels && <span className="rounded bg-[var(--app-subtle-bg)] px-1 py-0.5">{issue.labels}</span>}
        </div>
      </div>

      <div className="app-scroll-y flex-1 min-h-0 px-4 py-3">
        <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--app-fg)]">
          {issue.description || '(无描述)'}
        </div>

        {comments.length > 0 && (
          <div className="mt-4 border-t border-[var(--app-border)] pt-3">
            <div className="mb-2 text-[10px] font-medium text-[var(--app-hint)]">
              {`评论 (${comments.length})`}
            </div>
            {comments.map((c, i) => (
              <div key={i} className="mb-2 rounded-md bg-[var(--app-subtle-bg)] px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[var(--app-fg)]">{c.author}</span>
                  <span className="text-[9px] text-[var(--app-hint)]">
                    {new Date(c.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
                <div className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--app-fg)]">
                  {c.body}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--app-border)] px-4 py-2.5 flex gap-2">
        {props.onDiscuss && (
          <button onClick={props.onDiscuss}
            className="flex-1 rounded-md bg-[var(--app-link)] px-4 py-1.5 text-[11px] font-medium text-white
                       transition-opacity hover:opacity-90">
            讨论这个 Issue
          </button>
        )}
        <a href={`http://${window.location.hostname}:8080`} target="_blank" rel="noopener noreferrer"
          className="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-[11px] text-[var(--app-hint)]
                     no-underline transition-colors hover:bg-[var(--app-subtle-bg)]">
          GitLab ↗
        </a>
      </div>
    </div>
  )
}

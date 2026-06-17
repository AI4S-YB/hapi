import { useState, useEffect, useRef, useCallback } from 'react'

interface SearchResult {
  source: 'obsidian' | 'gitlab'
  title: string
  subtitle: string
  url: string
}

export function SearchModal(props: {
  isOpen: boolean
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [activeIdx, setActiveIdx] = useState(-1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input + reset state when opened
  useEffect(() => {
    if (props.isOpen && inputRef.current) {
      inputRef.current.focus()
      setQuery('')
      setResults([])
      setActiveIdx(-1)
      setIsLoading(false)
      setError(null)
    }
  }, [props.isOpen])

  // Real API search
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([])
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)
    setActiveIdx(-1)

    try {
      const res = await fetch(`/shell/search?q=${encodeURIComponent(q.trim())}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      const combined: SearchResult[] = [
        ...(data.obsidian || []).map((r: { path: string; title: string }) => ({
          source: 'obsidian' as const,
          title: r.title,
          subtitle: r.path,
          url: ''
        })),
        ...(data.gitlab || []).map((r: { iid: string; title: string }) => ({
          source: 'gitlab' as const,
          title: `!${r.iid} ${r.title}`,
          subtitle: r.title,
          url: ''
        }))
      ]
      setResults(combined)
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败')
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => { void doSearch(query) }, 250)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  // Keyboard: navigation + Escape + Enter
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      props.onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, results.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter' && activeIdx >= 0 && results[activeIdx]) {
      e.preventDefault()
      props.onClose()
    }
  }

  if (!props.isOpen) return null

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={props.onClose}
      />

      {/* Modal */}
      <div className="absolute left-1/2 top-[15%] w-[560px] max-w-[90vw] -translate-x-1/2
                      overflow-hidden rounded-xl bg-[var(--app-bg)] shadow-2xl
                      border border-[var(--app-border)]">
        {/* Input bar */}
        <div className="flex items-center gap-2 border-b border-[var(--app-border)] px-4 py-3">
          <span className="text-base shrink-0">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索知识库 + GitLab..."
            className="flex-1 bg-transparent text-sm text-[var(--app-fg)] outline-none
                       placeholder:text-[var(--app-hint)]"
          />
          <span className="rounded border border-[var(--app-border)] px-1.5 py-0.5
                          text-[10px] text-[var(--app-hint)]">
            ESC
          </span>
        </div>

        {/* Results area */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {isLoading && (
            <div className="py-8 text-center text-sm text-[var(--app-hint)]">
              搜索中...
            </div>
          )}

          {error && (
            <div className="py-4 text-center text-sm text-red-500">
              {error}
            </div>
          )}

          {!isLoading && !error && query.length >= 2 && results.length === 0 && (
            <div className="py-8 text-center text-sm text-[var(--app-hint)]">
              未找到相关结果
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <>
              {/* GitLab section */}
              {results.filter(r => r.source === 'gitlab').length > 0 && (
                <div className="mb-2">
                  <div className="mb-1 px-2 text-[10px] uppercase tracking-wider text-[var(--app-hint)]">
                    📦 GitLab
                  </div>
                  {results.filter(r => r.source === 'gitlab').map((r) => {
                    const idx = results.indexOf(r)
                    return (
                      <div
                        key={r.title}
                        className={`cursor-pointer rounded-md px-3 py-2 text-sm
                          ${idx === activeIdx ? 'bg-[var(--app-secondary-bg)]' : 'hover:bg-[var(--app-subtle-bg)]'}`}
                        onClick={() => props.onClose()}
                      >
                        <div className="font-medium text-[var(--app-fg)]">{r.title}</div>
                        <div className="mt-0.5 text-xs text-[var(--app-hint)]">{r.subtitle}</div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Obsidian section */}
              {results.filter(r => r.source === 'obsidian').length > 0 && (
                <div>
                  <div className="mb-1 px-2 text-[10px] uppercase tracking-wider text-[var(--app-hint)]">
                    📄 知识库
                  </div>
                  {results.filter(r => r.source === 'obsidian').map((r) => {
                    const idx = results.indexOf(r)
                    return (
                      <div
                        key={r.title}
                        className={`cursor-pointer rounded-md px-3 py-2 text-sm
                          ${idx === activeIdx ? 'bg-[var(--app-secondary-bg)]' : 'hover:bg-[var(--app-subtle-bg)]'}`}
                        onClick={() => props.onClose()}
                      >
                        <div className="font-medium text-[var(--app-fg)]">{r.title}</div>
                        <div className="mt-0.5 text-xs text-[var(--app-hint)]">{r.subtitle}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

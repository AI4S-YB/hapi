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
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (props.isOpen && inputRef.current) {
      inputRef.current.focus()
      setQuery('')
      setResults([])
      setActiveIdx(-1)
    }
  }, [props.isOpen])

  const doSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }

    const demo: SearchResult[] = ([
      { source: 'gitlab' as const, title: '!6 海口测试方案', subtitle: 'team-wiki/haikou-compute · 🟡 待审核', url: '' },
      { source: 'gitlab' as const, title: '!3 DS V4 Flash 测试', subtitle: 'team-wiki/qatask · 🟢 进行中', url: '' },
      { source: 'obsidian' as const, title: 'DS V4 Flash 性能测试', subtitle: 'A1-研究项目/海口算力/ · 2026-06-15', url: '' },
      { source: 'obsidian' as const, title: '模型选型对比分析', subtitle: 'C1-领域知识/模型评测/ · 2026-06-10', url: '' }
    ]).filter(r =>
      r.title.toLowerCase().includes(q.toLowerCase()) ||
      r.subtitle.toLowerCase().includes(q.toLowerCase())
    )

    setResults(demo)
    setActiveIdx(-1)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 200)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, results.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter' && activeIdx >= 0 && results[activeIdx]) {
      props.onClose()
    }
  }

  if (!props.isOpen) return null

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={props.onClose}
      />
      <div className="absolute left-1/2 top-[15%] w-[560px] max-w-[90vw] -translate-x-1/2
                      overflow-hidden rounded-xl bg-[var(--app-bg)] shadow-2xl
                      border border-[var(--app-border)]">
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

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {query && results.length === 0 && (
            <div className="py-8 text-center text-sm text-[var(--app-hint)]">
              未找到相关结果
            </div>
          )}
          {results.length > 0 && (
            <>
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

import { memo } from 'react'
import { marked } from 'marked'

export const MdView = memo(function MdView(props: { content: string }) {
  const html = marked.parse(props.content, { async: false }) as string
  return (
    <div
      className="prose prose-sm prose-invert max-w-none
        prose-headings:text-[var(--app-fg)] prose-headings:font-semibold
        prose-p:text-[var(--app-fg)] prose-p:leading-relaxed
        prose-li:text-[var(--app-fg)] prose-li:leading-relaxed
        prose-code:text-[var(--app-link)] prose-code:bg-[var(--app-subtle-bg)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
        prose-pre:bg-[var(--app-subtle-bg)] prose-pre:border prose-pre:border-[var(--app-border)]
        prose-a:text-[var(--app-link)] prose-a:no-underline hover:prose-a:underline
        prose-strong:text-[var(--app-fg)]
        prose-blockquote:border-l-[var(--app-link)] prose-blockquote:text-[var(--app-hint)]
        prose-table:border-[var(--app-border)] prose-th:border-[var(--app-border)] prose-td:border-[var(--app-border)]
        prose-hr:border-[var(--app-border)]
        text-[13px] leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})

import { memo } from 'react'
import { marked } from 'marked'

// Configure marked for full GFM support
marked.setOptions({ gfm: true, breaks: false })

export const MdView = memo(function MdView(props: { content: string }) {
  const html = marked.parse(props.content, { async: false }) as string
  return (
    <div
      className="md-view text-[13px] leading-relaxed text-[var(--app-fg)]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})

// Inject styles once (no typography plugin needed)
const styleId = 'md-view-styles'
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    .md-view h1 { font-size: 1.4em; font-weight: 700; color: var(--app-fg); margin: 1em 0 0.5em; }
    .md-view h2 { font-size: 1.2em; font-weight: 600; color: var(--app-fg); margin: 1em 0 0.4em; }
    .md-view h3 { font-size: 1.05em; font-weight: 600; color: var(--app-fg); margin: 0.8em 0 0.3em; }
    .md-view h4, .md-view h5, .md-view h6 { font-size: 1em; font-weight: 600; color: var(--app-fg); margin: 0.6em 0 0.2em; }
    .md-view p { margin: 0.5em 0; }
    .md-view ul, .md-view ol { padding-left: 1.5em; margin: 0.4em 0; }
    .md-view li { margin: 0.15em 0; }
    .md-view strong { font-weight: 600; }
    .md-view em { font-style: italic; }
    .md-view a { color: var(--app-link); text-decoration: none; }
    .md-view a:hover { text-decoration: underline; }
    .md-view code {
      background: var(--app-subtle-bg); color: var(--app-link);
      padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.9em; font-family: ui-monospace, monospace;
    }
    .md-view pre {
      background: var(--app-subtle-bg); border: 1px solid var(--app-border);
      border-radius: 6px; padding: 10px 14px; margin: 0.5em 0; overflow-x: auto;
      font-family: ui-monospace, monospace; font-size: 0.85em; line-height: 1.5;
    }
    .md-view pre code { background: none; padding: 0; font-size: inherit; }
    .md-view blockquote {
      border-left: 3px solid var(--app-link); padding: 0.3em 0.8em; margin: 0.5em 0;
      color: var(--app-hint); background: var(--app-subtle-bg); border-radius: 0 4px 4px 0;
    }
    .md-view table {
      width: 100%; border-collapse: collapse; margin: 0.5em 0; font-size: 0.9em;
    }
    .md-view th {
      background: var(--app-subtle-bg); font-weight: 600; text-align: left;
      padding: 6px 10px; border: 1px solid var(--app-border);
    }
    .md-view td {
      padding: 5px 10px; border: 1px solid var(--app-border);
    }
    .md-view hr {
      border: none; border-top: 1px solid var(--app-border); margin: 1em 0;
    }
    .md-view img { max-width: 100%; border-radius: 6px; }
    .md-view input[type="checkbox"] { margin-right: 0.4em; }
    .md-view del { opacity: 0.6; }
`
  document.head.appendChild(style)
}

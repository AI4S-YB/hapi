import { Hono } from 'hono'
import { spawnSync } from 'child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'

const OBSIDIAN_VAULT = `${process.env.HOME || '/tmp'}/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault`

interface SearchResults {
  obsidian: Array<{ path: string; title: string }>
  gitlab: Array<{ iid: string; title: string }>
}

function sanitizeQuery(raw: string): string {
  // Strip any characters that could be used for command injection
  // Allow: alphanumeric, CJK, spaces, basic punctuation
  return raw.trim().replace(/[^\w\s一-鿿぀-ゟ가-힯\-_.@/]/g, '').slice(0, 100)
}

export function createSearchRoutes(): Hono {
  const app = new Hono()

  app.get('/shell/search', async (c) => {
    const rawQ = c.req.query('q') || ''
    const results: SearchResults = { obsidian: [], gitlab: [] }

    const q = sanitizeQuery(rawQ)
    if (!q || q.length < 2) {
      return c.json(results)
    }

    // Search Obsidian vault with grep
    // '--' prevents the query from being interpreted as a flag
    try {
      const grep = spawnSync('grep', [
        '-rli', '--', q, OBSIDIAN_VAULT,
        '--include=*.md'
      ], { timeout: 5000 })
      if (grep.stdout) {
        const lines = new TextDecoder().decode(grep.stdout).trim().split('\n').filter(Boolean)
        results.obsidian = lines.slice(0, 10).map((p: string) => {
          const rel = p.replace(OBSIDIAN_VAULT + '/', '')
          return { path: rel, title: rel.replace('.md', '').split('/').pop() || rel }
        })
      }
    } catch {
      // grep not found or timeout
    }

    // Search GitLab issues via glab API
    // glab api proxies GitLab REST API with existing auth
    try {
      const glab = spawnSync('glab', [
        'api',
        `search?scope=issues&search=${encodeURIComponent(q)}&per_page=5`
      ], { timeout: 8000 })
      if (glab.stdout) {
        try {
          const data = JSON.parse(new TextDecoder().decode(glab.stdout))
          if (Array.isArray(data)) {
            results.gitlab = data.slice(0, 5).map((item: any) => ({
              iid: String(item.iid || ''),
              title: item.title || ''
            }))
          }
        } catch {
          // JSON parse failed — fall back to empty results
        }
      }
    } catch {
      // glab not found, not authenticated, or API error
    }

    return c.json(results)
  })

  // GET /shell/issue?repo=...&iid=...
  app.get('/shell/issue', async (c) => {
    const repo = c.req.query('repo') || ''
    const iid = c.req.query('iid') || ''
    if (!repo || !iid) {
      return c.json({ error: 'Missing repo or iid' }, 400)
    }
    try {
      const glab = spawnSync('glab', ['issue', 'view', iid, '--repo', repo], { timeout: 8000 })
      if (glab.status !== 0 || !glab.stdout) {
        return c.json({ error: 'Issue not found' }, 404)
      }
      const raw = new TextDecoder().decode(glab.stdout)
      const lines = raw.split('\n')
      const meta: Record<string, string> = {}
      let descStart = lines.length
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '--') { descStart = i; break }
        const m = lines[i].match(/^(\w[\w\s]*?):\s*(.+)/)
        if (m) meta[m[1].trim().toLowerCase()] = m[2].trim()
      }
      const description = lines.slice(descStart + 1).join('\n').trim()
      return c.json({
        iid, repo,
        title: meta.title || '',
        state: meta.state || '',
        author: meta.author || '',
        labels: meta.labels || '',
        comments: meta.comments || '0',
        description
      })
    } catch {
      return c.json({ error: 'Failed to fetch issue' }, 500)
    }
  })

  // GET /shell/issues — list issues across team repos
  app.get('/shell/issues', async (c) => {
    const q = sanitizeQuery(c.req.query('q') || '')
    const results: Array<{ iid: string; title: string; state: string; repo: string }> = []

    // Known repos from GITLAB-REPOS.md — search across all
    const REPOS = [
      'team-wiki/projects/qatask', 'team-wiki/projects/ai-interface',
      'team-wiki/projects/haikou-compute', 'team-wiki/projects/GPUresearch',
      'team-wiki/projects/lab-compute-resources', 'team-wiki/projects/bioinfo-data-coordination',
      'team-wiki/projects/horticulture-dataset', 'team-wiki/projects/knowledge-density-paper',
      'team-wiki/projects/fan-skill-evaluation', 'team-wiki/projects/ai-office',
      'team-wiki/team-wiki', 'team-wiki/knowledge',
      'team-wiki/members/kentnf'
    ]

    for (const repo of REPOS) {
      try {
        const glab = spawnSync('glab', [
          'api', `projects/${encodeURIComponent(repo)}/issues?per_page=5&state=opened&order_by=updated_at`
        ], { timeout: 5000 })
        if (glab.stdout) {
          const data = JSON.parse(new TextDecoder().decode(glab.stdout))
          if (Array.isArray(data)) {
            for (const item of data) {
              if (q && !item.title?.toLowerCase().includes(q.toLowerCase())) continue
              results.push({
                iid: String(item.iid || ''),
                title: item.title || '',
                state: item.state || 'open',
                repo
              })
            }
          }
        }
      } catch { /* repo not found or timeout */ }
      if (results.length >= 30) break
    }

    return c.json({ issues: results.slice(0, 30) })
  })

  // GET /shell/obsidian/tree?path=... — directory listing
  app.get('/shell/obsidian/tree', async (c) => {
    const subPath = c.req.query('path') || ''
    const dirPath = subPath ? `${OBSIDIAN_VAULT}/${subPath}` : OBSIDIAN_VAULT
    if (!dirPath.startsWith(OBSIDIAN_VAULT)) {
      return c.json({ error: 'Invalid path' }, 403)
    }
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true })
      const dirs: string[] = []
      const files: string[] = []
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        if (entry.isDirectory()) dirs.push(entry.name)
        else if (entry.name.endsWith('.md')) files.push(entry.name)
      }
      dirs.sort((a, b) => a.localeCompare(b, 'zh'))
      files.sort((a, b) => a.localeCompare(b, 'zh'))
      return c.json({ path: subPath, dirs, files })
    } catch {
      return c.json({ error: 'Directory not found' }, 404)
    }
  })

  // GET /shell/note?path=...
  app.get('/shell/note', async (c) => {
    const notePath = c.req.query('path') || ''
    if (!notePath) return c.json({ error: 'Missing path' }, 400)
    const fullPath = `${OBSIDIAN_VAULT}/${notePath}`
    if (!fullPath.startsWith(OBSIDIAN_VAULT)) {
      return c.json({ error: 'Path traversal denied' }, 403)
    }
    try {
      const content = readFileSync(fullPath, 'utf8')
      const stat = statSync(fullPath)
      return c.json({
        path: notePath,
        title: notePath.split('/').pop()?.replace('.md', '') || '',
        content,
        modifiedAt: stat?.mtime.toISOString() || ''
      })
    } catch {
      return c.json({ error: 'Note not found' }, 404)
    }
  })

  return app
}
